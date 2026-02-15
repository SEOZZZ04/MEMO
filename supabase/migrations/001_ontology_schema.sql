-- =============================================================================
-- MEMO Ontology Knowledge System - Database Schema Migration
-- =============================================================================
-- Philosophy: Ontology-Driven & Provenance-First
--   1. Semantic Structure: Every node has a type, every edge has a link type
--   2. Governance & Status: All data has a lifecycle (Active/Experimental/Deprecated)
--   3. Provenance: "Who created it, when, and based on what evidence?"
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram for fuzzy text search

-- =============================================================================
-- 1. ENUM TYPES
-- =============================================================================

-- Node Object Types (Semantic Layer)
CREATE TYPE node_type AS ENUM (
  'Note',        -- General note (default)
  'Claim',       -- An assertion or argument
  'Evidence',    -- Supporting or refuting evidence
  'Source',      -- External reference (URL, paper, book)
  'Person',      -- A person entity
  'Definition'   -- A concept definition
);

-- Edge Link Types (Relationship Semantics)
CREATE TYPE edge_type AS ENUM (
  'related_to',  -- Generic association (default)
  'supports',    -- Evidence supports a claim
  'refutes',     -- Evidence contradicts a claim
  'defines',     -- Defines a concept
  'caused_by',   -- Causal relationship
  'derived_from',-- One node is derived from another
  'example_of',  -- Exemplification
  'part_of'      -- Composition / part-whole
);

-- Governance Status (Knowledge Lifecycle)
CREATE TYPE governance_status AS ENUM (
  'Active',       -- Verified and trusted
  'Experimental', -- AI-generated or unverified
  'Deprecated'    -- Superseded, retracted, or disproven
);

-- Provenance Creator Types
CREATE TYPE creator_type AS ENUM (
  'User',
  'AI'
);

-- Provenance Action Types (for audit log)
CREATE TYPE provenance_action AS ENUM (
  'create',
  'update',
  'delete',
  'merge',
  'split',
  'approve',       -- Experimental -> Active
  'deprecate',     -- * -> Deprecated
  'extract_graph', -- AI extracted graph from text
  'summarize',     -- AI summarized content
  'link_suggest'   -- AI suggested a link
);

-- =============================================================================
-- 2. FOLDERS TABLE (System & User Folders)
-- =============================================================================

CREATE TABLE folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT false,  -- System folders cannot be deleted
  parent_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

CREATE INDEX idx_folders_user ON folders(user_id);

-- =============================================================================
-- 3. NODES TABLE (Objects / Knowledge Units)
-- =============================================================================

CREATE TABLE nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  folder_id   UUID REFERENCES folders(id) ON DELETE SET NULL,

  -- Content
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',

  -- Semantic Layer
  type        node_type NOT NULL DEFAULT 'Note',
  status      governance_status NOT NULL DEFAULT 'Active',

  -- Provenance (embedded metadata)
  provenance  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Expected shape:
  -- {
  --   "creator": "User" | "AI",
  --   "model": "gemini-2.5-pro" | null,
  --   "model_version": "..." | null,
  --   "source_node_id": "uuid" | null,
  --   "confidence": 0.0-1.0 | null,
  --   "method": "extract_graph" | "summarize" | "manual" | null
  -- }

  -- Vector embedding for semantic search (1536 dimensions for OpenAI, 768 for others)
  embedding   vector(1536),

  -- Metadata
  tags        TEXT[] DEFAULT '{}',
  word_count  INTEGER DEFAULT 0,

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for nodes
CREATE INDEX idx_nodes_user        ON nodes(user_id);
CREATE INDEX idx_nodes_folder      ON nodes(folder_id);
CREATE INDEX idx_nodes_type        ON nodes(type);
CREATE INDEX idx_nodes_status      ON nodes(status);
CREATE INDEX idx_nodes_created     ON nodes(created_at DESC);
CREATE INDEX idx_nodes_tags        ON nodes USING GIN(tags);
CREATE INDEX idx_nodes_content_trgm ON nodes USING GIN(content gin_trgm_ops);
CREATE INDEX idx_nodes_title_trgm  ON nodes USING GIN(title gin_trgm_ops);

