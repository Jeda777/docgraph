import { EdgeLabelRenderer } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'
import { useDiagramMutationContext } from './diagram-canvas'

export type EdgeTextEditorProps = {
  edgeId: string
  value: string
  x: number
  y: number
  readOnly?: boolean
  onCommit?: (value: string) => void
  onCancel?: () => void
}

/** Compact single-line edge label editor positioned in React Flow's label layer. */
export const EdgeTextEditor = ({
  edgeId,
  value,
  x,
  y,
  readOnly: readOnlyProp,
  onCommit,
  onCancel,
}: EdgeTextEditorProps) => {
  const documentReadOnly = useDocumentReadOnly()
  const readOnly = readOnlyProp ?? documentReadOnly
  const mutations = useDiagramMutationContext()
  const [draft, setDraft] = useState(value)
  const originalValue = useRef(value)
  const skipBlurCommit = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const commit = () => {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false
      return
    }

    if (!readOnly && draft !== originalValue.current) {
      onCommit?.(draft)
      mutations?.setEdges((edges) =>
        edges.map((edge) =>
          edge.id === edgeId ? { ...edge, data: { ...edge.data, text: draft } } : edge,
        ),
      )
    }

    originalValue.current = draft
  }

  const cancel = () => {
    skipBlurCommit.current = true
    setDraft(originalValue.current)
    onCancel?.()
  }

  return (
    <EdgeLabelRenderer>
      <div
        className='nodrag nopan pointer-events-auto absolute'
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
      >
        <input
          ref={inputRef}
          aria-label='Edge text'
          className={cn(
            'nodrag nopan w-32 rounded border bg-card px-1 py-0.5 text-center text-xs text-card-foreground',
            'outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
          disabled={readOnly}
          readOnly={readOnly}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Escape') {
              event.preventDefault()
              cancel()
            } else if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
        />
      </div>
    </EdgeLabelRenderer>
  )
}
