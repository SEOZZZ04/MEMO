// =============================================================================
// MEMO Edge Function: graph-rag
// =============================================================================
// GraphRAG pipeline:
//   1. Embed the question
//   2. Vector search for related nodes (top-5)
//   3. Graph traversal to get neighbors (supports, refutes, etc.)
//   4. Build context with provenance information
//   5. Send to LLM for answer generation
//   6. Return answer with source attribution
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ModelConfig {
  provider: 'google' | 'openai'
  apiUrl: string
  model: string
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gemini-2.5-flash': {
    provider: 'google',
    apiUrl: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
    model: 'gemini-2.5-flash',
  },
  'gpt-4o-mini': {
    provider: 'openai',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
}

async function getEmbedding(text: string): Promise<number[]> {
  if (OPENAI_API_KEY) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text.slice(0, 8000),
        model: 'text-embedding-3-small',
      }),
    })
    const data = await res.json()
    return data.data[0].embedding
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 8000) }] },
      }),
    }
  )
  const data = await res.json()
  const embedding: number[] = data.embedding.values
  while (embedding.length < 1536) embedding.push(0)
  return embedding.slice(0, 1536)
}

async function callLLM(
  modelId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const config = MODEL_CONFIGS[modelId] ?? MODEL_CONFIGS['gemini-2.5-flash']

  if (config.provider === 'google') {
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    })
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  // OpenAI
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const { question, user_id, model = 'gemini-2.5-flash' } = await req.json()

    if (!question || !user_id) {
      return new Response(JSON.stringify({ error: 'question and user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Step 1: Embed the question
    const embedding = await getEmbedding(question)

    // Step 2: Vector search for top-5 similar nodes
    const { data: vectorResults } = await supabase.rpc('search_nodes_by_embedding', {
      query_embedding: embedding,
      match_user_id: user_id,
      match_threshold: 0.4,
      match_count: 5,
    })

    const topNodes = vectorResults ?? []

    // Step 3: Graph traversal — for each result, get neighbors
    const sources: {
      node: typeof topNodes[0]
      context: { node_id: string; node_title: string; edge_type: string; direction: string }[]
    }[] = []

    for (const node of topNodes) {
      const { data: ctx } = await supabase.rpc('get_node_context', {
        p_node_id: node.id,
        p_user_id: user_id,
        p_depth: 1,
      })
      sources.push({
        node,
        context: (ctx ?? []).map((c: Record<string, unknown>) => ({
          node_id: c.node_id as string,
          node_title: c.node_title as string,
          edge_type: c.edge_type as string,
          direction: c.direction as string,
        })),
      })
    }

    // Step 4: Build context for LLM
    const contextBlocks = sources
      .map((s, i) => {
        const neighbors = s.context
          .map((c) => `  - [${c.edge_type}] ${c.node_title} (${c.direction})`)
          .join('\n')
        return `[Source ${i + 1}: "${s.node.title}" (${s.node.type}, similarity: ${Math.round(s.node.similarity * 100)}%)]
${s.node.content}
${neighbors ? `Connected notes:\n${neighbors}` : '(No connections)'}`
      })
      .join('\n\n---\n\n')

    const systemPrompt = `You are a knowledge assistant for a personal knowledge graph. Answer questions based ONLY on the provided sources. For each claim in your answer, cite which source supports it using [Source N] notation. If sources contain conflicting information, acknowledge both perspectives. If the sources don't contain enough information, say so clearly.`

    const userPrompt = `Based on these notes from the knowledge graph:\n\n${contextBlocks}\n\nQuestion: ${question}`

    // Step 5: Generate answer
    const answer = await callLLM(model, systemPrompt, userPrompt)

    // Step 6: Log the query in provenance
    await supabase.from('provenance_logs').insert({
      user_id,
      action: 'summarize',
      actor: 'AI',
      model_id: model,
      description: `GraphRAG query: "${question.substring(0, 100)}"`,
      metadata: {
        question,
        source_node_ids: topNodes.map((n: { id: string }) => n.id),
        source_count: topNodes.length,
      },
    })

    return new Response(
      JSON.stringify({
        answer,
        sources: sources.map((s) => ({
          node: s.node,
          context: s.context,
        })),
        model,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (err) {
    console.error('graph-rag error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
