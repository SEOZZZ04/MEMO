<script setup lang="ts">
import type { EdgeType } from '../../types/ontology'
import { EDGE_TYPE_LABELS, EDGE_TYPE_COLORS } from '../../types/ontology'

const props = defineProps<{
  modelValue?: EdgeType
  show: boolean
  position?: { x: number; y: number }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EdgeType]
  close: []
}>()

const edgeTypes: EdgeType[] = [
  'related_to',
  'supports',
  'refutes',
  'defines',
  'caused_by',
  'derived_from',
  'example_of',
  'part_of',
]

function selectType(type: EdgeType) {
  emit('update:modelValue', type)
  emit('close')
}
</script>

<template>
  <div
    v-if="show"
    class="edge-picker-overlay"
    @click.self="emit('close')"
  >
    <div
      class="edge-picker"
      :style="position ? { left: position.x + 'px', top: position.y + 'px' } : {}"
    >
      <div class="picker-header">관계 타입 선택</div>
      <button
        v-for="type in edgeTypes"
        :key="type"
        class="picker-option"
        :class="{ selected: modelValue === type }"
        @click="selectType(type)"
      >
        <span
          class="type-dot"
          :style="{ backgroundColor: EDGE_TYPE_COLORS[type] }"
        />
        <span class="type-label">{{ EDGE_TYPE_LABELS[type] }}</span>
        <span class="type-name">({{ type }})</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.edge-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.1);
}

.edge-picker {
  position: absolute;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: 4px;
  min-width: 220px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.picker-header {
  padding: 8px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #F3F4F6;
}

.picker-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.875rem;
  border-radius: 4px;
  color: #374151;
}

.picker-option:hover {
  background: #F9FAFB;
}

.picker-option.selected {
  background: #EFF6FF;
}

.type-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.type-label {
  font-weight: 500;
}

.type-name {
  color: #9CA3AF;
  font-size: 0.75rem;
  margin-left: auto;
}
</style>
