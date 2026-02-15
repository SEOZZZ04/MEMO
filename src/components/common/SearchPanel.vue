<script setup lang="ts">
import { ref } from 'vue'
import { useSearch } from '../../composables/useSearch'
import StatusBadge from './StatusBadge.vue'
import NodeTypeBadge from './NodeTypeBadge.vue'

const emit = defineEmits<{
  'select-node': [id: string]
}>()

const { results, loading, error, searchByText } = useSearch()
const query = ref('')

async function handleSearch() {
  if (!query.value.trim()) return
  await searchByText(query.value.trim())
}
</script>

<template>
  <div class="search-panel">
    <div class="search-input-group">
      <input
        v-model="query"
        class="search-input"
        placeholder="Search your knowledge graph..."
        @keydown.enter="handleSearch"
      />
      <button class="search-btn" @click="handleSearch" :disabled="loading">
        {{ loading ? '...' : 'Search' }}
      </button>
    </div>

    <div v-if="error" class="search-error">{{ error }}</div>

    <div v-if="results.length" class="search-results">
      <div
        v-for="result in results"
        :key="result.id"
        class="result-item"
        @click="emit('select-node', result.id)"
      >
        <div class="result-header">
          <NodeTypeBadge :type="result.type" />
          <StatusBadge :status="result.status" />
          <span v-if="result.similarity != null" class="similarity">
            {{ Math.round((result.similarity ?? result.rank ?? 0) * 100) }}% match
          </span>
        </div>
        <h4 class="result-title">{{ result.title || 'Untitled' }}</h4>
        <p class="result-snippet">
          {{ result.content.substring(0, 120) }}{{ result.content.length > 120 ? '...' : '' }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  padding: 16px;
}

.search-input-group {
  display: flex;
  gap: 8px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  font-size: 0.95rem;
  outline: none;
}

.search-input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-btn {
  padding: 10px 20px;
  background: #3B82F6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
}

.search-btn:hover:not(:disabled) {
  background: #2563EB;
}

.search-error {
  color: #EF4444;
  font-size: 0.85rem;
  margin-top: 8px;
}

.search-results {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  padding: 12px;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.result-item:hover {
  border-color: #3B82F6;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.similarity {
  font-size: 0.7rem;
  color: #9CA3AF;
  margin-left: auto;
}

.result-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 4px;
  color: #111827;
}

.result-snippet {
  font-size: 0.85rem;
  color: #6B7280;
  margin: 0;
  line-height: 1.4;
}
</style>
