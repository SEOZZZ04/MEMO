<script setup lang="ts">
import type { GovernanceStatus } from '../../types/ontology'
import { STATUS_LABELS } from '../../types/ontology'

const props = defineProps<{
  status: GovernanceStatus
}>()

const statusClass = {
  Active: 'badge-active',
  Experimental: 'badge-experimental',
  Deprecated: 'badge-deprecated',
}
</script>

<template>
  <span class="badge" :class="statusClass[props.status]">
    {{ STATUS_LABELS[props.status] }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-active {
  background: #DCFCE7;
  color: #166534;
  border: 1px solid #86EFAC;
}

.badge-experimental {
  background: #FEF3C7;
  color: #92400E;
  border: 1px dashed #FCD34D;
  animation: pulse-border 2s ease-in-out infinite;
}

.badge-deprecated {
  background: #F3F4F6;
  color: #6B7280;
  border: 1px solid #D1D5DB;
  text-decoration: line-through;
}

@keyframes pulse-border {
  0%, 100% { border-color: #FCD34D; }
  50% { border-color: #F59E0B; }
}
</style>
