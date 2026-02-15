# MEMO - Ontology Knowledge System: Complete Setup Guide

> **2nd Generation AI Notepad** — Ontology-Driven, Provenance-First, Zero Knowledge Debt

---

## Quick Reference Checklist

- [ ] **Step 1.** Create Supabase project
- [ ] **Step 2.** Run migration SQL in SQL Editor
- [ ] **Step 3.** Get Google AI API key
- [ ] **Step 4.** Get OpenAI API key
- [ ] **Step 5.** Set Edge Function secrets
- [ ] **Step 6.** Deploy 4 Edge Functions
- [ ] **Step 7.** Create `.env` file locally
- [ ] **Step 8.** `npm install && npm run dev`
- [ ] **Step 9.** Sign up & run seed SQL
- [ ] **Step 10.** (Optional) Deploy to Render

---

## Architecture Overview

```
 +------------------+     +-------------------+     +------------------+
 | LEFT PANE        |     | CENTER PANE       |     | RIGHT PANE       |
 | - Folder Tree    |     | - TipTap Editor   |     | - Model Switcher |
 | - Tag List       |     | - [[ Wiki Links   |     | - Local Graph    |
 | - Notes List     |     | - Orphan Alert    |     | - Similar Context|
 +------------------+     +-------------------+     +------------------+
          |                        |                         |
          +------------------------+-------------------------+
                                   |
                         +-------------------+
                         |  Supabase Backend |
                         | - PostgreSQL      |
                         | - pgvector        |
                         | - Edge Functions  |
                         +-------------------+
                           |             |
                    +------+------+  +---+---+
                    | Google AI   |  | OpenAI|
                    | Gemini 2.5  |  | GPT-4o|
                    +-------------+  +-------+
```

**Tech Stack**: Vue 3 + TipTap + TypeScript + Vite + Supabase + Gemini + OpenAI

---

## 1. Supabase Project Setup

### 1.1 Create Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Choose a name (e.g., `memo-knowledge`)
4. Set a strong database password (save it!)
5. Select the region closest to you
6. Click **"Create new project"** and wait ~2 minutes

### 1.2 Get Your Keys

Go to **Settings > API** and note:

| Key | Where to find it | Used in |
|-----|-------------------|---------|
| **Project URL** | `https://xxxxx.supabase.co` | `.env` as `VITE_SUPABASE_URL` |
| **anon public** key | Under "Project API keys" | `.env` as `VITE_SUPABASE_ANON_KEY` |
| **service_role** key | Under "Project API keys" (click "Reveal") | Edge Functions (auto-injected) |
| **Project Ref** | In the URL: `supabase.com/dashboard/project/<ref>` | CLI linking |

### 1.3 Enable pgvector Extension

1. Go to **Database > Extensions**
2. Search for `vector` and enable it
3. Search for `pg_trgm` and enable it

### 1.4 Run Migration SQL

Go to **SQL Editor** and paste this **entire script** and click **Run**:

