import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Folder } from '../types/ontology'

export function useFolders() {
  const folders = ref<Folder[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchFolders() {
    loading.value = true
    error.value = null

    const { data, error: err } = await supabase
      .from('folders')
      .select('*')
      .order('sort_order', { ascending: true })

    if (err) {
      error.value = err.message
    } else {
      folders.value = (data as unknown as Folder[]) ?? []
    }
    loading.value = false
  }

  async function createFolder(name: string, parentId?: string): Promise<Folder | null> {
    error.value = null

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      error.value = 'Not authenticated'
      return null
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    const { data, error: err } = await supabase
      .from('folders')
      .insert({
        user_id: userData.user.id,
        name,
        slug,
        parent_id: parentId ?? null,
        is_system: false,
      })
      .select()
      .single()

    if (err) {
      error.value = err.message
      return null
    }

    const newFolder = data as unknown as Folder
    folders.value = [...folders.value, newFolder]
    return newFolder
  }

  function getSystemFolder(slug: string): Folder | undefined {
    return folders.value.find((f) => f.is_system && f.slug === slug)
  }

  return {
    folders,
    loading,
    error,
    fetchFolders,
    createFolder,
    getSystemFolder,
  }
}
