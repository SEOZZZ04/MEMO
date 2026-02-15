<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNodes } from '../composables/useNodes'
import { useEdges } from '../composables/useEdges'
import { useFolders } from '../composables/useFolders'
import FolderTree from '../components/layout/FolderTree.vue'
import TagList from '../components/layout/TagList.vue'
import TipTapEditor from '../components/editor/TipTapEditor.vue'
import OrphanAlert from '../components/editor/OrphanAlert.vue'
import IntelligencePanel from '../components/intelligence/IntelligencePanel.vue'
import SearchPanel from '../components/common/SearchPanel.vue'
import type {
  CreateNodeInput,
  UpdateNodeInput,
  EdgeType,
  Node as MemoNode,
} from '../types/ontology'
import { NODE_TYPE_COLORS } from '../types/ontology'

// --- State ---

const {
  nodes,
  currentNode,
  loading: nodesLoading,
  fetchNodes,
  fetchNode,
  createNode,
  updateNode,
  approveNode,
  deprecateNode,
} = useNodes()

const {
  edges,
  fetchAllEdges,
  fetchEdgesForNode,
  createEdge,
} = useEdges()

const { folders, fetchFolders, createFolder } = useFolders()

const activeFolderId = ref<string | null>(null)
const activeTag = ref<string | null>(null)
const editorContent = ref('')
const showOrphanAlert = ref(false)
const showSearch = ref(false)
const lastCreatedNodeId = ref<string | null>(null)

// --- Computed ---

// All unique tags across nodes
const allTags = computed(() => {
  const tagSet = new Set<string>()
  nodes.value.forEach((n) => n.tags.forEach((t) => tagSet.add(t)))
  return Array.from(tagSet).sort()
})

// Filtered notes list for sidebar
const filteredNodes = computed(() => {
  let list = nodes.value

  if (activeFolderId.value) {
    list = list.filter((n) => n.folder_id === activeFolderId.value)
  }

  if (activeTag.value) {
    list = list.filter((n) => n.tags.includes(activeTag.value!))
  }

  return list
})

// Node list for wiki-link autocomplete
const allNodeOptions = computed(() =>
  nodes.value.map((n) => ({ id: n.id, title: n.title || 'Untitled' }))
)

// --- Lifecycle ---

onMounted(async () => {
  await Promise.all([fetchNodes(), fetchAllEdges(), fetchFolders()])
})

// --- Event Handlers ---

async function handleSelectNode(id: string) {
  await fetchNode(id)
  showSearch.value = false
}

function handleNewNote() {
  currentNode.value = null
  showSearch.value = false
}

async function handleSave(input: CreateNodeInput | UpdateNodeInput) {
  if ('id' in input) {
    await updateNode(input)
  } else {
    const newNode = await createNode(input)
    if (newNode) {
      lastCreatedNodeId.value = newNode.id
      currentNode.value = newNode
    }
  }
  await fetchNodes()
}

async function handleApprove(id: string) {
  await approveNode(id)
  await fetchNodes()
}

async function handleDeprecate(id: string) {
  await deprecateNode(id)
  await fetchNodes()
}

async function handleCreateEdge(payload: { sourceId: string; targetId: string; edgeType: EdgeType }) {
  await createEdge({
    source_id: payload.sourceId,
    target_id: payload.targetId,
    type: payload.edgeType,
  })
  await fetchAllEdges()
}

async function handleCheckOrphan(nodeId: string) {
  // Check if this node has any edges
  await fetchEdgesForNode(nodeId)
  if (edges.value.length === 0) {
    showOrphanAlert.value = true
  }
}

async function handleOrphanAddTag(tag: string) {
  if (currentNode.value) {
    const newTags = [...currentNode.value.tags, tag]
    await updateNode({ id: currentNode.value.id, tags: newTags })
    await fetchNodes()
  }
  showOrphanAlert.value = false
}

async function handleCreateFolder(name: string) {
  await createFolder(name)
}

function handleContentChange(text: string) {
  editorContent.value = text
}
</script>

