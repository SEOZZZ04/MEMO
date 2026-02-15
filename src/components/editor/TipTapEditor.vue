<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import { createWikiLinkMention } from './WikiLinkExtension'
import EdgeTypePicker from '../common/EdgeTypePicker.vue'
import StatusBadge from '../common/StatusBadge.vue'
import NodeTypeBadge from '../common/NodeTypeBadge.vue'
import type {
  Node as MemoNode,
  NodeType,
  EdgeType,
  CreateNodeInput,
  UpdateNodeInput,
} from '../../types/ontology'
import { NODE_TYPE_LABELS } from '../../types/ontology'

const props = defineProps<{
  node?: MemoNode | null
  allNodes: { id: string; title: string }[]
}>()

const emit = defineEmits<{
  save: [input: CreateNodeInput | UpdateNodeInput]
  approve: [id: string]
  deprecate: [id: string]
  'create-edge': [payload: { sourceId: string; targetId: string; edgeType: EdgeType }]
  'content-change': [text: string]
  'check-orphan': [nodeId: string]
}>()

const title = ref('')
const nodeType = ref<NodeType>('Note')
const tags = ref<string[]>([])
const tagInput = ref('')
const showEdgePicker = ref(false)
const pendingLink = ref<{ id: string; label: string } | null>(null)

const isEditing = computed(() => !!props.node)
const nodeTypes: NodeType[] = ['Note', 'Claim', 'Evidence', 'Source', 'Person', 'Definition']

// --- TipTap Editor ---

const wikiLinkMention = createWikiLinkMention(
  // Search function for [[ autocomplete
  async (query: string) => {
    const q = query.toLowerCase()
    return props.allNodes
      .filter((n) => n.title.toLowerCase().includes(q))
      .slice(0, 8)
      .map((n) => ({ id: n.id, label: n.title }))
  },
  // On selection — trigger edge type picker
  (item: { id: string; label: string }) => {
    pendingLink.value = item
    showEdgePicker.value = true
  }
)

const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: 'Start writing... Use [[ to link to another note.',
    }),
    Highlight,
    Link.configure({ openOnClick: false }),
    wikiLinkMention,
  ],
  content: '',
  onUpdate({ editor: ed }) {
    emit('content-change', ed.getText())
  },
})

