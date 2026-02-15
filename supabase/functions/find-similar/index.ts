// =============================================================================
// MEMO Edge Function: find-similar
// =============================================================================
// Embeds the given text and returns the top-K most similar existing notes.
// Used by the "Similar Context" tab to show real-time recommendations
// while the user is writing.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * Generate embedding using OpenAI if available, otherwise fall back
 * to Google's embedding API.
 */
async function getEmbedding(text: string): Promise<number[]> {
  // Prefer OpenAI text-embedding-3-small (1536 dimensions, matches our schema)
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

  // Fallback: Google embedding (768 dim — pad to 1536 for schema compat)
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
  // Pad to 1536 dimensions if needed
  while (embedding.length < 1536) embedding.push(0)
  return embedding.slice(0, 1536)
}

Deno.serve(async (req) => {
  // CORS
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
    const { text, user_id, top_k = 3 } = await req.json()

    if (!text || !user_id) {
      return new Response(JSON.stringify({ error: 'text and user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 1. Generate embedding for the input text
    const embedding = await getEmbedding(text)

    // 2. Search similar nodes via pgvector
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: results, error } = await supabase.rpc('search_nodes_by_embedding', {
      query_embedding: embedding,
      match_user_id: user_id,
      match_threshold: 0.5,
      match_count: top_k,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ results: results ?? [] }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (err) {
    console.error('find-similar error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
