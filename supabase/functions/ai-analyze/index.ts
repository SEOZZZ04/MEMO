// =============================================================================
// MEMO Edge Function: ai-analyze
// =============================================================================
// Performs AI analysis on nodes: summarization, link suggestion, argumentation.
// All outputs follow Toulmin model and are tagged with full provenance.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MODEL_ID = 'gemini-2.5-pro'

type AnalysisAction = 'summarize' | 'link_suggest' | 'argumentation_check'

const PROMPTS: Record<AnalysisAction, string> = {
  summarize: `Summarize the following text concisely. Identify the key claim, its grounds (evidence), and your confidence level (0.0-1.0).

Return JSON:
{
  "summary": "...",
  "claim": "...",
  "grounds": ["evidence 1", "evidence 2"],
  "qualifier": 0.8
}

TEXT:
`,

  link_suggest: `Given the following nodes from a knowledge graph, suggest relationships between them.

For each suggested link, specify:
- source_id and target_id (use the provided IDs)
- type: one of "supports", "refutes", "defines", "caused_by", "derived_from", "example_of", "part_of"
- weight: 0.0-1.0 confidence
- reason: why this link should exist

Return JSON:
{
  "suggestions": [
    { "source_id": "...", "target_id": "...", "type": "supports", "weight": 0.8, "reason": "..." }
  ]
}

NODES:
`,

  argumentation_check: `Analyze the following claim and its connected evidence. Evaluate:
1. Are the grounds sufficient?
2. Are there potential rebuttals?
3. What qualifiers should be applied?

Return JSON:
{
  "assessment": "strong" | "moderate" | "weak",
  "missing_evidence": ["..."],
  "potential_rebuttals": ["..."],
  "suggested_qualifier": 0.7,
  "reasoning": "..."
}

CLAIM AND EVIDENCE:
`,
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, content-type',
        },
      })
    }

    const { action, content, node_ids, user_id } = await req.json() as {
      action: AnalysisAction
      content: string
      node_ids?: string[]
      user_id: string
    }

    if (!action || !content || !user_id) {
      return new Response(JSON.stringify({ error: 'action, content, and user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const prompt = PROMPTS[action]
    if (!prompt) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt + content }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    const geminiData = await geminiResponse.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const analysisResult = JSON.parse(responseText)

    // Log the analysis in provenance
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    await supabase.from('provenance_logs').insert({
      user_id,
      action,
      actor: 'AI',
      model_id: MODEL_ID,
      description: `AI ${action} analysis completed`,
      target_node_id: node_ids?.[0] ?? null,
      metadata: {
        node_ids,
        result: analysisResult,
      },
    })

    // For link suggestions, auto-create experimental edges
    if (action === 'link_suggest' && analysisResult.suggestions) {
      for (const suggestion of analysisResult.suggestions) {
        await supabase.from('edges').insert({
          user_id,
          source_id: suggestion.source_id,
          target_id: suggestion.target_id,
          type: suggestion.type,
          weight: suggestion.weight,
          label: suggestion.reason,
          status: 'Experimental',
          provenance: {
            creator: 'AI',
            model: MODEL_ID,
            method: 'link_suggest',
            confidence: suggestion.weight,
          },
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        result: analysisResult,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('ai-analyze error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
