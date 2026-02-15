# MEMO - Ontology Knowledge System: Setup Guide

## Architecture Overview

MEMO is an **ontology-driven personal knowledge system** built on 3 principles:

1. **Semantic Structure**: Every node has a type (`Claim`, `Evidence`, `Source`...), every edge has a link type (`supports`, `refutes`, `caused_by`...)
2. **Governance & Status**: All data has a lifecycle (`Active` → `Experimental` → `Deprecated`). AI-generated data is always `Experimental` until user approval.
3. **Provenance**: Every piece of data tracks who created it, when, how, and based on what.

**Tech Stack**: Vue 3 + TypeScript + Vite + Supabase (PostgreSQL + Edge Functions) + Gemini AI

---

## 1. Supabase Project Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Anon Key** from Settings → API

### 1.2 Run Migration Script

Open **SQL Editor** in Supabase Dashboard and execute the following migration script in its entirety:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================
-- ENUM TYPES
-- ============================

CREATE TYPE node_type AS ENUM (
  'Note', 'Claim', 'Evidence', 'Source', 'Person', 'Definition'
);

CREATE TYPE edge_type AS ENUM (
  'related_to', 'supports', 'refutes', 'defines',
  'caused_by', 'derived_from', 'example_of', 'part_of'
);

CREATE TYPE governance_status AS ENUM (
  'Active', 'Experimental', 'Deprecated'
);

CREATE TYPE creator_type AS ENUM ('User', 'AI');

CREATE TYPE provenance_action AS ENUM (
  'create', 'update', 'delete', 'merge', 'split',
  'approve', 'deprecate', 'extract_graph', 'summarize', 'link_suggest'
);

-- ============================
-- TABLES
-- ============================

-- Folders
CREATE TABLE folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  parent_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

-- Nodes (Knowledge Objects)
CREATE TABLE nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  folder_id   UUID REFERENCES folders(id) ON DELETE SET NULL,
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  type        node_type NOT NULL DEFAULT 'Note',
  status      governance_status NOT NULL DEFAULT 'Active',
  provenance  JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding   vector(1536),
  tags        TEXT[] DEFAULT '{}',
  word_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Edges (Semantic Relationships)
CREATE TABLE edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  source_id   UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type        edge_type NOT NULL DEFAULT 'related_to',
  status      governance_status NOT NULL DEFAULT 'Active',
  weight      REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0.0 AND weight <= 1.0),
  label       TEXT,
  provenance  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, target_id, type),
  CHECK (source_id != target_id)
);

-- Provenance Logs (Audit Trail)
CREATE TABLE provenance_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  action        provenance_action NOT NULL,
  description   TEXT,
  actor         creator_type NOT NULL DEFAULT 'User',
  model_id      TEXT,
  model_version TEXT,
  target_node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  target_edge_id UUID REFERENCES edges(id) ON DELETE SET NULL,
  before_state  JSONB,
  after_state   JSONB,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================
-- INDEXES
-- ============================

CREATE INDEX idx_folders_user ON folders(user_id);
CREATE INDEX idx_nodes_user ON nodes(user_id);
CREATE INDEX idx_nodes_folder ON nodes(folder_id);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_created ON nodes(created_at DESC);
CREATE INDEX idx_nodes_tags ON nodes USING GIN(tags);
CREATE INDEX idx_nodes_content_trgm ON nodes USING GIN(content gin_trgm_ops);
CREATE INDEX idx_nodes_title_trgm ON nodes USING GIN(title gin_trgm_ops);
CREATE INDEX idx_nodes_embedding ON nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_edges_user ON edges(user_id);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
CREATE INDEX idx_edges_type ON edges(type);
CREATE INDEX idx_edges_status ON edges(status);
CREATE INDEX idx_edges_source_type ON edges(source_id, type);
CREATE INDEX idx_edges_target_type ON edges(target_id, type);
CREATE INDEX idx_prov_user ON provenance_logs(user_id);
CREATE INDEX idx_prov_action ON provenance_logs(action);
CREATE INDEX idx_prov_actor ON provenance_logs(actor);
CREATE INDEX idx_prov_node ON provenance_logs(target_node_id);
CREATE INDEX idx_prov_edge ON provenance_logs(target_edge_id);
CREATE INDEX idx_prov_created ON provenance_logs(created_at DESC);

