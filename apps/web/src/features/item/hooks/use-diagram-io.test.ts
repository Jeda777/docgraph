import flowchartFixture from '@docgraph/common/fixtures/flowchart.json'
import { flowchartSchema } from '@docgraph/common/schemas'
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaNode } from '../components/base/area-node'
import type { FlowchartEdge } from '../components/flowchart/flowchart-edge'
import type { FlowchartNode } from '../components/flowchart/flowchart-node'

const toast = vi.hoisted(() => ({ add: vi.fn() }))
const showErrorToast = vi.hoisted(() => vi.fn())
const download = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  downloadDiagramImage: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({ toast }))
vi.mock('@/lib/error-toast', () => ({ showErrorToast }))
vi.mock('../lib/download.helpers', () => download)

const { useDiagramIo } = await import('./use-diagram-io')

const NODE: FlowchartNode = {
  id: 'n1',
  type: 'flowchartProcessNode',
  position: { x: 0, y: 0 },
  data: { text: 'Pay' },
}
const AREA: AreaNode = {
  id: 'a1',
  type: 'areaNode',
  position: { x: 10, y: 10 },
  data: { name: 'Payments', color: '#3b82f6', alpha: 0.2, order: 0 },
}
const EDGE: FlowchartEdge = {
  id: 'e1',
  type: 'flowchartFlowLineEdge',
  source: 'n1',
  sourceHandle: 'right',
  target: 'n1',
  targetHandle: 'left',
  data: { text: '' },
}

/** A file input change event; `parseDiagramFile` reads only `name` and `text()`. */
const changeEvent = (file?: { name: string; text: () => Promise<string> }) => {
  const target = { files: file ? [file] : [], value: 'C:\\fakepath\\diagram.json' }
  return { event: { target } as unknown as React.ChangeEvent<HTMLInputElement>, target }
}

const jsonFile = (payload: unknown) => ({
  name: 'diagram.json',
  text: async () => JSON.stringify(payload),
})

const renderIo = ({
  nodes = [NODE],
  edges = [EDGE],
  areas = [AREA],
}: {
  nodes?: FlowchartNode[]
  edges?: FlowchartEdge[]
  areas?: AreaNode[]
} = {}) => {
  const replaceDocument = vi.fn()
  const { result } = renderHook(() =>
    useDiagramIo<FlowchartNode, FlowchartEdge, AreaNode>({
      itemType: 'FLOWCHART',
      schema: flowchartSchema,
      nodes,
      edges,
      areas,
      itemName: 'Checkout',
      replaceDocument,
    }),
  )
  return { io: result.current, replaceDocument }
}

beforeEach(() => {
  vi.clearAllMocks()
  download.downloadDiagramImage.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('useDiagramIo', () => {
  describe('handleImport', () => {
    it('replaces the document with the validated file and clears the input', async () => {
      const { io, replaceDocument } = renderIo()
      const { event, target } = changeEvent(jsonFile(flowchartFixture))

      await io.handleImport(event)

      expect(replaceDocument).toHaveBeenCalledExactlyOnceWith(
        flowchartSchema.parse(flowchartFixture),
      )
      expect(toast.add).not.toHaveBeenCalled()
      // Clearing the input lets the same file be picked again.
      expect(target.value).toBe('')
    })

    it('reports an invalid file and keeps the document', async () => {
      const { io, replaceDocument } = renderIo()
      const { event, target } = changeEvent({ name: 'diagram.json', text: async () => '{ nope' })

      await io.handleImport(event)

      expect(replaceDocument).not.toHaveBeenCalled()
      expect(toast.add).toHaveBeenCalledWith({
        type: 'error',
        title: 'Import failed',
        description: 'Not a valid JSON file.',
      })
      expect(target.value).toBe('')
    })

    it('does nothing when no file was picked', async () => {
      const { io, replaceDocument } = renderIo()

      await io.handleImport(changeEvent().event)

      expect(replaceDocument).not.toHaveBeenCalled()
      expect(toast.add).not.toHaveBeenCalled()
    })
  })

  it('downloads the document as typed JSON named after the item', () => {
    const { io } = renderIo()

    io.handleDownloadJson()

    const [content, fileName, format] = download.downloadFile.mock.calls[0]
    expect(JSON.parse(content)).toEqual({
      type: 'FLOWCHART',
      nodes: [NODE],
      edges: [EDGE],
      areas: [AREA],
    })
    expect(fileName).toBe('Checkout.json')
    expect(format).toBe('json')
  })

  describe('handleDownloadImage', () => {
    it('renders areas below nodes into the image', () => {
      const { io } = renderIo()

      io.handleDownloadImage('png')

      expect(download.downloadDiagramImage).toHaveBeenCalledWith(
        [AREA, NODE],
        'Checkout.png',
        'png',
      )
    })

    it('tells the user instead of exporting an empty diagram', () => {
      const { io } = renderIo({ nodes: [], edges: [], areas: [] })

      io.handleDownloadImage('svg')

      expect(download.downloadDiagramImage).not.toHaveBeenCalled()
      expect(toast.add).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'info', title: 'Nothing to export' }),
      )
    })

    it('reports a failed export', async () => {
      const error = new Error('canvas tainted')
      download.downloadDiagramImage.mockRejectedValue(error)
      const { io } = renderIo()

      io.handleDownloadImage('jpeg')

      await vi.waitFor(() =>
        expect(showErrorToast).toHaveBeenCalledWith('Could not export the diagram image', error),
      )
    })
  })
})
