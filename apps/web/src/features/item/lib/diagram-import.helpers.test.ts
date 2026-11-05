import flowchartFixture from '@docgraph/common/fixtures/flowchart.json'
import { DIAGRAM_MAPS, flowchartSchema } from '@docgraph/common/schemas'
import { describe, expect, it } from 'vitest'
import { Doc, encodeStateAsUpdate } from 'yjs'
import { parseDiagramFile } from './diagram-import.helpers'

/**
 * jsdom's File polyfill lacks `text()` and `arrayBuffer()`, so minimal
 * File-like objects are used — `parseDiagramFile` only reads `name` and those.
 */
const textFile = (text: string, name = 'diagram.json') => ({ name, text: async () => text }) as File

const jsonFile = (payload: unknown, name?: string) => textFile(JSON.stringify(payload), name)

const binaryFile = (bytes: Uint8Array, name = 'diagram.docgraph') =>
  ({ name, arrayBuffer: async () => bytes }) as unknown as File

/** Builds a `.docgraph` file the way the export does: the raw state of a diagram's Yjs maps. */
const docgraphFile = (document: { nodes: object[]; edges: object[]; areas: object[] }) => {
  const doc = new Doc()
  for (const key of ['nodes', 'edges', 'areas'] as const) {
    const map = doc.getMap(DIAGRAM_MAPS[key])
    for (const element of document[key] as { id: string }[]) map.set(element.id, element)
  }
  return binaryFile(encodeStateAsUpdate(doc))
}

const parse = (file: File) => parseDiagramFile(file, flowchartSchema, 'FLOWCHART')

describe('parseDiagramFile', () => {
  it('accepts a JSON export', async () => {
    const result = await parse(jsonFile(flowchartFixture))

    if (!result.ok) throw new Error(result.error)
    expect(result.data).toEqual(flowchartSchema.parse(flowchartFixture))
  })

  it('accepts a .docgraph backup and stamps it with the item type', async () => {
    const result = await parse(docgraphFile(flowchartFixture))

    if (!result.ok) throw new Error(result.error)
    expect(result.data.type).toBe('FLOWCHART')
    expect(result.data.nodes).toEqual(flowchartFixture.nodes)
    expect(result.data.edges).toEqual(flowchartFixture.edges)
    expect(result.data.areas).toEqual(flowchartFixture.areas)
  })

  it('accepts an empty .docgraph backup', async () => {
    const result = await parse(docgraphFile({ nodes: [], edges: [], areas: [] }))

    expect(result).toEqual({
      ok: true,
      data: { type: 'FLOWCHART', nodes: [], edges: [], areas: [] },
    })
  })

  it('rejects a .docgraph file that does not decode', async () => {
    const result = await parse(binaryFile(new Uint8Array([1, 2, 3])))

    expect(result).toEqual({ ok: false, error: 'Not a valid .docgraph file.' })
  })

  it('rejects malformed JSON', async () => {
    const result = await parse(textFile('{ nope'))

    expect(result).toEqual({ ok: false, error: 'Not a valid JSON file.' })
  })

  it('rejects an unsupported file extension', async () => {
    const result = await parse(jsonFile(flowchartFixture, 'diagram.txt'))

    expect(result).toEqual({ ok: false, error: 'Not a valid file type.' })
  })

  it('rejects a JSON export of another item type', async () => {
    const result = await parse(jsonFile({ ...flowchartFixture, type: 'DATABASE_DIAGRAM' }))

    expect(result.ok).toBe(false)
  })

  it('reports schema violations with their path', async () => {
    const [edge, ...edges] = flowchartFixture.edges
    const broken = { ...flowchartFixture, edges: [{ ...edge, source: 'missing' }, ...edges] }

    const result = await parse(jsonFile(broken))

    if (result.ok) throw new Error('expected the import to fail')
    expect(result.error).toContain('Edge source must reference a flowchart node.')
    expect(result.error).toContain('edges[0].source')
  })

  it('rejects a .docgraph backup whose content breaks the schema', async () => {
    const [node, ...nodes] = flowchartFixture.nodes
    const result = await parse(
      docgraphFile({ ...flowchartFixture, nodes: [{ ...node, type: 'unknownNode' }, ...nodes] }),
    )

    expect(result.ok).toBe(false)
  })
})
