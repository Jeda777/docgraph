import { PluginKey } from '@tiptap/pm/state'
import { Extension, ReactRenderer } from '@tiptap/react'
import { exitSuggestion, Suggestion, type SuggestionOptions } from '@tiptap/suggestion'
import { filterSlashCommandItems, type SlashCommandItem } from './slash-command-items'
import { SlashCommandList, type SlashCommandListRef } from './slash-command-list'

const slashCommandsPluginKey = new PluginKey('slashCommands')

const suggestion: Partial<SuggestionOptions<SlashCommandItem, SlashCommandItem>> = {
  pluginKey: slashCommandsPluginKey,
  char: '/',
  items: ({ query }) => filterSlashCommandItems(query),
  command: ({ editor, range, props: item }) => {
    item.command({ editor, range })
  },
  render: () => {
    let component: ReactRenderer<SlashCommandListRef> | null = null
    let unmountPopup: (() => void) | null = null

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, {
          props,
          editor: props.editor,
        })
        // The plugin takes over: appends the element, anchors it to the
        // cursor, and repositions on scroll/resize (floating-ui autoUpdate).
        unmountPopup = props.mount(component.element)
      },
      onUpdate: (props) => {
        component?.updateProps(props)
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          exitSuggestion(props.view, slashCommandsPluginKey)
          return true
        }
        return component?.ref?.onKeyDown(props) ?? false
      },
      onExit: () => {
        unmountPopup?.()
        unmountPopup = null
        component?.destroy()
        component = null
      },
    }
  },
}

/** Notion-style "/" menu: typing "/" opens a filterable list of blocks. */
export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion,
    }
  },

  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })]
  },
})
