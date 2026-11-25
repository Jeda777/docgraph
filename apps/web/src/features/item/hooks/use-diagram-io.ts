import type { ItemType } from '@docgraph/common/schemas'
import type { Edge, Node } from '@xyflow/react'
import type { z } from 'zod'
import { toast } from '@/components/ui/toast'
import { showErrorToast } from '@/lib/error-toast'
import { parseDiagramFile } from '../lib/diagram-import.helpers'
import { downloadDiagramImage, downloadFile, type ImageFormat } from '../lib/download.helpers'

type UseDiagramIoArgs<
  N extends Node,
  E extends Edge,
  A extends Node,
  D extends { nodes: N[]; edges: E[]; areas: A[] },
> = {
  itemType: ItemType
  /** Schema validating imported files; its output feeds `replaceDocument`. */
  schema: z.ZodType<D>
  nodes: N[]
  edges: E[]
  areas: A[]
  /** Diagram-specific parts of the document beyond the canvas, written to the JSON export. */
  extra?: Omit<D, 'nodes' | 'edges' | 'areas'>
  itemName: string
  /** Replaces the whole document in one Yjs transaction, so an import is a single change. */
  replaceDocument: (document: D) => void
}

/**
 * Import/export plumbing shared by every diagram sidebar: file import
 * (.json/.docgraph) validated against the diagram schema, JSON export and
 * canvas image export.
 */
export const useDiagramIo = <
  N extends Node,
  E extends Edge,
  A extends Node,
  D extends { nodes: N[]; edges: E[]; areas: A[] } = { nodes: N[]; edges: E[]; areas: A[] },
>({
  itemType,
  schema,
  nodes,
  edges,
  areas,
  extra,
  itemName,
  replaceDocument,
}: UseDiagramIoArgs<N, E, A, D>) => {
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const result = await parseDiagramFile(file, schema, itemType)
    if (!result.ok) {
      toast.add({ type: 'error', title: 'Import failed', description: result.error })
      return
    }

    replaceDocument(result.data)
  }

  const handleDownloadJson = () => {
    downloadFile(
      JSON.stringify({ type: itemType satisfies ItemType, nodes, edges, areas, ...extra }, null, 2),
      `${itemName}.json`,
      'json',
    )
  }

  const handleDownloadImage = (format: ImageFormat) => {
    if (!nodes.length && !areas.length) {
      toast.add({
        type: 'info',
        title: 'Nothing to export',
        description: 'The diagram is empty.',
      })
      return
    }
    downloadDiagramImage([...areas, ...nodes], `${itemName}.${format}`, format).catch((error) =>
      showErrorToast('Could not export the diagram image', error),
    )
  }

  return { handleImport, handleDownloadJson, handleDownloadImage }
}