```sql
-- =============================================================
-- MEMO Ontology Knowledge System - Full Migration
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enum Types
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

-- Tables
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  type node_type NOT NULL DEFAULT 'Note',
  status governance_status NOT NULL DEFAULT 'Active',
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  tags TEXT[] DEFAULT '{}',
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type edge_type NOT NULL DEFAULT 'related_to',
  status governance_status NOT NULL DEFAULT 'Active',
  weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0.0 AND weight <= 1.0),
  label TEXT,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, target_id, type),
  CHECK (source_id != target_id)
);

CREATE TABLE provenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action provenance_action NOT NULL,
  description TEXT,
  actor creator_type NOT NULL DEFAULT 'User',
  model_id TEXT,
  model_version TEXT,
  target_node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  target_edge_id UUID REFERENCES edges(id) ON DELETE SET NULL,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
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

-- Triggers
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

-- RPC Functions
CREATE OR REPLACE FUNCTION search_nodes_by_embedding(
  query_embedding vector(1536), match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7, match_count INT DEFAULT 10
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
  ORDER BY n.embedding <=> query_embedding LIMIT match_count;
END; $$;

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
      CASE WHEN e.source_id = p_node_id THEN 'outgoing'::TEXT ELSE 'incoming'::TEXT END AS dir, 1 AS d
    FROM edges e
    WHERE (e.source_id = p_node_id OR e.target_id = p_node_id)
      AND e.user_id = p_user_id AND e.status != 'Deprecated'
    UNION ALL
    SELECT
      CASE WHEN e.source_id = gw.nid THEN e.target_id ELSE e.source_id END,
      e.type, e.weight,
      CASE WHEN e.source_id = gw.nid THEN 'outgoing'::TEXT ELSE 'incoming'::TEXT END, gw.d + 1
    FROM edges e JOIN graph_walk gw ON (e.source_id = gw.nid OR e.target_id = gw.nid)
    WHERE gw.d < p_depth AND e.user_id = p_user_id AND e.status != 'Deprecated'
      AND CASE WHEN e.source_id = gw.nid THEN e.target_id ELSE e.source_id END != p_node_id
  )
  SELECT n.id, n.title, n.type, n.status, gw.etype, gw.eweight, gw.dir, gw.d
  FROM graph_walk gw JOIN nodes n ON n.id = gw.nid WHERE n.status != 'Deprecated';
END; $$;

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
  ORDER BY rank DESC LIMIT match_count;
END; $$;

-- Row Level Security
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY folders_user_policy ON folders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY nodes_user_policy ON nodes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY edges_user_policy ON edges FOR ALL USING (auth.uid() = user_id);
CREATE POLICY provenance_logs_user_policy ON provenance_logs FOR ALL USING (auth.uid() = user_id);

-- Views
CREATE OR REPLACE VIEW inbox_nodes AS
SELECT n.*, f.name AS folder_name,
  (SELECT count(*) FROM edges e WHERE e.source_id = n.id OR e.target_id = n.id) AS edge_count
FROM nodes n LEFT JOIN folders f ON n.folder_id = f.id
WHERE n.status = 'Experimental' ORDER BY n.created_at DESC;

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

> Full file also available at `supabase/migrations/001_ontology_schema.sql`

---

## 2. API Keys Setup

### 2.1 Google AI API Key (Required)

Used for: Gemini 2.5 Flash (speed/summarization), graph extraction

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **"Create API Key"**
3. Copy the key — it starts with `AIza...`

> **Important**: Google AI Studio API has a free tier. Enable billing if you need higher rate limits.

### 2.2 OpenAI API Key (Required for GraphRAG & Embeddings)

Used for: GPT-4o Mini (reasoning), text-embedding-3-small (vector search)

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Copy the key — it starts with `sk-...`

> **Important**: OpenAI requires prepaid credits. Add $5-10 for development usage. The `text-embedding-3-small` model costs ~$0.02 per 1M tokens.

---

## 3. Edge Functions Deployment

### 3.1 Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# npm (any platform)
npm install -g supabase

# Verify
supabase --version
```

### 3.2 Login and Link Project

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

Your project ref is in the Supabase Dashboard URL: `supabase.com/dashboard/project/<ref>`

### 3.3 Set Secrets (Environment Variables)

```bash
supabase secrets set GOOGLE_API_KEY=AIzaSy...your-google-key
supabase secrets set OPENAI_API_KEY=sk-...your-openai-key
```

The following are **auto-injected** by Supabase (do NOT set manually):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3.4 Deploy All 4 Edge Functions

```bash
supabase functions deploy extract-graph
supabase functions deploy ai-analyze
supabase functions deploy find-similar
supabase functions deploy graph-rag
```

| Function | Purpose | Trigger |
|----------|---------|---------|
| `extract-graph` | Extract Claims/Evidence/Edges from text (Toulmin model) | On note save |
| `ai-analyze` | Summarize, suggest links, check argumentation | Manual/AI |
| `find-similar` | Real-time similar note recommendations | Editor typing |
| `graph-rag` | Hybrid search (Vector + Graph) → LLM answer | Search query |

