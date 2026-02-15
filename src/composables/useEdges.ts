import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type {
  Edge,
  CreateEdgeInput,
  EdgeType,
  GovernanceStatus,
  ProvenanceMetadata,
} from '../types/ontology'

export function useEdges() {
  const edges = ref<Edge[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchEdgesForNode(nodeId: string) {
    loading.value = true
    error.value = null

    const { data, error: err } = await supabase
      .from('edges')
      .select('*')
      .or(`source_id.eq.${nodeId},target_id.eq.${nodeId}`)
      .neq('status', 'Deprecated')

    if (err) {
      error.value = err.message
    } else {
      edges.value = (data as unknown as Edge[]) ?? []
    }
    loading.value = false
  }

  async function fetchAllEdges(status?: GovernanceStatus) {
    loading.value = true
    error.value = null

    let query = supabase.from('edges').select('*')
    if (status) query = query.eq('status', status)

    const { data, error: err } = await query
    if (err) {
      error.value = err.message
    } else {
      edges.value = (data as unknown as Edge[]) ?? []
    }
    loading.value = false
  }

  async function createEdge(input: CreateEdgeInput): Promise<Edge | null> {
    error.value = null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      error.value = 'Not authenticated'
      return null
    }

    const provenance: ProvenanceMetadata = {
      creator: 'User',
      method: 'manual',
      ...input.provenance,
    }

    const { data, error: err } = await supabase
      .from('edges')
      .insert({
        user_id: userData.user.id,
        source_id: input.source_id,
        target_id: input.target_id,
        type: input.type ?? 'related_to',
        weight: input.weight ?? 1.0,
        label: input.label ?? null,
        provenance,
      } as any)
      .select()
      .single()

    if (err) {
      error.value = err.message
      return null
    }

    const newEdge = data as unknown as Edge
    edges.value = [...edges.value, newEdge]

    // Log provenance
    await supabase.from('provenance_logs').insert({
      user_id: userData.user.id,
      action: 'create',
      actor: provenance.creator,
      target_edge_id: newEdge.id,
      after_state: data as unknown as Record<string, unknown>,
    })

    return newEdge
  }

  async function updateEdgeType(id: string, type: EdgeType): Promise<boolean> {
    error.value = null

    const { error: err } = await supabase
      .from('edges')
      .update({ type } as any)
      .eq('id', id)

    if (err) {
      error.value = err.message
      return false
    }

    edges.value = edges.value.map((e) =>
      e.id === id ? { ...e, type } : e
    )
    return true
  }

  async function deleteEdge(id: string): Promise<boolean> {
    error.value = null

    const { error: err } = await supabase
      .from('edges')
      .delete()
      .eq('id', id)

    if (err) {
      error.value = err.message
      return false
    }

    edges.value = edges.value.filter((e) => e.id !== id)
    return true
  }

  return {
    edges,
    loading,
    error,
    fetchEdgesForNode,
    fetchAllEdges,
    createEdge,
    updateEdgeType,
    deleteEdge,
  }
}
