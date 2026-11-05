import type { SuggestionProps } from '@tiptap/suggestion'
import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react'
import type { SlashCommandItem } from './slash-command-items'

/** Imperative handle the suggestion plugin uses to forward key events. */
export type SlashCommandListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

/** Dropdown rendered by the "/" suggestion: filterable block list with keyboard navigation. */
export const SlashCommandList = forwardRef<
  SlashCommandListRef,
  SuggestionProps<SlashCommandItem, SlashCommandItem>
>(({ items, command }, ref) => {
  const listRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  // Reset the highlight whenever the filter produces a new items array, using
  // the recommended "adjust state during render" pattern (no effect needed).
  const [selected, setSelected] = useState({ items, index: 0 })

  if (selected.items !== items) {
    setSelected({ items, index: 0 })
  }

  const selectedIndex = selected.index

  const selectIndex = (index: number) => {
    setSelected({ items, index })
    listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown' && items.length > 0) {
        selectIndex((selectedIndex + 1) % items.length)
        return true
      }
      if (event.key === 'ArrowUp' && items.length > 0) {
        selectIndex((selectedIndex - 1 + items.length) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = items[selectedIndex]
        if (item) {
          command(item)
        }
        return true
      }
      return false
    },
  }))

  return (
    <div
      className='slash-command-menu'
      ref={listRef}
      role='listbox'
      tabIndex={0}
      aria-label='Slash commands'
      aria-activedescendant={items.length > 0 ? `${baseId}-${selectedIndex}` : undefined}
    >
      {items.length === 0 && <div className='slash-command-empty'>No results</div>}
      {items.map((item, index) => (
        <button
          key={item.title}
          id={`${baseId}-${index}`}
          type='button'
          role='option'
          className='slash-command-item'
          aria-selected={index === selectedIndex}
          data-selected={index === selectedIndex}
          onMouseMove={() => setSelected({ items, index })}
          onClick={() => command(item)}
        >
          <span className='slash-command-item-icon'>
            <item.Icon aria-hidden='true' />
          </span>
          <span className='slash-command-item-text'>
            <span className='slash-command-item-title'>{item.title}</span>
            <span className='slash-command-item-description'>{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
})
