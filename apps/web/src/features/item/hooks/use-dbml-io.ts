import {
  applyDatabaseSchema,
  DatabaseSchemaError,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
  toDatabaseSchema,
} from '@docgraph/common/diagram'
import type { DatabaseDiagramEnum } from '@docgraph/common/schemas'
import { toast } from '@/components/ui/toast'
import { showErrorToast } from '@/lib/error-toast'
import type { AreaNode } from '../components/base/area-node'
import type { DatabaseEdge } from '../components/database-diagram/database-edge'
import type { DatabaseNode } from '../components/database-diagram/database-node'
import { toDbml } from '../components/database-diagram/dbml/dbml-export.helpers'
import { downloadFile } from '../lib/download.helpers'

export type DatabaseDocument = {
  nodes: DatabaseNode[]
  edges: DatabaseEdge[]
  areas: AreaNode[]
  enums: DatabaseDiagramEnum[]
}

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

const toDiagramDocument = ({ nodes, edges, enums, areas }: DatabaseDocument): DiagramDocument => ({
  nodes: asDiagramNodes(nodes),
  edges: connectedEdges(edges),
  enums,
  areas: areas as DiagramNode[],
})

/**
 * DBML import and export of a database diagram. An import replaces the tables, enums, table
 * groups and relations but matches them by name, so ids, positions, sizes and colors survive
 * a round trip through an external DBML editor. Table groups are the areas around tables.
 */
export const useDbmlIo = ({ itemName, replaceDocument, ...document }: UseDbmlIoArgs) => {
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

      // A DBML file describes the whole diagram, so a file without groups removes them.
      const schema = { ...parsed.schema, groups: parsed.schema.groups ?? [] }
      const result = applyDatabaseSchema(toDiagramDocument(document), schema, 'replace')
      replaceDocument({
        nodes: result.nodes as DatabaseNode[],
        edges: result.edges as DatabaseEdge[],
        areas: (result.areas ?? []) as AreaNode[],
        enums: result.enums ?? [],
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
    downloadFile(toDbml(toDatabaseSchema(toDiagramDocument(document))), `${itemName}.dbml`, 'dbml')

  return { handleImportDbml, handleDownloadDbml }
}
