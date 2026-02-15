<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import type { GraphNode, GraphEdge } from '../../types/ontology'
import {
  NODE_TYPE_COLORS,
  EDGE_TYPE_COLORS,
  STATUS_STYLES,
  NODE_TYPE_LABELS,
  EDGE_TYPE_LABELS,
} from '../../types/ontology'

const props = defineProps<{
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId?: string | null
}>()

const emit = defineEmits<{
  'select-node': [id: string]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const width = ref(800)
const height = ref(600)
const offset = ref({ x: 0, y: 0 })
const scale = ref(1)
const dragging = ref<string | null>(null)
const dragOffset = ref({ x: 0, y: 0 })

// Simple force-directed layout positions
const nodePositions = ref<Map<string, { x: number; y: number }>>(new Map())

function initPositions() {
  const cx = width.value / 2
  const cy = height.value / 2
  const radius = Math.min(width.value, height.value) * 0.3

  props.nodes.forEach((node, i) => {
    if (!nodePositions.value.has(node.id)) {
      const angle = (2 * Math.PI * i) / props.nodes.length
      nodePositions.value.set(node.id, {
        x: node.x ?? cx + radius * Math.cos(angle),
        y: node.y ?? cy + radius * Math.sin(angle),
      })
    }
  })
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, width.value, height.value)
  ctx.save()
  ctx.translate(offset.value.x, offset.value.y)
  ctx.scale(scale.value, scale.value)

  // Draw edges
  props.edges.forEach((edge) => {
    const source = nodePositions.value.get(edge.source)
    const target = nodePositions.value.get(edge.target)
    if (!source || !target) return

    const edgeColor = EDGE_TYPE_COLORS[edge.type]
    const statusStyle = STATUS_STYLES[edge.status]

    ctx.beginPath()
    ctx.strokeStyle = edgeColor
    ctx.globalAlpha = statusStyle.opacity
    ctx.lineWidth = 1.5 + edge.weight

    if (statusStyle.dash) {
      ctx.setLineDash([6, 4])
    } else {
      ctx.setLineDash([])
    }

    ctx.moveTo(source.x, source.y)
    ctx.lineTo(target.x, target.y)
    ctx.stroke()

    // Draw arrowhead
    const angle = Math.atan2(target.y - source.y, target.x - source.x)
    const arrowSize = 10
    const arrowX = target.x - 20 * Math.cos(angle)
    const arrowY = target.y - 20 * Math.sin(angle)

    ctx.beginPath()
    ctx.fillStyle = edgeColor
    ctx.moveTo(arrowX, arrowY)
    ctx.lineTo(
      arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
      arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
      arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
      arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
    )
    ctx.closePath()
    ctx.fill()

    // Draw edge label
    const midX = (source.x + target.x) / 2
    const midY = (source.y + target.y) / 2
    ctx.fillStyle = '#6B7280'
    ctx.font = '10px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(EDGE_TYPE_LABELS[edge.type], midX, midY - 6)

    ctx.globalAlpha = 1
    ctx.setLineDash([])
  })

  // Draw nodes
  props.nodes.forEach((node) => {
    const pos = nodePositions.value.get(node.id)
    if (!pos) return

    const nodeColor = NODE_TYPE_COLORS[node.type]
    const statusStyle = STATUS_STYLES[node.status]
    const isSelected = props.selectedNodeId === node.id
    const radius = isSelected ? 22 : 18

    ctx.globalAlpha = statusStyle.opacity

    // Node circle
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = nodeColor + '30'
    ctx.fill()

    ctx.strokeStyle = isSelected ? '#3B82F6' : nodeColor
    ctx.lineWidth = isSelected ? 3 : 1.5
    if (statusStyle.dash) {
      ctx.setLineDash([4, 3])
    } else {
      ctx.setLineDash([])
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Node label
    ctx.fillStyle = statusStyle.color
    ctx.font = `${isSelected ? 'bold ' : ''}12px system-ui`
    ctx.textAlign = 'center'
    ctx.fillText(
      node.title.length > 20 ? node.title.substring(0, 20) + '...' : node.title,
      pos.x,
      pos.y + radius + 16
    )

    // Type label (small, above node)
    ctx.fillStyle = nodeColor
    ctx.font = '9px system-ui'
    ctx.fillText(NODE_TYPE_LABELS[node.type], pos.x, pos.y - radius - 6)

    ctx.globalAlpha = 1
  })

  ctx.restore()
}

function handleMouseDown(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const mx = (e.clientX - rect.left - offset.value.x) / scale.value
  const my = (e.clientY - rect.top - offset.value.y) / scale.value

  for (const node of props.nodes) {
    const pos = nodePositions.value.get(node.id)
    if (!pos) continue
    const dist = Math.hypot(mx - pos.x, my - pos.y)
    if (dist < 20) {
      dragging.value = node.id
      dragOffset.value = { x: mx - pos.x, y: my - pos.y }
      emit('select-node', node.id)
      return
    }
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const mx = (e.clientX - rect.left - offset.value.x) / scale.value
  const my = (e.clientY - rect.top - offset.value.y) / scale.value

  nodePositions.value.set(dragging.value, {
    x: mx - dragOffset.value.x,
    y: my - dragOffset.value.y,
  })
  draw()
}

function handleMouseUp() {
  dragging.value = null
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.95 : 1.05
  scale.value = Math.max(0.3, Math.min(3, scale.value * delta))
  draw()
}

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    const container = canvas.parentElement
    if (container) {
      width.value = container.clientWidth
      height.value = container.clientHeight
    }
  }
  initPositions()
  draw()
})

watch([() => props.nodes, () => props.edges, () => props.selectedNodeId], () => {
  initPositions()
  draw()
}, { deep: true })
</script>

<template>
  <div class="graph-container">
    <!-- Legend -->
    <div class="graph-legend">
      <div class="legend-section">
        <span class="legend-title">Edge Types:</span>
        <span
          v-for="(color, type) in EDGE_TYPE_COLORS"
          :key="type"
          class="legend-item"
        >
          <span class="legend-dot" :style="{ backgroundColor: color }" />
          {{ EDGE_TYPE_LABELS[type as keyof typeof EDGE_TYPE_LABELS] }}
        </span>
      </div>
      <div class="legend-section">
        <span class="legend-title">Status:</span>
        <span class="legend-item">
          <span class="legend-line solid" /> Active
        </span>
        <span class="legend-item">
          <span class="legend-line dashed" /> Experimental
        </span>
      </div>
    </div>

    <canvas
      ref="canvasRef"
      :width="width"
      :height="height"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @wheel="handleWheel"
    />
  </div>
</template>

<style scoped>
.graph-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: #FAFAFA;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  overflow: hidden;
}

canvas {
  display: block;
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}

.graph-legend {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.7rem;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.legend-title {
  font-weight: 600;
  color: #374151;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #6B7280;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-line {
  width: 16px;
  height: 0;
  border-top: 2px solid #374151;
}

.legend-line.dashed {
  border-top-style: dashed;
  border-top-color: #9CA3AF;
}
</style>
