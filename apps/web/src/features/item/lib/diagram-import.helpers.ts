import { DIAGRAM_MAPS, type ItemType } from '@docgraph/common/schemas'
import { applyUpdate, Doc } from 'yjs'
import { z } from 'zod'

export const parseDiagramFile = async <T extends z.ZodTypeAny>(
  file: File,
  schema: T,
  documentType: ItemType,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; error: string }> => {
  let raw: unknown

  if (file.name.endsWith('.docgraph')) {
    const doc = new Doc()
    try {
      applyUpdate(doc, new Uint8Array(await file.arrayBuffer()))
    } catch {
      return { ok: false, error: 'Not a valid .docgraph file.' }
    }
    raw = {
      type: documentType,
      nodes: Array.from(doc.getMap(DIAGRAM_MAPS.nodes).values()),
      edges: Array.from(doc.getMap(DIAGRAM_MAPS.edges).values()),
      areas: Array.from(doc.getMap(DIAGRAM_MAPS.areas).values()),
    }
  } else if (file.name.endsWith('.json')) {
    try {
      raw = JSON.parse(await file.text())
    } catch {
      return { ok: false, error: 'Not a valid JSON file.' }
    }
  } else {
    return { ok: false, error: 'Not a valid file type.' }
  }

  const result = schema.safeParse(raw)
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: z.prettifyError(result.error) }
}
