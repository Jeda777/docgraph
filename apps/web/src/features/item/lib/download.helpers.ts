import { getNodesBounds as getReactFlowNodesBounds, type Node } from '@xyflow/react'
import { toJpeg, toPng, toSvg } from 'html-to-image'
import { type Doc, encodeStateAsUpdate } from 'yjs'

const MIME_TYPES = {
  json: 'application/json;charset=utf-8',
  docgraph: 'application/octet-stream',
  markdown: 'text/markdown;charset=utf-8',
  png: 'image/png',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
}

export const downloadFile = (
  content: BlobPart,
  fileName: string,
  format: keyof typeof MIME_TYPES,
) => {
  const mimeType = MIME_TYPES[format]
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Exports the raw CRDT state of an item as a `.docgraph` file, importable by every editor. */
export const downloadDocgraph = (document: Doc, itemName: string) =>
  // Yjs always backs the update with a plain ArrayBuffer, never a SharedArrayBuffer.
  downloadFile(
    encodeStateAsUpdate(document) as Uint8Array<ArrayBuffer>,
    `${itemName}.docgraph`,
    'docgraph',
  )

const IMAGE_PADDING = 40
const PIXEL_RATIO = 2

export const getAbsoluteNodesBounds = (nodes: Node[]) => {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const absoluteNodes = nodes.map((node) => {
    let x = node.position.x
    let y = node.position.y
    let parentId = node.parentId
    const visited = new Set([node.id])

    while (parentId && !visited.has(parentId)) {
      const parent = nodesById.get(parentId)
      if (!parent) break
      visited.add(parent.id)
      x += parent.position.x
      y += parent.position.y
      parentId = parent.parentId
    }

    return { ...node, position: { x, y } }
  })
  return getReactFlowNodesBounds(absoluteNodes)
}

export const IMAGE_FORMATS = ['png', 'jpeg', 'svg'] as const
export type ImageFormat = (typeof IMAGE_FORMATS)[number]
const RENDERERS: Record<ImageFormat, typeof toPng> = { png: toPng, jpeg: toJpeg, svg: toSvg }

/**
 * Paint properties every svg descendant must carry inline before a capture:
 * html-to-image deep-clones `<svg>` elements verbatim and skips inlining
 * computed styles for their children, so anything painted from a stylesheet
 * (`.react-flow__edge-path { stroke: … }`) would fall back to the SVG defaults —
 * `stroke: none` — and vanish.
 */
const SVG_PAINT_PROPERTIES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'opacity',
  'color',
] as const

/** Applies `patch` to `element`, returning an undo for its `style`/`viewBox`. */
const patchForCapture = (element: SVGElement, patch: Partial<CSSStyleDeclaration> = {}) => {
  const style = element.getAttribute('style')
  const computed = getComputedStyle(element)

  for (const property of SVG_PAINT_PROPERTIES) {
    element.style.setProperty(property, computed.getPropertyValue(property))
  }
  Object.assign(element.style, patch)

  return () => {
    if (style === null) element.removeAttribute('style')
    else element.setAttribute('style', style)
  }
}

/**
 * Renders the whole diagram — not just what is on screen — into an image. The
 * canvas is sized to the node bounds at 1:1 scale, so a small diagram comes out
 * small and readable instead of lost in the middle of a fixed frame, and a large
 * one is never cropped.
 */
export const downloadDiagramImage = async (
  nodes: Node[],
  fileName: string,
  format: ImageFormat,
) => {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport || !nodes.length) return

  const bounds = getAbsoluteNodesBounds(nodes)
  const width = Math.ceil(bounds.width + IMAGE_PADDING * 2)
  const height = Math.ceil(bounds.height + IMAGE_PADDING * 2)

  // Each edge is its own zero-sized svg drawing outside itself via
  // `overflow: visible`, positioned at the flow origin. Give it a real box over
  // the exported region — viewBox included, so edges at negative flow
  // coordinates survive — and inline the paint the clone would otherwise lose.
  const left = bounds.x - IMAGE_PADDING
  const top = bounds.y - IMAGE_PADDING
  const restore = Array.from(
    viewport.querySelectorAll<SVGSVGElement>('svg'),
    (svg): (() => void)[] => {
      const isEdgeLayer = svg.closest('.react-flow__edges')
      const viewBox = svg.getAttribute('viewBox')
      const undoSvg = patchForCapture(
        svg,
        isEdgeLayer
          ? {
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
            }
          : {},
      )
      if (isEdgeLayer) svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`)

      return [
        ...Array.from(svg.querySelectorAll<SVGElement>('*'), (child) => patchForCapture(child)),
        undoSvg,
        () => {
          if (viewBox === null) svg.removeAttribute('viewBox')
          else svg.setAttribute('viewBox', viewBox)
        },
      ]
    },
  ).flat()

  try {
    const dataUrl = await RENDERERS[format](viewport, {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      width,
      height,
      pixelRatio: PIXEL_RATIO,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${IMAGE_PADDING - bounds.x}px, ${IMAGE_PADDING - bounds.y}px)`,
      },
      // Remote cursors and other overlays are not part of the diagram.
      filter: (node) => !(node instanceof Element && node.hasAttribute('data-hide-cursor')),
    })

    downloadFile(await (await fetch(dataUrl)).blob(), fileName, format)
  } finally {
    for (const undo of restore) undo()
  }
}
