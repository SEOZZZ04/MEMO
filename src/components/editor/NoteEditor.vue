<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Node, NodeType, CreateNodeInput, UpdateNodeInput } from '../../types/ontology'
import { NODE_TYPE_LABELS } from '../../types/ontology'
import StatusBadge from '../common/StatusBadge.vue'
import NodeTypeBadge from '../common/NodeTypeBadge.vue'
import EdgeTypePicker from '../common/EdgeTypePicker.vue'
import type { EdgeType } from '../../types/ontology'

const props = defineProps<{
  node?: Node | null
}>()

const emit = defineEmits<{
  save: [input: CreateNodeInput | UpdateNodeInput]
  approve: [id: string]
  deprecate: [id: string]
  'create-link': [payload: { targetQuery: string; edgeType: EdgeType }]
}>()

const title = ref('')
const content = ref('')
const nodeType = ref<NodeType>('Note')
const tags = ref<string[]>([])
const tagInput = ref('')
const showEdgePicker = ref(false)
const pendingLinkTarget = ref('')

const isEditing = computed(() => !!props.node)

const nodeTypes: NodeType[] = ['Note', 'Claim', 'Evidence', 'Source', 'Person', 'Definition']

watch(
  () => props.node,
  (node) => {
    if (node) {
      title.value = node.title
      content.value = node.content
      nodeType.value = node.type
      tags.value = [...node.tags]
    } else {
      title.value = ''
      content.value = ''
      nodeType.value = 'Note'
      tags.value = []
    }
  },
  { immediate: true }
)

function handleSave() {
  if (isEditing.value && props.node) {
    emit('save', {
      id: props.node.id,
      title: title.value,
      content: content.value,
      type: nodeType.value,
      tags: tags.value,
    } as UpdateNodeInput)
  } else {
    emit('save', {
      title: title.value,
      content: content.value,
      type: nodeType.value,
      tags: tags.value,
    } as CreateNodeInput)
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

/**
 * Handle [[ wiki-link syntax in content.
 * When user types [[ and then closes with ]], show edge type picker.
 */
function handleContentInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  const val = target.value
  const cursor = target.selectionStart

  // Detect [[ link pattern that was just closed with ]]
  const beforeCursor = val.substring(0, cursor)
  const match = beforeCursor.match(/\[\[([^\]]+)\]\]$/)

  if (match) {
    pendingLinkTarget.value = match[1]
    showEdgePicker.value = true
  }

  content.value = val
}

function handleEdgeTypeSelected(edgeType: EdgeType) {
  emit('create-link', {
    targetQuery: pendingLinkTarget.value,
    edgeType,
  })
  showEdgePicker.value = false
  pendingLinkTarget.value = ''
}
</script>

<template>
  <div class="note-editor">
    <!-- Header with status and type -->
    <div class="editor-header">
      <div class="header-badges" v-if="node">
        <StatusBadge :status="node.status" />
        <NodeTypeBadge :type="node.type" />
        <span class="provenance-info" v-if="node.provenance.creator === 'AI'">
          AI: {{ node.provenance.model ?? 'unknown' }}
        </span>
      </div>

      <!-- Governance actions -->
      <div class="header-actions" v-if="node">
        <button
          v-if="node.status === 'Experimental'"
          class="btn btn-approve"
          @click="emit('approve', node.id)"
        >
          Approve
        </button>
        <button
          v-if="node.status !== 'Deprecated'"
          class="btn btn-deprecate"
          @click="emit('deprecate', node.id)"
        >
          Deprecate
        </button>
      </div>
    </div>

    <!-- Node Type Selector -->
    <div class="type-selector">
      <label>Type:</label>
      <select v-model="nodeType">
        <option v-for="t in nodeTypes" :key="t" :value="t">
          {{ NODE_TYPE_LABELS[t] }} ({{ t }})
        </option>
      </select>
    </div>

    <!-- Title -->
    <input
      v-model="title"
      class="editor-title"
      placeholder="Title..."
      @keydown.enter.prevent="handleSave"
    />

    <!-- Content -->
    <textarea
      :value="content"
      @input="handleContentInput"
      class="editor-content"
      placeholder="Write your note... Use [[note name]] to create links."
      rows="12"
    />

    <!-- Tags -->
    <div class="tags-section">
      <div class="tags-list">
        <span v-for="(tag, i) in tags" :key="tag" class="tag">
          {{ tag }}
          <button class="tag-remove" @click="removeTag(i)">&times;</button>
        </span>
      </div>
      <input
        v-model="tagInput"
        class="tag-input"
        placeholder="Add tag..."
        @keydown.enter.prevent="addTag"
      />
    </div>

    <!-- Save -->
    <div class="editor-footer">
      <span class="word-count" v-if="content">
        {{ content.split(/\s+/).filter(Boolean).length }} words
      </span>
      <button class="btn btn-save" @click="handleSave" :disabled="!title.trim()">
        {{ isEditing ? 'Update' : 'Create' }}
      </button>
    </div>

    <!-- Edge Type Picker (shown when [[ ]] link is created) -->
    <EdgeTypePicker
      :show="showEdgePicker"
      @update:model-value="handleEdgeTypeSelected"
      @close="showEdgePicker = false"
    />
  </div>
</template>

<style scoped>
.note-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provenance-info {
  font-size: 0.75rem;
  color: #9CA3AF;
  font-style: italic;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.type-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-selector label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #6B7280;
}

.type-selector select {
  padding: 4px 8px;
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  font-size: 0.85rem;
  background: white;
}

.editor-title {
  font-size: 1.5rem;
  font-weight: 700;
  border: none;
  border-bottom: 2px solid #E5E7EB;
  padding: 8px 0;
  outline: none;
  color: #111827;
}

.editor-title:focus {
  border-bottom-color: #3B82F6;
}

.editor-content {
  font-size: 0.95rem;
  line-height: 1.7;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 16px;
  resize: vertical;
  outline: none;
  font-family: inherit;
  color: #374151;
}

.editor-content:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.tags-section {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #EFF6FF;
  color: #1D4ED8;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.tag-remove {
  border: none;
  background: none;
  color: #93C5FD;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

.tag-remove:hover {
  color: #EF4444;
}

.tag-input {
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.8rem;
  outline: none;
  width: 120px;
}

.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.word-count {
  font-size: 0.8rem;
  color: #9CA3AF;
}

.btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-save {
  background: #3B82F6;
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: #2563EB;
}

.btn-approve {
  background: #22C55E;
  color: white;
}

.btn-approve:hover {
  background: #16A34A;
}

.btn-deprecate {
  background: #EF4444;
  color: white;
}

.btn-deprecate:hover {
  background: #DC2626;
}
</style>
