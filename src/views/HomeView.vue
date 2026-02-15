<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useNodes } from '../composables/useNodes'
import { useEdges } from '../composables/useEdges'
import { useFolders } from '../composables/useFolders'
import NoteEditor from '../components/editor/NoteEditor.vue'
import GraphCanvas from '../components/graph/GraphCanvas.vue'
import InboxView from '../components/inbox/InboxView.vue'
import SearchPanel from '../components/common/SearchPanel.vue'
import type { CreateNodeInput, UpdateNodeInput, GraphNode, GraphEdge, EdgeType } from '../types/ontology'

type ViewTab = 'editor' | 'graph' | 'inbox' | 'search'

const activeTab = ref<ViewTab>('editor')

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
  createEdge,
} = useEdges()

const { folders, fetchFolders } = useFolders()

onMounted(async () => {
  await Promise.all([fetchNodes(), fetchAllEdges(), fetchFolders()])
})

// Transform to graph visualization format
const graphNodes = computed<GraphNode[]>(() =>
  nodes.value.map((n) => ({
    id: n.id,
    title: n.title || 'Untitled',
    type: n.type,
    status: n.status,
  }))
)

const graphEdges = computed<GraphEdge[]>(() =>
  edges.value.map((e) => ({
    id: e.id,
    source: e.source_id,
    target: e.target_id,
    type: e.type,
    status: e.status,
    weight: e.weight,
    label: e.label ?? undefined,
  }))
)

async function handleSave(input: CreateNodeInput | UpdateNodeInput) {
  if ('id' in input) {
    await updateNode(input)
  } else {
    await createNode(input)
    currentNode.value = null
  }
  await fetchNodes()
}

async function handleSelectNode(id: string) {
  await fetchNode(id)
  activeTab.value = 'editor'
}

async function handleApprove(id: string) {
  await approveNode(id)
  await fetchNodes()
}

async function handleDeprecate(id: string) {
  await deprecateNode(id)
  await fetchNodes()
}

async function handleCreateLink(payload: { targetQuery: string; edgeType: EdgeType }) {
  if (!currentNode.value) return

  // Find target node by title
  const target = nodes.value.find(
    (n) => n.title.toLowerCase() === payload.targetQuery.toLowerCase()
  )

  if (target) {
    await createEdge({
      source_id: currentNode.value.id,
      target_id: target.id,
      type: payload.edgeType,
    })
    await fetchAllEdges()
  }
}

function handleNewNote() {
  currentNode.value = null
  activeTab.value = 'editor'
}
</script>

<template>
  <div class="home-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="app-title">MEMO</h1>
        <p class="app-subtitle">Ontology Knowledge System</p>
      </div>

      <button class="new-note-btn" @click="handleNewNote">
        + New Note
      </button>

      <!-- Navigation tabs -->
      <nav class="sidebar-nav">
        <button
          class="nav-item"
          :class="{ active: activeTab === 'editor' }"
          @click="activeTab = 'editor'"
        >
          Editor
        </button>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'graph' }"
          @click="activeTab = 'graph'"
        >
          Graph
        </button>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'inbox' }"
          @click="activeTab = 'inbox'"
        >
          Inbox
        </button>
        <button
          class="nav-item"
          :class="{ active: activeTab === 'search' }"
          @click="activeTab = 'search'"
        >
          Search
        </button>
      </nav>

      <!-- Folders -->
      <div class="sidebar-folders">
        <h3 class="section-title">Folders</h3>
        <div
          v-for="folder in folders"
          :key="folder.id"
          class="folder-item"
          :class="{ system: folder.is_system }"
        >
          {{ folder.name }}
        </div>
      </div>

      <!-- Recent nodes -->
      <div class="sidebar-recent">
        <h3 class="section-title">Recent</h3>
        <div
          v-for="node in nodes.slice(0, 10)"
          :key="node.id"
          class="recent-item"
          :class="{ experimental: node.status === 'Experimental' }"
          @click="handleSelectNode(node.id)"
        >
          <span class="recent-type" :style="{ color: node.type === 'Claim' ? '#F59E0B' : '#6B7280' }">
            {{ node.type.charAt(0) }}
          </span>
          {{ node.title || 'Untitled' }}
        </div>
      </div>
    </aside>

    <!-- Main content area -->
    <main class="main-content">
      <div v-if="nodesLoading" class="loading">Loading...</div>

      <template v-else>
        <NoteEditor
          v-if="activeTab === 'editor'"
          :node="currentNode"
          @save="handleSave"
          @approve="handleApprove"
          @deprecate="handleDeprecate"
          @create-link="handleCreateLink"
        />

        <div v-else-if="activeTab === 'graph'" class="graph-view">
          <GraphCanvas
            :nodes="graphNodes"
            :edges="graphEdges"
            :selected-node-id="currentNode?.id"
            @select-node="handleSelectNode"
          />
        </div>

        <InboxView
          v-else-if="activeTab === 'inbox'"
          @select-node="handleSelectNode"
        />

        <SearchPanel
          v-else-if="activeTab === 'search'"
          @select-node="handleSelectNode"
        />
      </template>
    </main>
  </div>
</template>

<style scoped>
.home-layout {
  display: flex;
  height: 100vh;
  background: #F9FAFB;
}

/* Sidebar */
.sidebar {
  width: 260px;
  background: white;
  border-right: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 20px 16px 12px;
  border-bottom: 1px solid #F3F4F6;
}

.app-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: #111827;
  margin: 0;
  letter-spacing: -0.02em;
}

.app-subtitle {
  font-size: 0.7rem;
  color: #9CA3AF;
  margin: 2px 0 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.new-note-btn {
  margin: 12px 16px;
  padding: 10px;
  background: #3B82F6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s;
}

.new-note-btn:hover {
  background: #2563EB;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 0 8px;
  gap: 2px;
}

.nav-item {
  padding: 8px 12px;
  border: none;
  background: none;
  text-align: left;
  font-size: 0.9rem;
  color: #6B7280;
  cursor: pointer;
  border-radius: 6px;
  font-weight: 500;
}

.nav-item:hover {
  background: #F3F4F6;
}

.nav-item.active {
  background: #EFF6FF;
  color: #3B82F6;
}

.sidebar-folders,
.sidebar-recent {
  padding: 12px 16px;
}

.section-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: #9CA3AF;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 8px;
}

.folder-item {
  padding: 6px 8px;
  font-size: 0.85rem;
  color: #374151;
  border-radius: 4px;
  cursor: pointer;
}

.folder-item:hover {
  background: #F3F4F6;
}

.folder-item.system {
  font-weight: 500;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  font-size: 0.8rem;
  color: #374151;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.recent-item:hover {
  background: #F3F4F6;
}

.recent-item.experimental {
  opacity: 0.6;
  border-left: 2px dashed #FCD34D;
  padding-left: 6px;
}

.recent-type {
  font-weight: 700;
  font-size: 0.7rem;
  flex-shrink: 0;
}

/* Main content */
.main-content {
  flex: 1;
  overflow-y: auto;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #9CA3AF;
}

.graph-view {
  height: 100%;
  padding: 16px;
}
</style>
