// =============================================================================
// Supabase Database Type Definitions (Generated-style)
// =============================================================================

import type {
  NodeType,
  EdgeType,
  GovernanceStatus,
  CreatorType,
  ProvenanceAction,
  ProvenanceMetadata,
} from './ontology'

export interface Database {
  public: {
    Tables: {
      folders: {
        Row: {
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
        Insert: {
          id?: string
          user_id: string
          name: string
          slug: string
          is_system?: boolean
          parent_id?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          parent_id?: string | null
          sort_order?: number
        }
      }
      nodes: {
        Row: {
          id: string
          user_id: string
          folder_id: string | null
          title: string
          content: string
          type: NodeType
          status: GovernanceStatus
          provenance: ProvenanceMetadata
          embedding: number[] | null
          tags: string[]
          word_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          folder_id?: string | null
          title?: string
          content?: string
          type?: NodeType
          status?: GovernanceStatus
          provenance?: ProvenanceMetadata
          embedding?: number[] | null
          tags?: string[]
          word_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          folder_id?: string | null
          title?: string
          content?: string
          type?: NodeType
          status?: GovernanceStatus
          provenance?: ProvenanceMetadata
          embedding?: number[] | null
          tags?: string[]
          word_count?: number
        }
      }
      edges: {
        Row: {
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
        Insert: {
          id?: string
          user_id: string
          source_id: string
          target_id: string
          type?: EdgeType
          status?: GovernanceStatus
          weight?: number
          label?: string | null
          provenance?: ProvenanceMetadata
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: EdgeType
          status?: GovernanceStatus
          weight?: number
          label?: string | null
          provenance?: ProvenanceMetadata
        }
      }
      provenance_logs: {
        Row: {
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
        Insert: {
          id?: string
          user_id: string
          action: ProvenanceAction
          description?: string | null
          actor?: CreatorType
          model_id?: string | null
          model_version?: string | null
          target_node_id?: string | null
          target_edge_id?: string | null
          before_state?: Record<string, unknown> | null
          after_state?: Record<string, unknown> | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: never
      }
    }
    Functions: {
      search_nodes_by_embedding: {
        Args: {
          query_embedding: number[]
          match_user_id: string
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          title: string
          content: string
          type: NodeType
          status: GovernanceStatus
          similarity: number
        }[]
      }
      get_node_context: {
        Args: {
          p_node_id: string
          p_user_id: string
          p_depth?: number
        }
        Returns: {
          node_id: string
          node_title: string
          node_type: NodeType
          node_status: GovernanceStatus
          edge_type: EdgeType
          edge_weight: number
          direction: string
          depth: number
        }[]
      }
      search_nodes_by_text: {
        Args: {
          query_text: string
          match_user_id: string
          match_count?: number
        }
        Returns: {
          id: string
          title: string
          content: string
          type: NodeType
          status: GovernanceStatus
          rank: number
        }[]
      }
    }
  }
}
