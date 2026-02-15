<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  nodeTitle: string
  suggestedTags?: string[]
}>()

const emit = defineEmits<{
  dismiss: []
  'add-tag': [tag: string]
  'open-link': []
}>()

const visible = ref(false)

watch(
  () => props.show,
  (val) => {
    visible.value = val
    if (val) {
      // Auto-dismiss after 12 seconds
      setTimeout(() => {
        if (visible.value) {
          visible.value = false
          emit('dismiss')
        }
      }, 12000)
    }
  }
)
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible" class="orphan-alert">
      <div class="alert-icon">&#127850;</div>
      <div class="alert-body">
        <p class="alert-title">This note is an orphan island</p>
        <p class="alert-desc">
          "<strong>{{ nodeTitle || 'Untitled' }}</strong>" has no connections.
          Add a tag or link it to related notes to integrate it into your knowledge graph.
        </p>
        <div class="alert-actions">
          <button
            v-for="tag in (suggestedTags ?? ['idea', 'inbox', 'question'])"
            :key="tag"
            class="suggested-tag"
            @click="emit('add-tag', tag)"
          >#{{ tag }}</button>
          <button class="link-btn" @click="emit('open-link')">
            Link to note...
          </button>
        </div>
      </div>
      <button class="alert-close" @click="visible = false; emit('dismiss')">&times;</button>
    </div>
  </Transition>
</template>

<style scoped>
.orphan-alert {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: white;
  border: 1px solid #FDE68A;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  padding: 16px 20px;
  max-width: 520px;
  width: 90vw;
}

.alert-icon {
  font-size: 1.6rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-body {
  flex: 1;
}

.alert-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: #92400E;
  margin: 0 0 4px;
}

.alert-desc {
  font-size: 0.82rem;
  color: #6B7280;
  margin: 0 0 10px;
  line-height: 1.4;
}

.alert-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggested-tag {
  padding: 3px 10px;
  border: 1px solid #E5E7EB;
  border-radius: 9999px;
  background: #F9FAFB;
  font-size: 0.75rem;
  color: #374151;
  cursor: pointer;
  font-weight: 500;
}

.suggested-tag:hover {
  background: #DBEAFE;
  border-color: #93C5FD;
  color: #1D4ED8;
}

.link-btn {
  padding: 3px 10px;
  border: 1px solid #3B82F6;
  border-radius: 9999px;
  background: white;
  font-size: 0.75rem;
  color: #3B82F6;
  cursor: pointer;
  font-weight: 500;
}

.link-btn:hover {
  background: #3B82F6;
  color: white;
}

.alert-close {
  background: none;
  border: none;
  color: #9CA3AF;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}

.alert-close:hover { color: #374151; }

/* Transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
