<script setup lang="ts">
import { onMounted } from 'vue'
import { useNodes } from '../../composables/useNodes'
import StatusBadge from '../common/StatusBadge.vue'
import NodeTypeBadge from '../common/NodeTypeBadge.vue'

const emit = defineEmits<{
  'select-node': [id: string]
}>()

const { nodes, loading, fetchInboxNodes, approveNode, deprecateNode } = useNodes()

onMounted(() => {
  fetchInboxNodes()
})

async function handleApprove(id: string) {
  await approveNode(id)
  await fetchInboxNodes()
}

async function handleDeprecate(id: string) {
  await deprecateNode(id)
  await fetchInboxNodes()
}
</script>

<template>
  <div class="inbox-view">
    <div class="inbox-header">
      <h2>Inbox</h2>
      <p class="inbox-subtitle">
        AI-generated and unverified knowledge awaiting your review
      </p>
      <span class="inbox-count" v-if="nodes.length">
        {{ nodes.length }} items pending
      </span>
    </div>

    <div v-if="loading" class="inbox-loading">Loading...</div>

    <div v-else-if="nodes.length === 0" class="inbox-empty">
      <p>No items pending review.</p>
      <p class="inbox-empty-hint">
        AI-generated nodes and edges will appear here as Experimental items.
      </p>
    </div>

    <div v-else class="inbox-list">
      <div
        v-for="node in nodes"
        :key="node.id"
        class="inbox-item"
        :class="{ 'ai-generated': node.provenance.creator === 'AI' }"
        @click="emit('select-node', node.id)"
      >
        <div class="item-header">
          <NodeTypeBadge :type="node.type" />
          <StatusBadge :status="node.status" />
          <span class="item-date">
            {{ new Date(node.created_at).toLocaleDateString() }}
          </span>
        </div>

        <h3 class="item-title">{{ node.title || 'Untitled' }}</h3>

        <p class="item-content">
          {{ node.content.substring(0, 150) }}{{ node.content.length > 150 ? '...' : '' }}
        </p>

        <!-- Provenance info -->
        <div class="item-provenance" v-if="node.provenance.creator === 'AI'">
          <span class="provenance-badge">
            AI Generated
            <span v-if="node.provenance.model"> ({{ node.provenance.model }})</span>
          </span>
          <span
            v-if="node.provenance.confidence != null"
            class="confidence"
          >
            Confidence: {{ Math.round(node.provenance.confidence * 100) }}%
          </span>
        </div>

        <!-- Actions -->
        <div class="item-actions" @click.stop>
          <button class="btn btn-approve" @click="handleApprove(node.id)">
            Approve
          </button>
          <button class="btn btn-deprecate" @click="handleDeprecate(node.id)">
            Reject
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inbox-view {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.inbox-header {
  margin-bottom: 24px;
}

.inbox-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.inbox-subtitle {
  color: #6B7280;
  font-size: 0.9rem;
  margin: 4px 0 0;
}

.inbox-count {
  display: inline-block;
  background: #FEF3C7;
  color: #92400E;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 9999px;
  margin-top: 8px;
}

.inbox-loading {
  text-align: center;
  color: #9CA3AF;
  padding: 40px;
}

.inbox-empty {
  text-align: center;
  color: #9CA3AF;
  padding: 60px 20px;
}

.inbox-empty-hint {
  font-size: 0.85rem;
  margin-top: 8px;
}

.inbox-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inbox-item {
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.inbox-item:hover {
  border-color: #3B82F6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.inbox-item.ai-generated {
  border-left: 3px dashed #F59E0B;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.item-date {
  font-size: 0.75rem;
  color: #9CA3AF;
  margin-left: auto;
}

.item-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 6px;
}

.item-content {
  font-size: 0.9rem;
  color: #6B7280;
  line-height: 1.5;
  margin: 0 0 12px;
}

.item-provenance {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.provenance-badge {
  font-size: 0.75rem;
  background: #FEF3C7;
  color: #92400E;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.confidence {
  font-size: 0.75rem;
  color: #9CA3AF;
}

.item-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-approve {
  background: #DCFCE7;
  color: #166534;
}

.btn-approve:hover {
  background: #22C55E;
  color: white;
}

.btn-deprecate {
  background: #FEE2E2;
  color: #991B1B;
}

.btn-deprecate:hover {
  background: #EF4444;
  color: white;
}
</style>