<template>
  <div class="tri-pane">
    <!-- ===== LEFT PANE: Navigation ===== -->
    <aside class="pane-left">
      <div class="left-header">
        <h1 class="app-title">MEMO</h1>
        <p class="app-subtitle">Ontology Knowledge System</p>
      </div>

      <button class="new-note-btn" @click="handleNewNote">
        + New Note
      </button>

      <button
        class="search-toggle"
        :class="{ active: showSearch }"
        @click="showSearch = !showSearch"
      >
        Search...
      </button>

      <!-- Folder Tree -->
      <FolderTree
        :folders="folders"
        :active-folder-id="activeFolderId"
        @select-folder="(id) => activeFolderId = id"
        @create-folder="handleCreateFolder"
      />

      <!-- Tag List -->
      <TagList
        :tags="allTags"
        :active-tag="activeTag"
        @select-tag="(tag) => activeTag = tag"
      />

      <!-- Notes list -->
      <div class="notes-list">
        <div class="notes-header">
          <span class="section-label">Notes</span>
          <span class="notes-count">{{ filteredNodes.length }}</span>
        </div>
        <div v-if="nodesLoading" class="notes-loading">Loading...</div>
        <div
          v-for="node in filteredNodes.slice(0, 50)"
          :key="node.id"
          class="note-item"
          :class="{
            active: currentNode?.id === node.id,
            experimental: node.status === 'Experimental'
          }"
          @click="handleSelectNode(node.id)"
        >
          <span
            class="note-type-dot"
            :style="{ backgroundColor: NODE_TYPE_COLORS[node.type] }"
          />
          <span class="note-title">{{ node.title || 'Untitled' }}</span>
        </div>
      </div>
    </aside>

    <!-- ===== CENTER PANE: Editor ===== -->
    <main class="pane-center">
      <!-- Search overlay -->
      <div v-if="showSearch" class="search-overlay">
        <SearchPanel @select-node="handleSelectNode" />
      </div>

      <!-- TipTap Editor -->
      <TipTapEditor
        v-else
        :node="currentNode"
        :all-nodes="allNodeOptions"
        @save="handleSave"
        @approve="handleApprove"
        @deprecate="handleDeprecate"
        @create-edge="handleCreateEdge"
        @content-change="handleContentChange"
        @check-orphan="handleCheckOrphan"
      />
    </main>

    <!-- ===== RIGHT PANE: Intelligence ===== -->
    <aside class="pane-right">
      <IntelligencePanel
        :current-node-id="currentNode?.id"
        :current-content="editorContent"
        @select-node="handleSelectNode"
      />
    </aside>

    <!-- Orphan Alert Toast -->
    <OrphanAlert
      :show="showOrphanAlert"
      :node-title="currentNode?.title ?? ''"
      @dismiss="showOrphanAlert = false"
      @add-tag="handleOrphanAddTag"
      @open-link="showOrphanAlert = false"
    />
  </div>
</template>

<style scoped>
/* ===== Tri-Pane Layout ===== */
.tri-pane {
  display: flex;
  height: 100vh;
  background: #F9FAFB;
}

/* ----- LEFT PANE ----- */
.pane-left {
  width: 260px;
  background: white;
  border-right: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.left-header {
  padding: 16px 16px 10px;
  border-bottom: 1px solid #F3F4F6;
  flex-shrink: 0;
}

.app-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #111827;
  margin: 0;
  letter-spacing: -0.02em;
}

.app-subtitle {
  font-size: 0.62rem;
  color: #9CA3AF;
  margin: 1px 0 0;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.new-note-btn {
  margin: 10px 12px 4px;
  padding: 8px;
  background: #3B82F6;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s;
}

.new-note-btn:hover {
  background: #2563EB;
}

.search-toggle {
  margin: 0 12px 6px;
  padding: 7px 10px;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #9CA3AF;
  text-align: left;
  cursor: pointer;
  flex-shrink: 0;
}

.search-toggle:hover, .search-toggle.active {
  border-color: #3B82F6;
  color: #3B82F6;
}

/* Notes list */
.notes-list {
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid #F3F4F6;
}

.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 6px;
  position: sticky;
  top: 0;
  background: white;
  z-index: 1;
}

.section-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9CA3AF;
}

.notes-count {
  font-size: 0.65rem;
  color: #9CA3AF;
  background: #F3F4F6;
  padding: 1px 6px;
  border-radius: 9999px;
}

.notes-loading {
  padding: 20px;
  text-align: center;
  color: #D1D5DB;
  font-size: 0.82rem;
}

.note-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  cursor: pointer;
  transition: background 0.08s;
}

.note-item:hover {
  background: #F9FAFB;
}

.note-item.active {
  background: #EFF6FF;
}

.note-item.experimental {
  opacity: 0.6;
  border-left: 2px dashed #FCD34D;
}

.note-type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.note-title {
  font-size: 0.82rem;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-item.active .note-title {
  color: #2563EB;
  font-weight: 500;
}

/* ----- CENTER PANE ----- */
.pane-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-overlay {
  flex: 1;
  overflow-y: auto;
  background: white;
}

/* ----- RIGHT PANE ----- */
.pane-right {
  width: 320px;
  flex-shrink: 0;
  overflow: hidden;
}

/* Responsive: hide right pane on small screens */
@media (max-width: 1100px) {
  .pane-right {
    display: none;
  }
}

@media (max-width: 800px) {
  .pane-left {
    width: 200px;
  }
}
</style>
