<script setup lang="ts">
import type { NodeType } from '../../types/ontology'
import { NODE_TYPE_LABELS, NODE_TYPE_COLORS } from '../../types/ontology'

const props = defineProps<{
  type: NodeType
}>()
</script>

<template>
  <span
    class="type-badge"
    :style="{ backgroundColor: NODE_TYPE_COLORS[props.type] + '20', color: NODE_TYPE_COLORS[props.type], borderColor: NODE_TYPE_COLORS[props.type] }"
  >
    {{ NODE_TYPE_LABELS[props.type] }}
  </span>
</template>

<style scoped>
.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  border: 1px solid;
}
</style>