---

## 4. Frontend Setup

### 4.1 Create `.env` file

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.2 Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### 4.3 First-Time Setup

1. **Sign up** with email/password on the login page
2. Go to **Supabase Dashboard > Authentication > Users** and copy your **User UUID**
3. Run the seed SQL in **SQL Editor** (replace `<YOUR_USER_UUID>`):

```sql
INSERT INTO folders (user_id, name, slug, is_system, sort_order) VALUES
  ('<YOUR_USER_UUID>', 'Inbox',          'inbox',          true, 0),
  ('<YOUR_USER_UUID>', 'Knowledge Base', 'knowledge-base', true, 1),
  ('<YOUR_USER_UUID>', 'Archive',        'archive',        true, 2),
  ('<YOUR_USER_UUID>', 'Trash',          'trash',          true, 3);
```

---

## 5. Render Deployment

### 5.1 Environment Variables

Set these in Render Dashboard > Environment:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Yes |
| `NODE_VERSION` | `20` | Yes |

### 5.2 Build Configuration

| Setting | Value |
|---------|-------|
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

### 5.3 Vercel Alternative

If using Vercel instead of Render:

```bash
npm install -g vercel
vercel
# Follow prompts, set environment variables in Vercel Dashboard
```

---

## 6. Feature Reference

### UI Layout: Tri-Pane Context Interface

| Pane | Components | Purpose |
|------|-----------|---------|
| **Left** (260px) | FolderTree, TagList, Notes List | Navigation & filtering |
| **Center** (flex) | TipTap Editor, Search | Writing with `[[wiki-links]]`, Orphan alerts |
| **Right** (320px) | Local Graph, Similar Context, Model Switcher | Intelligence & context |

### AI Models

| Model | Provider | Use Case | Speed |
|-------|----------|----------|-------|
| Gemini 2.5 Flash | Google | Summarization, extraction | Fast |
| GPT-4o Mini | OpenAI | Deep reasoning, analysis | Medium |

### Key Features

| Feature | How it works |
|---------|-------------|
| **Wiki Links** | Type `[[` in editor to search and link notes. Triggers edge type selection. |
| **Orphan Alert** | If a saved note has zero edges, a toast appears suggesting tags or links. |
| **Similar Context** | While writing (30+ chars), the right panel shows top-3 similar past notes in real-time. |
| **GraphRAG Search** | Question → Embed → Vector Search → Graph Neighbors → LLM Answer with `[Source N]` citations. |
| **Governance** | AI-generated nodes/edges are `Experimental` (dashed). Click "Approve" to make `Active`. |

### Data Model

#### Node Types

| Type | Icon Color | Korean | Description |
|------|-----------|--------|-------------|
| `Note` | Gray | 노트 | General note |
| `Claim` | Amber | 주장 | An assertion |
| `Evidence` | Blue | 근거 | Supporting data |
| `Source` | Purple | 출처 | External reference |
| `Person` | Pink | 인물 | Person entity |
| `Definition` | Green | 정의 | Concept definition |

#### Edge Types

| Type | Color | Korean | Description |
|------|-------|--------|-------------|
| `supports` | Green | 지지 | Evidence backs claim |
| `refutes` | Red | 반박 | Evidence contradicts claim |
| `defines` | Blue | 정의 | Defines a concept |
| `caused_by` | Orange | 인과 | Causal relationship |
| `related_to` | Gray | 관련 | Generic association |
| `derived_from` | Purple | 파생 | Derived from another |
| `example_of` | Cyan | 예시 | Exemplification |
| `part_of` | Slate | 구성 | Part-whole |

#### Governance Status

| Status | Style | Meaning |
|--------|-------|---------|
| `Active` | Solid, 100% opacity | Verified & trusted |
| `Experimental` | Dashed, 60% opacity | AI-generated, needs review |
| `Deprecated` | Dashed, 30% opacity | Retracted or superseded |
