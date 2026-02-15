/**
 * TipTap extension for [[ wiki-link ]] autocomplete.
 *
 * When user types [[, a suggestion popup appears with matching nodes.
 * On selection, a wiki-link is inserted and the user is prompted
 * to choose an edge type for the relationship.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import type { SuggestionOptions } from '@tiptap/suggestion'

// The rendered wiki-link node in the document
export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-wiki-link': '', class: 'wiki-link' },
        HTMLAttributes
      ),
      `[[${HTMLAttributes.label || ''}]]`,
    ]
  },

  renderText({ node }) {
    return `[[${node.attrs.label || ''}]]`
  },
})

// Suggestion configuration factory — takes callbacks from the parent component
export function createWikiLinkSuggestion(
  searchFn: (query: string) => Promise<{ id: string; label: string }[]>,
  onSelectFn: (item: { id: string; label: string }) => void
): Partial<SuggestionOptions> {
  return {
    char: '[[',
    allowSpaces: true,

    items: async ({ query }: { query: string }) => {
      if (!query) return []
      return searchFn(query)
    },

    render: () => {
      let popup: HTMLElement | null = null
      let currentItems: { id: string; label: string }[] = []
      let selectedIndex = 0

      function createPopup() {
        popup = document.createElement('div')
        popup.className = 'wiki-link-suggestions'
        document.body.appendChild(popup)
        return popup
      }

      function updatePopup() {
        if (!popup) return
        popup.innerHTML = currentItems
          .map(
            (item, i) =>
              `<button class="suggestion-item${i === selectedIndex ? ' selected' : ''}" data-index="${i}">${item.label}</button>`
          )
          .join('')

        // Attach click handlers
        popup.querySelectorAll('.suggestion-item').forEach((btn) => {
          btn.addEventListener('mousedown', (e) => {
            e.preventDefault()
            const idx = parseInt((btn as HTMLElement).dataset.index || '0')
            onSelectFn(currentItems[idx])
          })
        })
      }

      return {
        onStart(props: { clientRect?: (() => DOMRect | null) | null; items: { id: string; label: string }[] }) {
          createPopup()
          currentItems = props.items
          selectedIndex = 0
          updatePopup()

          const rect = props.clientRect?.()
          if (popup && rect) {
            popup.style.left = `${rect.left}px`
            popup.style.top = `${rect.bottom + 4}px`
          }
        },

        onUpdate(props: { clientRect?: (() => DOMRect | null) | null; items: { id: string; label: string }[] }) {
          currentItems = props.items
          selectedIndex = 0
          updatePopup()

          const rect = props.clientRect?.()
          if (popup && rect) {
            popup.style.left = `${rect.left}px`
            popup.style.top = `${rect.bottom + 4}px`
          }
        },

        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === 'ArrowDown') {
            selectedIndex = (selectedIndex + 1) % currentItems.length
            updatePopup()
            return true
          }
          if (props.event.key === 'ArrowUp') {
            selectedIndex =
              (selectedIndex - 1 + currentItems.length) % currentItems.length
            updatePopup()
            return true
          }
          if (props.event.key === 'Enter') {
            const item = currentItems[selectedIndex]
            if (item) {
              onSelectFn(item)
            }
            return true
          }
          if (props.event.key === 'Escape') {
            popup?.remove()
            popup = null
            return true
          }
          return false
        },

        onExit() {
          popup?.remove()
          popup = null
        },
      }
    },
  }
}

// The Mention-based extension configured for [[ syntax
export function createWikiLinkMention(
  searchFn: (query: string) => Promise<{ id: string; label: string }[]>,
  onSelectFn: (item: { id: string; label: string }) => void
) {
  return Mention.configure({
    HTMLAttributes: { class: 'wiki-link' },
    renderText({ node }) {
      return `[[${node.attrs.label ?? node.attrs.id}]]`
    },
    renderHTML({ options, node }) {
      return [
        'span',
        mergeAttributes({ class: 'wiki-link' }, options.HTMLAttributes),
        `[[${node.attrs.label ?? node.attrs.id}]]`,
      ]
    },
    suggestion: createWikiLinkSuggestion(searchFn, onSelectFn),
  })
}
