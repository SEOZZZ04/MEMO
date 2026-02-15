import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { SearchResult, NodeContext } from '../types/ontology'

export function useSearch() {
  const results = ref<SearchResult[]>([])
  const context = ref<NodeContext[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function searchByText(query: string) {
    loading.value = true
    error.value = null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      error.value = 'Not authenticated'
      loading.value = false
      return
    }

    const { data, error: err } = await supabase.rpc('search_nodes_by_text', {
      query_text: query,
      match_user_id: userData.user.id,
      match_count: 20,
    })

    if (err) {
      error.value = err.message
    } else {
      results.value = (data as unknown as SearchResult[]) ?? []
    }
    loading.value = false
  }

  async function searchByEmbedding(embedding: number[], threshold = 0.7) {
    loading.value = true
    error.value = null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      error.value = 'Not authenticated'
      loading.value = false
      return
    }

    const { data, error: err } = await supabase.rpc('search_nodes_by_embedding', {
      query_embedding: embedding,
      match_user_id: userData.user.id,
      match_threshold: threshold,
      match_count: 10,
    })

    if (err) {
      error.value = err.message
    } else {
      results.value = (data as unknown as SearchResult[]) ?? []
    }
    loading.value = false
  }

  async function getNodeContext(nodeId: string, depth = 1) {
    error.value = null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      error.value = 'Not authenticated'
      return
    }

    const { data, error: err } = await supabase.rpc('get_node_context', {
      p_node_id: nodeId,
      p_user_id: userData.user.id,
      p_depth: depth,
    })

    if (err) {
      error.value = err.message
    } else {
      context.value = (data as unknown as NodeContext[]) ?? []
    }
  }

  /**
   * Hybrid search: text search + graph traversal context
   * Returns results enriched with their graph neighborhood
   */
  async function hybridSearch(query: string) {
    await searchByText(query)

    // For the top results, fetch their graph context
    const enrichedResults = await Promise.all(
      results.value.slice(0, 5).map(async (result) => {
        await getNodeContext(result.id, 1)
        return {
          ...result,
          context: [...context.value],
        }
      })
    )

    return enrichedResults
  }

  return {
    results,
    context,
    loading,
    error,
    searchByText,
    searchByEmbedding,
    getNodeContext,
    hybridSearch,
  }
}
