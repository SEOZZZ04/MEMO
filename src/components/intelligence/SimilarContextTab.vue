<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAI } from '../../composables/useAI'
import StatusBadge from '../common/StatusBadge.vue'
import NodeTypeBadge from '../common/NodeTypeBadge.vue'
import type { SearchResult } from '../../types/ontology'

const props = defineProps<{
  content?: string
}>()

const emit = defineEmits<{
  'select-node': [id: string]
}>()

const { findSimilar, loading } = useAI()
const similar = ref<SearchResult[]>([])
const lastQuery = ref('')

// Debounced watch on content changes
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.content,
  (text) => {
    if (!text || text.length < 30) {
      similar.value = []
      return
    }

    // Only re-query if content changed meaningfully (every ~80 chars or 3 seconds)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      // Take last ~300 chars for context relevance
      const queryText = text.slice(-300)
      if (queryText === lastQuery.value) return
      lastQuery.value = queryText
      similar.value = await findSimilar(queryText, 3)
    }, 3000)
  },
  { immediate: true }
)

function handleRefresh() {
  const text = props.content
  if (!text || text.length < 30) return
  lastQuery.value = ''
  findSimilar(text.slice(-300), 3).then((results) => {
    similar.value = results
  })
}
</script>

<template>
  <div class="similar-tab">
    <div class="similar-header">
      <span class="similar-title">Related Past Notes</span>
      <button class="refresh-btn" @click="handleRefresh" :disabled="loading">
        {{ loading ? '...' : 'Refresh' }}
      </button>
    </div>

    <div v-if="!content || content.length < 30" class="empty-state">
      <p>Start writing (30+ characters) to see similar past notes in real-time.</p>
    </div>

    <div v-else-if="loading && similar.length === 0" class="loading-state">
      Finding similar notes...
    </div>

    <div v-else-if="similar.length === 0" class="empty-state">
      <p>No similar notes found yet. Keep writing!</p>
    </div>

    <div v-else class="similar-list">
      <div
        v-for="(item, i) in similar"
        :key="item.id"
        class="similar-item"
        @click="emit('select-node', item.id)"
      >
        <div class="item-rank">#{{ i + 1 }}</div>
        <div class="item-body">
          <div class="item-meta">
            <NodeTypeBadge :type="item.type" />
            <StatusBadge :status="item.status" />
            <span v-if="item.similarity != null" class="similarity-score">
              {{ Math.round((item.similarity ?? 0) * 100) }}%
            </span>
          </div>
          <h4 class="item-title">{{ item.title || 'Untitled' }}</h4>
          <p class="item-snippet">
            {{ item.content.substring(0, 120) }}{{ item.content.length > 120 ? '...' : '' }}
          </p>
        </div>
      </div>
    </div>

    <div class="similar-hint">
      <p>These notes share semantic similarity with what you're currently writing. Click to open.</p>
    </div>
  </div>
</template>

<style scoped>
.similar-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.similar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #F3F4F6;
}

.similar-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9CA3AF;
}

.refresh-btn {
  padding: 3px 10px;
  font-size: 0.72rem;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  background: white;
  color: #6B7280;
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  background: #F3F4F6;
}

.refresh-btn:disabled {
  opacity: 0.5;
}

.empty-state, .loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #D1D5DB;
  font-size: 0.82rem;
}

.similar-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.similar-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border: 1px solid #F3F4F6;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.12s;
}

.similar-item:hover {
  border-color: #93C5FD;
  background: #F8FAFF;
}

.item-rank {
  font-size: 0.7rem;
  font-weight: 700;
  color: #3B82F6;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #EFF6FF;
  border-radius: 6px;
  flex-shrink: 0;
}

.item-body {
  flex: 1;
  min-width: 0;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.similarity-score {
  font-size: 0.65rem;
  color: #9CA3AF;
  margin-left: auto;
}

.item-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-snippet {
  font-size: 0.75rem;
  color: #9CA3AF;
  margin: 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.similar-hint {
  padding: 10px 14px;
  border-top: 1px solid #F3F4F6;
  flex-shrink: 0;
}

.similar-hint p {
  font-size: 0.68rem;
  color: #D1D5DB;
  margin: 0;
  line-height: 1.3;
}
</style>