-- Vector similarity search index (IVFFlat for performance)
CREATE INDEX idx_nodes_embedding ON nodes
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- =============================================================================
-- 4. EDGES TABLE (Links / Semantic Relationships)
-- =============================================================================

CREATE TABLE edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,

  -- Directed graph: source -> target
  source_id   UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,

  -- Semantic Layer
  type        edge_type NOT NULL DEFAULT 'related_to',
  status      governance_status NOT NULL DEFAULT 'Active',

  -- Relationship strength (0.0 to 1.0)
  weight      REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0.0 AND weight <= 1.0),

  -- Optional label for UI display
  label       TEXT,

  -- Provenance
  provenance  JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate edges of the same type between same nodes
  UNIQUE(source_id, target_id, type),

  -- Prevent self-referencing edges
  CHECK (source_id != target_id)
);

-- Indexes for edges
CREATE INDEX idx_edges_user     ON edges(user_id);
CREATE INDEX idx_edges_source   ON edges(source_id);
CREATE INDEX idx_edges_target   ON edges(target_id);
CREATE INDEX idx_edges_type     ON edges(type);
CREATE INDEX idx_edges_status   ON edges(status);

-- Composite index for graph traversal (source + type)
CREATE INDEX idx_edges_source_type ON edges(source_id, type);
CREATE INDEX idx_edges_target_type ON edges(target_id, type);

-- =============================================================================
-- 5. PROVENANCE LOGS TABLE (Audit Trail / Activity Log)
-- =============================================================================

CREATE TABLE provenance_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,

  -- What happened
  action        provenance_action NOT NULL,
  description   TEXT,

  -- Who did it
  actor         creator_type NOT NULL DEFAULT 'User',
  model_id      TEXT,           -- e.g., "gemini-2.5-pro"
  model_version TEXT,

  -- What was affected
  target_node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  target_edge_id UUID REFERENCES edges(id) ON DELETE SET NULL,

  -- Before/After snapshots for undo capability
  before_state  JSONB,
  after_state   JSONB,

  -- Additional context
  metadata      JSONB DEFAULT '{}'::jsonb,
  -- e.g., { "prompt": "...", "tokens_used": 150, "source_nodes": ["uuid1", "uuid2"] }

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for provenance logs
CREATE INDEX idx_prov_user       ON provenance_logs(user_id);
CREATE INDEX idx_prov_action     ON provenance_logs(action);
CREATE INDEX idx_prov_actor      ON provenance_logs(actor);
CREATE INDEX idx_prov_node       ON provenance_logs(target_node_id);
CREATE INDEX idx_prov_edge       ON provenance_logs(target_edge_id);
CREATE INDEX idx_prov_created    ON provenance_logs(created_at DESC);

-- =============================================================================
-- 6. HELPER FUNCTIONS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nodes_updated_at
  BEFORE UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_edges_updated_at
  BEFORE UPDATE ON edges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 7. SEMANTIC SEARCH FUNCTION (Hybrid: Vector + Graph Traversal)
-- =============================================================================

