import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type {
  Node,
  CreateNodeInput,
  UpdateNodeInput,
  GovernanceStatus,
  ProvenanceMetadata,
} from '../types/ontology'

export function useNodes() {
  const nodes = ref<Node[]>([])
  const currentNode = ref<Node | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchNodes(folderId?: string, status?: GovernanceStatus) {
    loading.value = true
    error.value = null

    let query = supabase
      .from('nodes')
      .select('*')
      .order('created_at', { ascending: false })

    if (folderId) query = query.eq('folder_id', folderId)
    if (status) query = query.eq('status', status)

    const { data, error: err } = await query
    if (err) {
      error.value = err.message
    } else {
      nodes.value = (data as unknown as Node[]) ?? []
    }
    loading.value = false
  }

  async function fetchInboxNodes() {
    loading.value = true
    error.value = null

    const { data, error: err } = await supabase
      .from('nodes')
      .select('*')
      .eq('status', 'Experimental')
      .order('created_at', { ascending: false })

    if (err) {
      error.value = err.message
    } else {
      nodes.value = (data as unknown as Node[]) ?? []
    }
    loading.value = false
  }

  async function fetchNode(id: string) {
    loading.value = true
    error.value = null

    const { data, error: err } = await supabase
      .from('nodes')
      .select('*')
      .eq('id', id)
      .single()

    if (err) {
      error.value = err.message
    } else {
      currentNode.value = data as unknown as Node
    }
    loading.value = false
  }

  async function createNode(input: CreateNodeInput): Promise<Node | null> {
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
      .from('nodes')
      .insert({
        user_id: userData.user.id,
        title: input.title,
        content: input.content,
        type: input.type ?? 'Note',
        status: input.status ?? 'Active',
        folder_id: input.folder_id ?? null,
        tags: input.tags ?? [],
        word_count: input.content.split(/\s+/).filter(Boolean).length,
        provenance,
      })
      .select()
      .single()

    if (err) {
      error.value = err.message
      return null
    }

    const newNode = data as unknown as Node
    nodes.value = [newNode, ...nodes.value]

    // Log provenance
    await logProvenance({
      action: 'create',
      actor: provenance.creator,
      target_node_id: newNode.id,
      after_state: data as unknown as Record<string, unknown>,
    })

    return newNode
  }

  async function updateNode(input: UpdateNodeInput): Promise<Node | null> {
    error.value = null

    // Get before state for provenance
    const { data: beforeData } = await supabase
      .from('nodes')
      .select('*')
      .eq('id', input.id)
      .single()

    const updateFields: Record<string, unknown> = {}
    if (input.title !== undefined) updateFields.title = input.title
    if (input.content !== undefined) {
      updateFields.content = input.content
      updateFields.word_count = input.content.split(/\s+/).filter(Boolean).length
    }
    if (input.type !== undefined) updateFields.type = input.type
    if (input.status !== undefined) updateFields.status = input.status
    if (input.folder_id !== undefined) updateFields.folder_id = input.folder_id
    if (input.tags !== undefined) updateFields.tags = input.tags

    const { data, error: err } = await supabase
      .from('nodes')
      .update(updateFields)
      .eq('id', input.id)
      .select()
      .single()

    if (err) {
      error.value = err.message
      return null
    }

    const updatedNode = data as unknown as Node
    nodes.value = nodes.value.map((n) => (n.id === input.id ? updatedNode : n))
    if (currentNode.value?.id === input.id) {
      currentNode.value = updatedNode
    }

    await logProvenance({
      action: 'update',
      actor: 'User',
      target_node_id: input.id,
      before_state: beforeData as unknown as Record<string, unknown>,
      after_state: data as unknown as Record<string, unknown>,
    })

    return updatedNode
  }

  async function approveNode(id: string): Promise<boolean> {
    const result = await updateNode({ id, status: 'Active' })
    if (result) {
      await logProvenance({
        action: 'approve',
        actor: 'User',
        target_node_id: id,
        description: 'Node approved: Experimental -> Active',
      })
    }
    return !!result
  }

  async function deprecateNode(id: string): Promise<boolean> {
    const result = await updateNode({ id, status: 'Deprecated' })
    if (result) {
      await logProvenance({
        action: 'deprecate',
        actor: 'User',
        target_node_id: id,
        description: 'Node deprecated',
      })
    }
    return !!result
  }

  async function deleteNode(id: string): Promise<boolean> {
    error.value = null

    const { error: err } = await supabase
      .from('nodes')
      .delete()
      .eq('id', id)

    if (err) {
      error.value = err.message
      return false
    }

    nodes.value = nodes.value.filter((n) => n.id !== id)
    if (currentNode.value?.id === id) {
      currentNode.value = null
    }
    return true
  }

  async function logProvenance(params: {
    action: string
    actor: string
    target_node_id?: string
    target_edge_id?: string
    description?: string
    before_state?: Record<string, unknown> | null
    after_state?: Record<string, unknown> | null
    metadata?: Record<string, unknown>
  }) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    await supabase.from('provenance_logs').insert({
      user_id: userData.user.id,
      action: params.action,
      actor: params.actor,
      target_node_id: params.target_node_id ?? null,
      target_edge_id: params.target_edge_id ?? null,
      description: params.description ?? null,
      before_state: params.before_state ?? null,
      after_state: params.after_state ?? null,
      metadata: params.metadata ?? {},
    })
  }

  return {
    nodes,
    currentNode,
    loading,
    error,
    fetchNodes,
    fetchInboxNodes,
    fetchNode,
    createNode,
    updateNode,
    approveNode,
    deprecateNode,
    deleteNode,
  }
}
