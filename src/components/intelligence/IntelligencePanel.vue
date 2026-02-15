<script setup lang="ts">
import { ref } from 'vue'
import LocalGraphTab from './LocalGraphTab.vue'
import SimilarContextTab from './SimilarContextTab.vue'
import ModelSwitcher from './ModelSwitcher.vue'

const props = defineProps<{
  currentNodeId?: string | null
  currentContent?: string
}>()

const emit = defineEmits<{
  'select-node': [id: string]
}>()

type TabId = 'graph' | 'similar'
const activeTab = ref<TabId>('graph')
</script>

<template>
  <div class="intel-panel">
    <!-- Model Switcher at top -->
    <ModelSwitcher />

    <!-- Tab headers -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'graph' }"
        @click="activeTab = 'graph'"
      >Local Graph</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'similar' }"
        @click="activeTab = 'similar'"
      >Similar Context</button>
    </div>

    <!-- Tab content -->
    <div class="tab-content">
      <LocalGraphTab
        v-if="activeTab === 'graph'"
        :node-id="currentNodeId"
        @select-node="(id) => emit('select-node', id)"
      />
      <SimilarContextTab
        v-if="activeTab === 'similar'"
        :content="currentContent"
        @select-node="(id) => emit('select-node', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.intel-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-left: 1px solid #E5E7EB;
}

.tab-bar {
  display: flex;
  border-bottom: 1px solid #E5E7EB;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 10px 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 0.8rem;
  font-weight: 500;
  color: #9CA3AF;
  cursor: pointer;
  transition: all 0.12s;
}

.tab-btn:hover {
  color: #6B7280;
  background: #F9FAFB;
}

.tab-btn.active {
  color: #2563EB;
  border-bottom-color: #3B82F6;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
}
</style>