-- Vector similarity search
CREATE OR REPLACE FUNCTION search_nodes_by_embedding(
  query_embedding vector(1536),
  match_user_id   UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count     INT DEFAULT 10
)
RETURNS TABLE (
  id         UUID,
  title      TEXT,
  content    TEXT,
  type       node_type,
  status     governance_status,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.content,
    n.type,
    n.status,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM nodes n
  WHERE n.user_id = match_user_id
    AND n.status != 'Deprecated'
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Graph traversal: get neighbors of a node with relationship context
CREATE OR REPLACE FUNCTION get_node_context(
  p_node_id   UUID,
  p_user_id   UUID,
  p_depth     INT DEFAULT 1
)
RETURNS TABLE (
  node_id       UUID,
  node_title    TEXT,
  node_type     node_type,
  node_status   governance_status,
  edge_type     edge_type,
  edge_weight   REAL,
  direction     TEXT,      -- 'outgoing' or 'incoming'
  depth         INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE graph_walk AS (
    -- Base case: direct neighbors
    SELECT
      CASE WHEN e.source_id = p_node_id THEN e.target_id ELSE e.source_id END AS nid,
      e.type AS etype,
      e.weight AS eweight,
      CASE WHEN e.source_id = p_node_id THEN 'outgoing'::TEXT ELSE 'incoming'::TEXT END AS dir,
      1 AS d
    FROM edges e
    WHERE (e.source_id = p_node_id OR e.target_id = p_node_id)
      AND e.user_id = p_user_id
      AND e.status != 'Deprecated'

    UNION ALL

    -- Recursive case (controlled by p_depth)
    SELECT
      CASE WHEN e.source_id = gw.nid THEN e.target_id ELSE e.source_id END,
      e.type,
      e.weight,
      CASE WHEN e.source_id = gw.nid THEN 'outgoing'::TEXT ELSE 'incoming'::TEXT END,
      gw.d + 1
    FROM edges e
    JOIN graph_walk gw ON (e.source_id = gw.nid OR e.target_id = gw.nid)
    WHERE gw.d < p_depth
      AND e.user_id = p_user_id
      AND e.status != 'Deprecated'
      AND CASE WHEN e.source_id = gw.nid THEN e.target_id ELSE e.source_id END != p_node_id
  )
  SELECT
    n.id,
    n.title,
    n.type,
    n.status,
    gw.etype,
    gw.eweight,
    gw.dir,
    gw.d
  FROM graph_walk gw
  JOIN nodes n ON n.id = gw.nid
  WHERE n.status != 'Deprecated';
END;
$$;

-- Full-text + trigram search
CREATE OR REPLACE FUNCTION search_nodes_by_text(
  query_text    TEXT,
  match_user_id UUID,
  match_count   INT DEFAULT 20
)
RETURNS TABLE (
  id         UUID,
  title      TEXT,
  content    TEXT,
  type       node_type,
  status     governance_status,
  rank       REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.content,
    n.type,
    n.status,
    GREATEST(
      similarity(n.title, query_text),
      similarity(n.content, query_text)
    ) AS rank
  FROM nodes n
  WHERE n.user_id = match_user_id
    AND n.status != 'Deprecated'
    AND (
      n.title % query_text
      OR n.content % query_text
    )
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_logs ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY folders_user_policy ON folders
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY nodes_user_policy ON nodes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY edges_user_policy ON edges
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY provenance_logs_user_policy ON provenance_logs
  FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 9. VIEWS (Convenience Queries)
-- =============================================================================

-- Inbox view: Experimental nodes awaiting review
CREATE OR REPLACE VIEW inbox_nodes AS
SELECT
  n.*,
  f.name AS folder_name,
  (SELECT count(*) FROM edges e WHERE e.source_id = n.id OR e.target_id = n.id) AS edge_count
FROM nodes n
LEFT JOIN folders f ON n.folder_id = f.id
WHERE n.status = 'Experimental'
ORDER BY n.created_at DESC;

-- Argumentation view: Claims with their supporting/refuting evidence
CREATE OR REPLACE VIEW argumentation_graph AS
SELECT
  c.id AS claim_id,
  c.title AS claim_title,
  c.content AS claim_content,
  c.status AS claim_status,
  e.type AS relationship,
  ev.id AS evidence_id,
  ev.title AS evidence_title,
  ev.type AS evidence_type,
  e.weight AS confidence
FROM nodes c
JOIN edges e ON e.source_id = c.id OR e.target_id = c.id
JOIN nodes ev ON (
  CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END = ev.id
)
WHERE c.type = 'Claim'
  AND e.type IN ('supports', 'refutes')
ORDER BY c.created_at DESC, e.type, e.weight DESC;
