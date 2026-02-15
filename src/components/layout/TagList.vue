<script setup lang="ts">
defineProps<{
  tags: string[]
  activeTag?: string | null
}>()

const emit = defineEmits<{
  'select-tag': [tag: string | null]
}>()
</script>

<template>
  <div class="tag-list">
    <div class="tag-header">
      <span class="tag-title">Tags</span>
      <button
        v-if="activeTag"
        class="tag-clear"
        @click="emit('select-tag', null)"
      >Clear</button>
    </div>

    <div v-if="tags.length === 0" class="tag-empty">No tags yet</div>

    <div class="tag-items">
      <button
        v-for="tag in tags"
        :key="tag"
        class="tag-item"
        :class="{ active: activeTag === tag }"
        @click="emit('select-tag', tag)"
      >
        <span class="tag-hash">#</span>{{ tag }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tag-list {
  padding: 8px 0;
}

.tag-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px 8px;
}

.tag-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9CA3AF;
}

.tag-clear {
  background: none;
  border: none;
  font-size: 0.7rem;
  color: #3B82F6;
  cursor: pointer;
  padding: 0;
}

.tag-empty {
  padding: 4px 16px;
  font-size: 0.8rem;
  color: #D1D5DB;
}

.tag-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 12px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 2px 8px;
  background: #F3F4F6;
  border: 1px solid transparent;
  border-radius: 9999px;
  font-size: 0.75rem;
  color: #6B7280;
  cursor: pointer;
  transition: all 0.1s;
}

.tag-item:hover {
  background: #E5E7EB;
  color: #374151;
}

.tag-item.active {
  background: #DBEAFE;
  border-color: #93C5FD;
  color: #1D4ED8;
}

.tag-hash {
  color: #9CA3AF;
  font-weight: 600;
}

.tag-item.active .tag-hash {
  color: #3B82F6;
}
</style>
