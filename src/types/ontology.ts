// =============================================================================
// MEMO Ontology Type System
// =============================================================================
// Mirrors the database schema enum types and table structures.
// All types follow the Ontology-Driven & Provenance-First philosophy.
// =============================================================================

// --- Enums (mirror SQL enums) ---

export type NodeType =
  | 'Note'
  | 'Claim'
  | 'Evidence'
  | 'Source'
  | 'Person'
  | 'Definition'

export type EdgeType =
  | 'related_to'
  | 'supports'
  | 'refutes'
  | 'defines'
  | 'caused_by'
  | 'derived_from'
  | 'example_of'
  | 'part_of'

export type GovernanceStatus = 'Active' | 'Experimental' | 'Deprecated'

export type CreatorType = 'User' | 'AI'

export type ProvenanceAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'merge'
  | 'split'
  | 'approve'
  | 'deprecate'
  | 'extract_graph'
  | 'summarize'
  | 'link_suggest'

// --- Provenance metadata (JSONB) ---

export interface ProvenanceMetadata {
  creator: CreatorType
  model?: string | null
  model_version?: string | null
  source_node_id?: string | null
  confidence?: number | null
  method?: 'extract_graph' | 'summarize' | 'manual' | 'link_suggest' | null
}

// --- Database Row Types ---

export interface Folder {
  id: string
  user_id: string
  name: string
  slug: string
  is_system: boolean
  parent_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Node {
  id: string
  user_id: string
  folder_id: string | null
  title: string
  content: string
  type: NodeType
  status: GovernanceStatus
  provenance: ProvenanceMetadata
  embedding?: number[] | null
  tags: string[]
  word_count: number
  created_at: string
  updated_at: string
}

export interface Edge {
  id: string
  user_id: string
  source_id: string
  target_id: string
  type: EdgeType
  status: GovernanceStatus
  weight: number
  label: string | null
  provenance: ProvenanceMetadata
  created_at: string
  updated_at: string
}

export interface ProvenanceLog {
  id: string
  user_id: string
  action: ProvenanceAction
  description: string | null
  actor: CreatorType
  model_id: string | null
  model_version: string | null
  target_node_id: string | null
  target_edge_id: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  metadata: Record<string, unknown>
  created_at: string
}

// --- API / Component Types ---

export interface CreateNodeInput {
  title: string
  content: string
  type?: NodeType
  status?: GovernanceStatus
  folder_id?: string | null
  tags?: string[]
  provenance?: Partial<ProvenanceMetadata>
}

export interface UpdateNodeInput {
  id: string
  title?: string
  content?: string
  type?: NodeType
  status?: GovernanceStatus
  folder_id?: string | null
  tags?: string[]
}

export interface CreateEdgeInput {
  source_id: string
  target_id: string
  type?: EdgeType
  weight?: number
  label?: string
  provenance?: Partial<ProvenanceMetadata>
}

// Search result with similarity score
export interface SearchResult {
  id: string
  title: string
  content: string
  type: NodeType
  status: GovernanceStatus
  similarity?: number
  rank?: number
}

// Graph context from traversal
export interface NodeContext {
  node_id: string
  node_title: string
  node_type: NodeType
  node_status: GovernanceStatus
  edge_type: EdgeType
  edge_weight: number
  direction: 'outgoing' | 'incoming'
  depth: number
}

// Toulmin argument model (AI output format)
export interface ToulminArgument {
  claim: string
  grounds: string[]
  warrant?: string
  qualifier?: number // 0.0 - 1.0 confidence
  rebuttal?: string
  backing?: string
}

// Graph visualization node
export interface GraphNode {
  id: string
  title: string
  type: NodeType
  status: GovernanceStatus
  x?: number
  y?: number
}

// Graph visualization edge
export interface GraphEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  status: GovernanceStatus
  weight: number
  label?: string
}

// --- UI Constants ---

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  Note: '노트',
  Claim: '주장',
  Evidence: '근거',
  Source: '출처',
  Person: '인물',
  Definition: '정의',
}

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  related_to: '관련',
  supports: '지지',
  refutes: '반박',
  defines: '정의',
  caused_by: '인과',
  derived_from: '파생',
  example_of: '예시',
  part_of: '구성',
}

export const STATUS_LABELS: Record<GovernanceStatus, string> = {
  Active: '활성',
  Experimental: '실험적',
  Deprecated: '폐기',
}

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  Note: '#6B7280',
  Claim: '#F59E0B',
  Evidence: '#3B82F6',
  Source: '#8B5CF6',
  Person: '#EC4899',
  Definition: '#10B981',
}

export const EDGE_TYPE_COLORS: Record<EdgeType, string> = {
  related_to: '#9CA3AF',
  supports: '#22C55E',
  refutes: '#EF4444',
  defines: '#3B82F6',
  caused_by: '#F97316',
  derived_from: '#A855F7',
  example_of: '#06B6D4',
  part_of: '#64748B',
}

export const STATUS_STYLES: Record<GovernanceStatus, { color: string; dash: boolean; opacity: number }> = {
  Active: { color: '#1F2937', dash: false, opacity: 1.0 },
  Experimental: { color: '#9CA3AF', dash: true, opacity: 0.6 },
  Deprecated: { color: '#D1D5DB', dash: true, opacity: 0.3 },
}
