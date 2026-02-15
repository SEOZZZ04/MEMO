<script setup lang="ts">
import { ref } from 'vue'
import type { Folder } from '../../types/ontology'

const props = defineProps<{
  folders: Folder[]
  activeFolderId?: string | null
}>()

const emit = defineEmits<{
  'select-folder': [id: string | null]
  'create-folder': [name: string]
}>()

const newFolderName = ref('')
const showCreateInput = ref(false)

function handleCreate() {
  const name = newFolderName.value.trim()
  if (!name) return
  emit('create-folder', name)
  newFolderName.value = ''
  showCreateInput.value = false
}

const systemFolderIcons: Record<string, string> = {
  inbox: '\u{1F4E5}',
  'knowledge-base': '\u{1F4DA}',
  archive: '\u{1F4E6}',
  trash: '\u{1F5D1}',
}
</script>

<template>
  <div class="folder-tree">
    <div class="tree-header">
      <span class="tree-title">Folders</span>
      <button class="tree-add-btn" @click="showCreateInput = !showCreateInput" title="New folder">+</button>
    </div>

    <!-- All notes -->
    <button
      class="tree-item"
      :class="{ active: activeFolderId === null }"
      @click="emit('select-folder', null)"
    >
      <span class="tree-icon">&#128196;</span>
      <span>All Notes</span>
    </button>

    <!-- System folders -->
    <button
      v-for="folder in folders.filter(f => f.is_system)"
      :key="folder.id"
      class="tree-item system"
      :class="{ active: activeFolderId === folder.id }"
      @click="emit('select-folder', folder.id)"
    >
      <span class="tree-icon">{{ systemFolderIcons[folder.slug] || '\u{1F4C1}' }}</span>
      <span>{{ folder.name }}</span>
    </button>

    <!-- User folders -->
    <div v-if="folders.some(f => !f.is_system)" class="tree-divider" />
    <button
      v-for="folder in folders.filter(f => !f.is_system)"
      :key="folder.id"
      class="tree-item"
      :class="{ active: activeFolderId === folder.id }"
      @click="emit('select-folder', folder.id)"
    >
      <span class="tree-icon">&#128193;</span>
      <span>{{ folder.name }}</span>
    </button>

    <!-- Create new folder -->
    <div v-if="showCreateInput" class="tree-create">
      <input
        v-model="newFolderName"
        class="tree-create-input"
        placeholder="Folder name..."
        @keydown.enter="handleCreate"
        @keydown.escape="showCreateInput = false"
        autofocus
      />
    </div>
  </div>
</template>

<style scoped>
.folder-tree {
  padding: 8px 0;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px 8px;
}

.tree-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9CA3AF;
}

.tree-add-btn {
  background: none;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #9CA3AF;
  font-size: 0.9rem;
  padding: 0;
  line-height: 1;
}

.tree-add-btn:hover {
  background: #F3F4F6;
  color: #374151;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 16px;
  border: none;
  background: none;
  text-align: left;
  font-size: 0.85rem;
  color: #374151;
  cursor: pointer;
  border-radius: 0;
  transition: background 0.1s;
}

.tree-item:hover {
  background: #F3F4F6;
}

.tree-item.active {
  background: #EFF6FF;
  color: #2563EB;
  font-weight: 500;
}

.tree-icon {
  font-size: 0.9rem;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.tree-divider {
  height: 1px;
  background: #F3F4F6;
  margin: 4px 16px;
}

.tree-create {
  padding: 4px 16px;
}

.tree-create-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 0.8rem;
  border: 1px solid #D1D5DB;
  border-radius: 4px;
  outline: none;
}

.tree-create-input:focus {
  border-color: #3B82F6;
}
</style>
