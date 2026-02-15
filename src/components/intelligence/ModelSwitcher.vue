<script setup lang="ts">
import { useAI, AI_MODELS } from '../../composables/useAI'


const { selectedModel, selectModel } = useAI()

function handleChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  const model = AI_MODELS.find((m) => m.id === id)
  if (model) selectModel(model)
}
</script>

<template>
  <div class="model-switcher">
    <label class="switcher-label">AI Model</label>
    <select
      class="switcher-select"
      :value="selectedModel.id"
      @change="handleChange"
    >
      <option
        v-for="model in AI_MODELS"
        :key="model.id"
        :value="model.id"
      >
        {{ model.name }}
      </option>
    </select>
    <span class="model-desc">{{ selectedModel.description }}</span>
  </div>
</template>

<style scoped>
.model-switcher {
  padding: 10px 14px;
  border-bottom: 1px solid #F3F4F6;
  flex-shrink: 0;
}

.switcher-label {
  display: block;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9CA3AF;
  margin-bottom: 4px;
}

.switcher-select {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid #E5E7EB;
  border-radius: 6px;
  font-size: 0.82rem;
  background: white;
  color: #374151;
  font-weight: 500;
}

.model-desc {
  display: block;
  font-size: 0.7rem;
  color: #9CA3AF;
  margin-top: 3px;
}
</style>
