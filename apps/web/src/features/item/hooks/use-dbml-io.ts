import {
  applyDatabaseSchema,
  DatabaseSchemaError,
  type DiagramEdge,
  type DiagramNode,
  toDatabaseSchema,
} from '@docgraph/common/diagram'
import { toast } from '@/components/ui/toast'
import { showErrorToast } from '@/lib/error-toast'
import type { AreaNode } from '../components/base/area-node'
import type { DatabaseEdge } from '../components/database-diagram/database-edge'
import type { DatabaseNode } from '../components/database-diagram/database-node'
import { toDbml } from '../components/database-diagram/dbml/dbml-export.helpers'
import { downloadFile } from '../lib/download.helpers'

type DatabaseDocument = { nodes: DatabaseNode[]; edges: DatabaseEdge[]; areas: AreaNode[] }

type UseDbmlIoArgs = DatabaseDocument & {
  itemName: string
  replaceDocument: (document: DatabaseDocument) => void
}

/** Edges still being connected have no handle yet and are not relations. */
const connectedEdges = (edges: DatabaseEdge[]) =>
  edges.flatMap(({ sourceHandle, targetHandle, ...edge }): DiagramEdge[] =>
    sourceHandle && targetHandle ? [{ ...edge, sourceHandle, targetHandle }] : [],
  )

// React Flow allows CSS strings in `style`; the editor only stores numeric sizes.
const asDiagramNodes = (nodes: DatabaseNode[]) => nodes as DiagramNode[]

/**
 * DBML import and export of a database diagram. An import replaces the tables and relations
 * but matches tables and columns by name, so their positions, sizes and colors survive a
 * round trip through an external DBML editor.
 */
export const useDbmlIo = ({ nodes, edges, areas, itemName, replaceDocument }: UseDbmlIoArgs) => {
  const handleImportDbml = async (file: File) => {
    try {
      // The parser is large, so it loads only when a DBML file is imported.
      const [{ parseDbml }, source] = await Promise.all([
        import('../components/database-diagram/dbml/dbml-import.helpers'),
        file.text(),
      ])
      const parsed = parseDbml(source)
      if (!parsed.ok) {
        toast.add({ type: 'error', title: 'Import failed', description: parsed.error })
        return
      }

      const result = applyDatabaseSchema(
        { nodes: asDiagramNodes(nodes), edges: connectedEdges(edges) },
        parsed.schema,
        'replace',
      )
      replaceDocument({
        nodes: result.nodes as DatabaseNode[],
        edges: result.edges as DatabaseEdge[],
        areas,
      })
    } catch (error) {
      if (error instanceof DatabaseSchemaError) {
        toast.add({ type: 'error', title: 'Import failed', description: error.message })
        return
      }
      showErrorToast('Could not import the DBML file', error)
    }
  }

  const handleDownloadDbml = () =>
    downloadFile(
      toDbml(toDatabaseSchema({ nodes: asDiagramNodes(nodes), edges: connectedEdges(edges) })),
      `${itemName}.dbml`,
      'dbml',
    )

  return { handleImportDbml, handleDownloadDbml }
}