-- ============================
-- TRIGGERS
-- ============================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nodes_updated_at BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_edges_updated_at BEFORE UPDATE ON edges FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_folders_updated_at BEFORE UPDATE ON folders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================
-- RPC FUNCTIONS
-- ============================

-- Vector similarity search
CREATE OR REPLACE FUNCTION search_nodes_by_embedding(
  query_embedding vector(1536),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (id UUID, title TEXT, content TEXT, type node_type, status governance_status, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT n.id, n.title, n.content, n.type, n.status,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM nodes n
  WHERE n.user_id = match_user_id AND n.status != 'Deprecated'
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Graph traversal
CREATE OR REPLACE FUNCTION get_node_context(
  p_node_id UUID, p_user_id UUID, p_depth INT DEFAULT 1
)
RETURNS TABLE (
  node_id UUID, node_title TEXT, node_type node_type, node_status governance_status,
  edge_type edge_type, edge_weight REAL, direction TEXT, depth INT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE graph_walk AS (
    SELECT
      CASE WHEN e.source_id = p_node_id THEN e.target_id ELSE e.source_id END AS nid,
      e.type AS etype, e.weight AS eweight,
      CASE WHEN e.source_id = p_node_id THEN 'outgoing'::TEXT ELSE 'incoming'::TEXT END AS dir,
      1 AS d
    FROM edges e
    WHERE (e.source_id = p_node_id OR e.target_id = p_node_id)
      AND e.user_id = p_user_id AND e.status != 'Deprecated'
    UNION ALL
    SELECT
      CASE WHEN e.source_id = gw.nid THEN e.target_id ELSE e.source_id END,
      e.type, e.weight,
      CASE WHEN e.source_id = gw.nid THEN 'outgoing'::TEXT ELSE 'incoming'::TEXT END,
      gw.d + 1
    FROM edges e JOIN graph_walk gw ON (e.source_id = gw.nid OR e.target_id = gw.nid)
    WHERE gw.d < p_depth AND e.user_id = p_user_id AND e.status != 'Deprecated'
      AND CASE WHEN e.source_id = gw.nid THEN e.target_id ELSE e.source_id END != p_node_id
  )
  SELECT n.id, n.title, n.type, n.status, gw.etype, gw.eweight, gw.dir, gw.d
  FROM graph_walk gw JOIN nodes n ON n.id = gw.nid
  WHERE n.status != 'Deprecated';
END;
$$;

-- Text search (trigram)
CREATE OR REPLACE FUNCTION search_nodes_by_text(
  query_text TEXT, match_user_id UUID, match_count INT DEFAULT 20
)
RETURNS TABLE (id UUID, title TEXT, content TEXT, type node_type, status governance_status, rank REAL)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT n.id, n.title, n.content, n.type, n.status,
    GREATEST(similarity(n.title, query_text), similarity(n.content, query_text)) AS rank
  FROM nodes n
  WHERE n.user_id = match_user_id AND n.status != 'Deprecated'
    AND (n.title % query_text OR n.content % query_text)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- ============================
-- ROW LEVEL SECURITY
-- ============================

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY folders_user_policy ON folders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY nodes_user_policy ON nodes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY edges_user_policy ON edges FOR ALL USING (auth.uid() = user_id);
CREATE POLICY provenance_logs_user_policy ON provenance_logs FOR ALL USING (auth.uid() = user_id);

-- ============================
-- VIEWS
-- ============================

CREATE OR REPLACE VIEW inbox_nodes AS
SELECT n.*, f.name AS folder_name,
  (SELECT count(*) FROM edges e WHERE e.source_id = n.id OR e.target_id = n.id) AS edge_count
FROM nodes n LEFT JOIN folders f ON n.folder_id = f.id
WHERE n.status = 'Experimental'
ORDER BY n.created_at DESC;

CREATE OR REPLACE VIEW argumentation_graph AS
SELECT c.id AS claim_id, c.title AS claim_title, c.content AS claim_content,
  c.status AS claim_status, e.type AS relationship,
  ev.id AS evidence_id, ev.title AS evidence_title, ev.type AS evidence_type, e.weight AS confidence
FROM nodes c
JOIN edges e ON e.source_id = c.id OR e.target_id = c.id
JOIN nodes ev ON (CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END = ev.id)
WHERE c.type = 'Claim' AND e.type IN ('supports', 'refutes')
ORDER BY c.created_at DESC, e.type, e.weight DESC;
```

> **Note**: The full migration file is also at `supabase/migrations/001_ontology_schema.sql`.

### 1.3 Seed System Data

After creating your first user account, replace `<YOUR_USER_UUID>` in `supabase/seed/001_system_data.sql` and run:

```sql
-- Replace <YOUR_USER_UUID> with your actual user UUID from Auth > Users

INSERT INTO folders (user_id, name, slug, is_system, sort_order) VALUES
  ('<YOUR_USER_UUID>', 'Inbox',         'inbox',         true, 0),
  ('<YOUR_USER_UUID>', 'Knowledge Base', 'knowledge-base', true, 1),
  ('<YOUR_USER_UUID>', 'Archive',       'archive',       true, 2),
  ('<YOUR_USER_UUID>', 'Trash',         'trash',         true, 3);
```

---

## 2. Edge Functions Setup

### 2.1 Set Environment Variables (Secrets)

In Supabase Dashboard → Edge Functions → Secrets, add:

| Key | Description |
|-----|-------------|
| `GOOGLE_API_KEY` | Google AI API key for Gemini 2.5 Pro |
| `OPENAI_API_KEY` | OpenAI API key (for embeddings, optional) |

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions.

Or via CLI:

```bash
supabase secrets set GOOGLE_API_KEY=your-google-api-key
supabase secrets set OPENAI_API_KEY=your-openai-api-key
```

### 2.2 Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy extract-graph
supabase functions deploy ai-analyze
```

---

## 3. Frontend Setup

### 3.1 Environment Variables

Create `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3.2 Install & Run

```bash
npm install
npm run dev
```

---

## 4. Render Deployment

### 4.1 Required Environment Variables

When deploying to Render, set these environment variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://your-project-id.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NODE_VERSION` | `20` |

### 4.2 Build Settings

| Setting | Value |
|---------|-------|
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

---

## 5. Data Model Reference

### Node Types (`node_type`)

| Type | Description | Korean |
|------|-------------|--------|
| `Note` | General note (default) | 노트 |
| `Claim` | An assertion or argument | 주장 |
| `Evidence` | Supporting/refuting evidence | 근거 |
| `Source` | External reference | 출처 |
| `Person` | A person entity | 인물 |
| `Definition` | A concept definition | 정의 |

### Edge Types (`edge_type`)

| Type | Color | Description | Korean |
|------|-------|-------------|--------|
| `related_to` | Gray | Generic association | 관련 |
| `supports` | Green | Evidence supports claim | 지지 |
| `refutes` | Red | Evidence contradicts claim | 반박 |
| `defines` | Blue | Defines a concept | 정의 |
| `caused_by` | Orange | Causal relationship | 인과 |
| `derived_from` | Purple | Derived from another | 파생 |
| `example_of` | Cyan | Exemplification | 예시 |
| `part_of` | Slate | Part-whole | 구성 |

### Governance Status (`governance_status`)

| Status | UI Style | Description |
|--------|----------|-------------|
| `Active` | Solid line, full opacity | Verified and trusted |
| `Experimental` | Dashed line, 60% opacity | AI-generated or unverified |
| `Deprecated` | Dashed line, 30% opacity | Retracted or superseded |

### Provenance JSONB Schema

```json
{
  "creator": "User | AI",
  "model": "gemini-2.5-pro | null",
  "model_version": "... | null",
  "source_node_id": "uuid | null",
  "confidence": 0.85,
  "method": "extract_graph | summarize | manual | link_suggest"
}
```
