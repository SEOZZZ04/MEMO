import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { SearchResult, NodeContext } from '../types/ontology'

// --- AI Model Definitions ---

export interface AIModel {
  id: string
  name: string
  provider: 'google' | 'openai'
  description: string
  useCase: string
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Fast responses, good for summaries',
    useCase: 'speed',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Deep reasoning, complex analysis',
    useCase: 'reasoning',
  },
]

// --- GraphRAG result ---

export interface GraphRAGResult {
  answer: string
  sources: {
    node: SearchResult
    relationship?: string
    context: NodeContext[]
  }[]
  model: string
}

export function useAI() {
  const selectedModel = ref<AIModel>(AI_MODELS[0])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastResult = ref<GraphRAGResult | null>(null)

  const modelId = computed(() => selectedModel.value.id)

  function selectModel(model: AIModel) {
    selectedModel.value = model
  }

  /**
   * Extract graph from text content via Edge Function.
   */
  async function extractGraph(content: string, sourceNodeId?: string) {
    loading.value = true
    error.value = null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      error.value = 'Not authenticated'
      loading.value = false
      return null
    }

    const { data, error: err } = await supabase.functions.invoke('extract-graph', {
      body: {
        content,
        source_node_id: sourceNodeId,
        user_id: userData.user.id,
        model: selectedModel.value.id,
      },
    })

    loading.value = false

    if (err) {
      error.value = err.message
      return null
    }

    return data
  }

  /**
   * Find similar notes to the given text via Edge Function.
   */
  async function findSimilar(text: string, topK = 3): Promise<SearchResult[]> {
    loading.value = true
    error.value = null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      error.value = 'Not authenticated'
      loading.value = false
      return []
    }

    const { data, error: err } = await supabase.functions.invoke('find-similar', {
      body: {
        text,
        user_id: userData.user.id,
        top_k: topK,
      },
    })

    loading.value = false

    if (err) {
      error.value = err.message
      return []
    }

    return data?.results ?? []
  }

  /**
   * GraphRAG: Hybrid search (Vector + Graph) → LLM answer with provenance.
   *
   * Pipeline:
   * 1. Embed the question
   * 2. Find similar nodes via vector search
   * 3. For each result, get graph neighbors (supports, refutes, etc.)
   * 4. Build context with provenance
   * 5. Send to LLM for answer generation
   */
  async function graphRAGQuery(question: string): Promise<GraphRAGResult | null> {
    loading.value = true
    error.value = null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      error.value = 'Not authenticated'
      loading.value = false
      return null
    }

    const { data, error: err } = await supabase.functions.invoke('graph-rag', {
      body: {
        question,
        user_id: userData.user.id,
        model: selectedModel.value.id,
      },
    })

    loading.value = false

    if (err) {
      error.value = err.message
      return null
    }

    lastResult.value = data as GraphRAGResult
    return data as GraphRAGResult
  }

  /**
   * AI analysis actions (summarize, link_suggest, argumentation_check).
   */
  async function analyze(
    action: 'summarize' | 'link_suggest' | 'argumentation_check',
    content: string,
    nodeIds?: string[]
  ) {
    loading.value = true
    error.value = null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      error.value = 'Not authenticated'
      loading.value = false
      return null
    }

    const { data, error: err } = await supabase.functions.invoke('ai-analyze', {
      body: {
        action,
        content,
        node_ids: nodeIds,
        user_id: userData.user.id,
        model: selectedModel.value.id,
      },
    })

    loading.value = false

    if (err) {
      error.value = err.message
      return null
    }

    return data?.result ?? null
  }

  return {
    selectedModel,
    AI_MODELS,
    loading,
    error,
    lastResult,
    modelId,
    selectModel,
    extractGraph,
    findSimilar,
    graphRAGQuery,
    analyze,
  }
}