// Sync editor content with node prop
watch(
  () => props.node,
  (node) => {
    if (node) {
      title.value = node.title
      nodeType.value = node.type
      tags.value = [...node.tags]
      if (editor.value && editor.value.getHTML() !== node.content) {
        editor.value.commands.setContent(node.content || '')
      }
    } else {
      title.value = ''
      nodeType.value = 'Note'
      tags.value = []
      editor.value?.commands.clearContent()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

// --- Actions ---

function getEditorContent(): string {
  return editor.value?.getHTML() ?? ''
}

function handleSave() {
  const content = getEditorContent()

  if (isEditing.value && props.node) {
    const input: UpdateNodeInput = {
      id: props.node.id,
      title: title.value,
      content,
      type: nodeType.value,
      tags: tags.value,
    }
    emit('save', input)
    // After save, check for orphan status
    emit('check-orphan', props.node.id)
  } else {
    const input: CreateNodeInput = {
      title: title.value,
      content,
      type: nodeType.value,
      tags: tags.value,
    }
    emit('save', input)
  }
}

function addTag() {
  const tag = tagInput.value.trim()
  if (tag && !tags.value.includes(tag)) {
    tags.value.push(tag)
    tagInput.value = ''
  }
}

function removeTag(index: number) {
  tags.value.splice(index, 1)
}

function handleEdgeTypeSelected(edgeType: EdgeType) {
  if (pendingLink.value && props.node) {
    emit('create-edge', {
      sourceId: props.node.id,
      targetId: pendingLink.value.id,
      edgeType,
    })
  }
  showEdgePicker.value = false
  pendingLink.value = null
}

const wordCount = computed(() => {
  const text = editor.value?.getText() ?? ''
  return text.split(/\s+/).filter(Boolean).length
})
</script>

<template>
  <div class="tiptap-editor">
    <!-- Header bar -->
    <div class="editor-topbar">
      <div class="topbar-left">
        <select v-model="nodeType" class="type-select">
          <option v-for="t in nodeTypes" :key="t" :value="t">
            {{ NODE_TYPE_LABELS[t] }}
          </option>
        </select>
        <template v-if="node">
          <StatusBadge :status="node.status" />
          <NodeTypeBadge :type="node.type" />
          <span class="provenance-tag" v-if="node.provenance.creator === 'AI'">
            AI · {{ node.provenance.model ?? '?' }}
          </span>
        </template>
      </div>
      <div class="topbar-right">
        <button
          v-if="node?.status === 'Experimental'"
          class="btn btn-sm btn-approve"
          @click="emit('approve', node!.id)"
        >Approve</button>
        <button
          v-if="node && node.status !== 'Deprecated'"
          class="btn btn-sm btn-deprecate"
          @click="emit('deprecate', node.id)"
        >Deprecate</button>
        <button
          class="btn btn-sm btn-save"
          @click="handleSave"
          :disabled="!title.trim()"
        >{{ isEditing ? 'Save' : 'Create' }}</button>
      </div>
    </div>

    <!-- Title -->
    <input
      v-model="title"
      class="editor-title"
      placeholder="Untitled"
      @keydown.enter.prevent
    />

    <!-- TipTap Content -->
    <div class="editor-body">
      <EditorContent :editor="editor" class="tiptap-content" />
    </div>

    <!-- Tags bar -->
    <div class="editor-tags">
      <div class="tags-list">
        <span v-for="(tag, i) in tags" :key="tag" class="tag">
          #{{ tag }}
          <button class="tag-x" @click="removeTag(i)">&times;</button>
        </span>
        <input
          v-model="tagInput"
          class="tag-input"
          placeholder="Add tag..."
          @keydown.enter.prevent="addTag"
        />
      </div>
      <span class="word-count">{{ wordCount }} words</span>
    </div>

    <!-- Edge Type Picker (triggered by [[ link selection) -->
    <EdgeTypePicker
      :show="showEdgePicker"
      @update:model-value="handleEdgeTypeSelected"
      @close="showEdgePicker = false"
    />
  </div>
</template>

<style scoped>
.tiptap-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

/* Top bar */
.editor-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  border-bottom: 1px solid #F3F4F6;
  gap: 8px;
  flex-shrink: 0;
}

.topbar-left, .topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-select {
  padding: 3px 6px;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  font-size: 0.8rem;
  background: white;
  color: #374151;
}

.provenance-tag {
  font-size: 0.7rem;
  padding: 2px 6px;
  background: #FEF3C7;
  color: #92400E;
  border-radius: 4px;
}

/* Title */
.editor-title {
  font-size: 1.6rem;
  font-weight: 700;
  border: none;
  outline: none;
  padding: 16px 20px 8px;
  color: #111827;
  flex-shrink: 0;
}

.editor-title::placeholder {
  color: #D1D5DB;
}

/* TipTap body */
.editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}

.tiptap-content {
  min-height: 200px;
}

.tiptap-content :deep(.tiptap) {
  outline: none;
  font-size: 0.95rem;
  line-height: 1.75;
  color: #374151;
}

.tiptap-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: #D1D5DB;
  pointer-events: none;
  float: left;
  height: 0;
}

.tiptap-content :deep(.tiptap h1) { font-size: 1.4rem; font-weight: 700; margin: 1em 0 0.5em; }
.tiptap-content :deep(.tiptap h2) { font-size: 1.2rem; font-weight: 600; margin: 1em 0 0.4em; }
.tiptap-content :deep(.tiptap h3) { font-size: 1.05rem; font-weight: 600; margin: 0.8em 0 0.3em; }
.tiptap-content :deep(.tiptap ul),
.tiptap-content :deep(.tiptap ol) { padding-left: 1.5em; }
.tiptap-content :deep(.tiptap blockquote) {
  border-left: 3px solid #E5E7EB;
  padding-left: 1em;
  color: #6B7280;
  margin: 0.8em 0;
}
.tiptap-content :deep(.tiptap code) {
  background: #F3F4F6;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.85em;
}
.tiptap-content :deep(.tiptap pre) {
  background: #1F2937;
  color: #E5E7EB;
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
}
.tiptap-content :deep(.tiptap pre code) {
  background: none;
  padding: 0;
  color: inherit;
}

/* Wiki link styling */
.tiptap-content :deep(.wiki-link) {
  background: #DBEAFE;
  color: #1D4ED8;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 500;
  cursor: pointer;
}

.tiptap-content :deep(.wiki-link:hover) {
  background: #BFDBFE;
}

/* Tags bar */
.editor-tags {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  border-top: 1px solid #F3F4F6;
  flex-shrink: 0;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: #EFF6FF;
  color: #2563EB;
  padding: 1px 7px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.tag-x {
  border: none;
  background: none;
  color: #93C5FD;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0 2px;
  line-height: 1;
}

.tag-x:hover { color: #EF4444; }

.tag-input {
  border: none;
  outline: none;
  font-size: 0.8rem;
  color: #374151;
  width: 100px;
  padding: 2px 4px;
}

.word-count {
  font-size: 0.75rem;
  color: #9CA3AF;
  flex-shrink: 0;
}

/* Buttons */
.btn {
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 0.8rem;
}

.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-save { background: #3B82F6; color: white; }
.btn-save:hover:not(:disabled) { background: #2563EB; }

.btn-approve { background: #DCFCE7; color: #166534; }
.btn-approve:hover { background: #22C55E; color: white; }

.btn-deprecate { background: #FEE2E2; color: #991B1B; }
.btn-deprecate:hover { background: #EF4444; color: white; }
</style>
