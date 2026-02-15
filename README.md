# MEMO - Ontology Knowledge System

A personal knowledge management system built on **ontology-driven design** with **provenance tracking** and **governance lifecycle management**.

## Core Principles

- **Semantic Structure**: Every note is a typed node (`Claim`, `Evidence`, `Source`...), every connection is a typed edge (`supports`, `refutes`, `caused_by`...)
- **Governance**: All data has a lifecycle (`Active` / `Experimental` / `Deprecated`). AI-generated content requires explicit approval.
- **Provenance**: Full audit trail of who created what, when, and based on what evidence.

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: Gemini 2.5 Pro (Toulmin-model extraction)
- **Search**: Hybrid (pgvector + pg_trgm + graph traversal)

## Quick Start

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
npm install
npm run dev
```

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for full setup instructions including database migration and Edge Function deployment.
