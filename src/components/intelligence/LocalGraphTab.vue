<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useEdges } from '../../composables/useEdges'
import { useSearch } from '../../composables/useSearch'
import GraphCanvas from '../graph/GraphCanvas.vue'
import type { GraphNode, GraphEdge, NodeContext } from '../../types/ontology'
import { EDGE_TYPE_LABELS } from '../../types/ontology'
import { supabase } from '../../lib/supabase'

const props = defineProps<{
  nodeId?: string | null
}>()

const emit = defineEmits<{
  'select-node': [id: string]
}>()

const { edges, fetchEdgesForNode } = useEdges()
const { context, getNodeContext } = useSearch()

const graphNodes = ref<GraphNode[]>([])
const graphEdges = ref<GraphEdge[]>([])
const contextList = ref<NodeContext[]>([])
const centerNodeTitle = ref('')

async function loadGraph() {
  if (!props.nodeId) {
    graphNodes.value = []
    graphEdges.value = []
    contextList.value = []
    return
  }

  // Load center node
  const { data: centerNode } = await supabase
    .from('nodes')
    .select('id, title, type, status')
    .eq('id', props.nodeId)
    .single()

  if (!centerNode) return
  centerNodeTitle.value = (centerNode as { title: string }).title

  // Fetch edges and context
  await Promise.all([
    fetchEdgesForNode(props.nodeId),
    getNodeContext(props.nodeId, 1),
  ])

  contextList.value = [...context.value]

  // Build graph nodes: center + neighbors
  const cn = centerNode as { id: string; title: string; type: string; status: string }
  const nodes: GraphNode[] = [
    {
      id: cn.id,
      title: cn.title,
      type: cn.type as GraphNode['type'],
      status: cn.status as GraphNode['status'],
    },
  ]

  for (const ctx of context.value) {
    if (!nodes.find((n) => n.id === ctx.node_id)) {
      nodes.push({
        id: ctx.node_id,
        title: ctx.node_title,
        type: ctx.node_type,
        status: ctx.node_status,
      })
    }
  }

  graphNodes.value = nodes

  // Build graph edges
  graphEdges.value = edges.value
    .filter((e) => {
      const nodeIds = nodes.map((n) => n.id)
      return nodeIds.includes(e.source_id) && nodeIds.includes(e.target_id)
    })
    .map((e) => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      type: e.type,
      status: e.status,
      weight: e.weight,
      label: e.label ?? undefined,
    }))
}

watch(() => props.nodeId, loadGraph, { immediate: true })
</script>

<template>
  <div class="local-graph-tab">
    <div v-if="!nodeId" class="empty-state">
      <p>Select a note to see its local graph</p>
    </div>

    <template v-else>
      <!-- Mini graph -->
      <div class="mini-graph">
        <GraphCanvas
          :nodes="graphNodes"
          :edges="graphEdges"
          :selected-node-id="nodeId"
          @select-node="(id) => emit('select-node', id)"
        />
      </div>

      <!-- Connections list -->
      <div class="connections">
        <h4 class="connections-title">
          Connections
          <span class="conn-count">{{ contextList.length }}</span>
        </h4>
        <div v-if="contextList.length === 0" class="no-conn">
          No connections yet. Use [[wiki-link]] to create one.
        </div>
        <div
          v-for="ctx in contextList"
          :key="ctx.node_id"
          class="conn-item"
          @click="emit('select-node', ctx.node_id)"
        >
          <span class="conn-direction" :class="ctx.direction">
            {{ ctx.direction === 'outgoing' ? '\u2192' : '\u2190' }}
          </span>
          <span class="conn-type" :class="ctx.edge_type">
            {{ EDGE_TYPE_LABELS[ctx.edge_type] }}
          </span>
          <span class="conn-title">{{ ctx.node_title }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.local-graph-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #D1D5DB;
  font-size: 0.85rem;
}

.mini-graph {
  height: 260px;
  border-bottom: 1px solid #F3F4F6;
}

.connections {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
}

.connections-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9CA3AF;
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.conn-count {
  background: #F3F4F6;
  color: #6B7280;
  padding: 0 6px;
  border-radius: 9999px;
  font-size: 0.7rem;
}

.no-conn {
  color: #D1D5DB;
  font-size: 0.8rem;
  padding: 8px 0;
}

.conn-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.82rem;
}

.conn-item:hover {
  background: #F3F4F6;
}

.conn-direction {
  font-size: 0.9rem;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.conn-direction.outgoing { color: #3B82F6; }
.conn-direction.incoming { color: #6B7280; }

.conn-type {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.conn-type.supports { background: #DCFCE7; color: #166534; }
.conn-type.refutes { background: #FEE2E2; color: #991B1B; }
.conn-type.defines { background: #DBEAFE; color: #1E40AF; }
.conn-type.caused_by { background: #FFEDD5; color: #9A3412; }
.conn-type.related_to { background: #F3F4F6; color: #6B7280; }
.conn-type.derived_from { background: #F3E8FF; color: #6B21A8; }
.conn-type.example_of { background: #ECFEFF; color: #155E75; }
.conn-type.part_of { background: #F1F5F9; color: #475569; }

.conn-title {
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
