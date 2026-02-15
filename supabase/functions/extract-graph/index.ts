// =============================================================================
// MEMO Edge Function: extract-graph
// =============================================================================
// Extracts entities and semantic relationships from text using AI (Toulmin model).
// Creates nodes (Claims, Evidence, Sources) and typed edges (supports, refutes, caused_by).
// All AI-generated data is marked as 'Experimental' status with full provenance.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MODEL_ID = 'gemini-2.5-pro'

interface ToulminExtraction {
  claims: {
    text: string
    qualifier: number // 0.0 - 1.0
    type: 'Claim' | 'Evidence' | 'Definition' | 'Source'
  }[]
  relationships: {
    source_index: number
    target_index: number
    type: 'supports' | 'refutes' | 'defines' | 'caused_by' | 'derived_from' | 'example_of' | 'part_of'
    weight: number
  }[]
  entities: {
    name: string
    type: 'Person' | 'Source' | 'Definition'
  }[]
}

const EXTRACTION_PROMPT = `You are an epistemic analyst. Analyze the following text and extract a structured knowledge graph using the Toulmin argumentation model.

For each piece of content, identify:
1. **Claims**: Assertions, arguments, or main points
2. **Evidence**: Data, facts, or observations that support or refute claims
3. **Definitions**: Key concept definitions
4. **Sources**: Referenced external sources
5. **Entities**: Named persons or referenced works

For relationships, classify each link as one of:
- "supports": Evidence that backs a claim
- "refutes": Evidence that contradicts a claim
- "defines": A definition for a concept
- "caused_by": Causal relationship
- "derived_from": One idea derived from another
- "example_of": An example illustrating a concept
- "part_of": Part-whole relationship

Return ONLY valid JSON in this exact format:
{
  "claims": [
    { "text": "...", "qualifier": 0.8, "type": "Claim" }
  ],
  "relationships": [
    { "source_index": 0, "target_index": 1, "type": "supports", "weight": 0.9 }
  ],
  "entities": [
    { "name": "...", "type": "Person" }
  ]
}

The qualifier field (0.0-1.0) represents how confident you are about the claim's validity.
The weight field (0.0-1.0) represents the strength of the relationship.

TEXT TO ANALYZE:
`

Deno.serve(async (req) => {
  try {
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

    const { content, source_node_id, user_id } = await req.json()

    if (!content || !user_id) {
      return new Response(JSON.stringify({ error: 'content and user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Call Gemini API for extraction
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: EXTRACTION_PROMPT + content }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    const geminiData = await geminiResponse.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      return new Response(JSON.stringify({ error: 'AI extraction failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const extraction: ToulminExtraction = JSON.parse(responseText)

    // Store in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const createdNodeIds: string[] = []

    // Create nodes for each claim/entity
    for (const claim of extraction.claims) {
      const { data: nodeData, error: nodeErr } = await supabase
        .from('nodes')
        .insert({
          user_id,
          title: claim.text.substring(0, 100),
          content: claim.text,
          type: claim.type,
          status: 'Experimental',
          provenance: {
            creator: 'AI',
            model: MODEL_ID,
            source_node_id: source_node_id ?? null,
            confidence: claim.qualifier,
            method: 'extract_graph',
          },
        })
        .select('id')
        .single()

      if (nodeErr) {
        console.error('Node insert error:', nodeErr)
        continue
      }
      createdNodeIds.push(nodeData.id)
    }

    // Create nodes for entities
    for (const entity of extraction.entities) {
      const { data: entityData, error: entityErr } = await supabase
        .from('nodes')
        .insert({
          user_id,
          title: entity.name,
          content: `Entity: ${entity.name}`,
          type: entity.type,
          status: 'Experimental',
          provenance: {
            creator: 'AI',
            model: MODEL_ID,
            source_node_id: source_node_id ?? null,
            method: 'extract_graph',
          },
        })
        .select('id')
        .single()

      if (entityErr) {
        console.error('Entity insert error:', entityErr)
        continue
      }
      createdNodeIds.push(entityData.id)
    }

    // Create edges for relationships
    const createdEdgeIds: string[] = []

    for (const rel of extraction.relationships) {
      const sourceId = createdNodeIds[rel.source_index]
      const targetId = createdNodeIds[rel.target_index]

      if (!sourceId || !targetId || sourceId === targetId) continue

      const { data: edgeData, error: edgeErr } = await supabase
        .from('edges')
        .insert({
          user_id,
          source_id: sourceId,
          target_id: targetId,
          type: rel.type,
          weight: rel.weight,
          status: 'Experimental',
          provenance: {
            creator: 'AI',
            model: MODEL_ID,
            source_node_id: source_node_id ?? null,
            method: 'extract_graph',
          },
        })
        .select('id')
        .single()

      if (edgeErr) {
        console.error('Edge insert error:', edgeErr)
        continue
      }
      createdEdgeIds.push(edgeData.id)
    }

    // Log provenance for the entire extraction operation
    await supabase.from('provenance_logs').insert({
      user_id,
      action: 'extract_graph',
      actor: 'AI',
      model_id: MODEL_ID,
      description: `Extracted ${createdNodeIds.length} nodes and ${createdEdgeIds.length} edges from text`,
      metadata: {
        source_node_id,
        created_node_ids: createdNodeIds,
        created_edge_ids: createdEdgeIds,
        extraction_summary: {
          claims: extraction.claims.length,
          entities: extraction.entities.length,
          relationships: extraction.relationships.length,
        },
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        nodes_created: createdNodeIds.length,
        edges_created: createdEdgeIds.length,
        node_ids: createdNodeIds,
        edge_ids: createdEdgeIds,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('extract-graph error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
