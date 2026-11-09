import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'
import { useEditingPresence } from '../../hooks/use-editing-presence'
import { useRemoteNodeEditors } from '../../hooks/use-remote-node-editors'
import { useDiagramMutationContext } from './diagram-canvas'
import { EditCaret } from './edit-caret'

/** Edit presence field id of the node text, shared by the writer and the remote caret. */
const TEXT_FIELD = 'text'

export type EditableNodeAutoSize = {
  defaultWidth: number
  defaultHeight: number
  minWidth: number
  minHeight: number
  preserveAspectRatio?: boolean
}

export type EditableNodeTextProps = {
  nodeId: string
  value: string
  label: string
  readOnly?: boolean
  className?: string
  onCommit?: (value: string) => void
  autoSize?: EditableNodeAutoSize
  activateRequest?: number
}

const CHARACTER_WIDTH = 8
const LINE_HEIGHT = 22
const HORIZONTAL_PADDING = 32
const VERTICAL_PADDING = 24
const MAX_NODE_DIMENSION = 1200

export const getAutoSize = (text: string, options: EditableNodeAutoSize) => {
  const lines = text.split('\n')
  const longestLine = Math.max(0, ...lines.map((line) => line.length))
  const width = Math.min(
    MAX_NODE_DIMENSION,
    Math.max(
      options.minWidth,
      options.defaultWidth,
      longestLine * CHARACTER_WIDTH + HORIZONTAL_PADDING,
    ),
  )
  const height = Math.min(
    MAX_NODE_DIMENSION,
    Math.max(
      options.minHeight,
      options.defaultHeight,
      lines.length * LINE_HEIGHT + VERTICAL_PADDING,
    ),
  )

  if (!options.preserveAspectRatio) return { width, height }

  const size = Math.max(width, height)
  return { width: size, height: size }
}

/** Displays centered text while keeping the multiline editor out of the drag surface. */
export const EditableNodeText = ({
  nodeId,
  value,
  label,
  readOnly: readOnlyProp,
  className,
  onCommit,
  autoSize,
  activateRequest,
}: EditableNodeTextProps) => {
  const documentReadOnly = useDocumentReadOnly()
  const readOnly = readOnlyProp ?? documentReadOnly
  const mutations = useDiagramMutationContext()
  const { startEditing, stopEditing } = useEditingPresence()
  const remoteEditorColor = useRemoteNodeEditors(nodeId)[TEXT_FIELD]
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  const originalValue = useRef(value)
  const skipBlurCommit = useRef(false)
  const lastActivateRequest = useRef(activateRequest)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) {
      setDraft(value)
      originalValue.current = value
    }
  }, [editing, value])

  useEffect(() => {
    if (activateRequest === undefined || activateRequest === lastActivateRequest.current) return
    lastActivateRequest.current = activateRequest
    if (readOnly) return
    originalValue.current = value
    setDraft(value)
    setEditing(true)
  }, [activateRequest, readOnly, value])

  useEffect(() => {
    if (!editing) return
    textareaRef.current?.focus()
    const end = textareaRef.current?.value.length ?? 0
    textareaRef.current?.setSelectionRange(end, end)
  }, [editing])

  const commit = () => {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false
      return
    }

    if (!readOnly && draft !== originalValue.current) {
      onCommit?.(draft)
      mutations?.setNodes((nodes) =>
        nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, text: draft },
                ...(autoSize ? { style: { ...node.style, ...getAutoSize(draft, autoSize) } } : {}),
              }
            : node,
        ),
      )
    }

    originalValue.current = draft
    setEditing(false)
    stopEditing()
  }

  const cancel = () => {
    skipBlurCommit.current = true
    setDraft(originalValue.current)
    setEditing(false)
    stopEditing()
  }

  const beginEditing = () => {
    if (readOnly) return
    originalValue.current = value
    setDraft(value)
    setEditing(true)
  }

  if (!editing) {
    return (
      <button
        type='button'
        tabIndex={readOnly ? -1 : 0}
        aria-label={label}
        className={cn(
          'm-0 flex min-h-full min-w-full appearance-none items-center justify-center border-0 bg-transparent p-1 text-center font-inherit',
          'whitespace-pre-wrap break-words text-inherit cursor-move',
          className,
        )}
        onDoubleClick={(event) => {
          event.stopPropagation()
          beginEditing()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.stopPropagation()
            event.preventDefault()
            beginEditing()
          }
        }}
      >
        {value}
        {remoteEditorColor && <EditCaret color={remoteEditorColor} />}
      </button>
    )
  }

  return (
    <textarea
      ref={textareaRef}
      aria-label={label}
      className={cn(
        'nodrag nowheel m-0 block h-full w-full resize-none overflow-auto bg-transparent p-1',
        'text-center align-middle whitespace-pre-wrap break-words text-inherit outline-none',
        'focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
      disabled={readOnly}
      readOnly={readOnly}
      rows={1}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => {
        // A cancelled editor unmounts without a blur, so the flag would swallow the next commit.
        skipBlurCommit.current = false
        originalValue.current = draft
        if (!readOnly) startEditing(nodeId, TEXT_FIELD)
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          commit()
        }
      }}
    />
  )
}
