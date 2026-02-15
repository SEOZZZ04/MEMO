-- =============================================================================
-- MEMO System Seed Data
-- =============================================================================
-- Run this AFTER the migration, replacing '<YOUR_USER_UUID>' with the actual
-- user UUID from Supabase Auth after first sign-up.
-- =============================================================================

-- To use: Replace all occurrences of '<YOUR_USER_UUID>' with your actual user ID.
-- You can find it in Supabase Dashboard > Authentication > Users

-- System Folders
INSERT INTO folders (user_id, name, slug, is_system, sort_order) VALUES
  ('<YOUR_USER_UUID>', 'Inbox',        'inbox',        true, 0),
  ('<YOUR_USER_UUID>', 'Knowledge Base','knowledge-base', true, 1),
  ('<YOUR_USER_UUID>', 'Archive',      'archive',      true, 2),
  ('<YOUR_USER_UUID>', 'Trash',        'trash',        true, 3);

-- Example: A welcome note to bootstrap the system
INSERT INTO nodes (user_id, folder_id, title, content, type, status, provenance) VALUES
(
  '<YOUR_USER_UUID>',
  (SELECT id FROM folders WHERE slug = 'inbox' AND user_id = '<YOUR_USER_UUID>'),
  'Welcome to MEMO',
  'This is your ontology-driven knowledge system. Every note you create becomes a node in your personal knowledge graph. Use types (Claim, Evidence, Source) and relationships (supports, refutes, caused_by) to build a structured understanding of your domain.',
  'Note',
  'Active',
  '{"creator": "User", "method": "manual"}'::jsonb
);
