import 'zod/compile'
import '@testing-library/jest-dom/vitest'

// React Flow measures rendered nodes/edges with ResizeObserver; jsdom has none.
// A passive stub is enough: elements land in the DOM on first commit and never
// need real measurements for presence/text assertions.
class ResizeObserverMock {
  observe = () => {}
  unobserve = () => {}
  disconnect = () => {}
}
window.ResizeObserver ||= ResizeObserverMock as unknown as typeof ResizeObserver

// Handle measurement inside React Flow reads transforms via DOMMatrixReadOnly,
// which jsdom does not implement either (polyfill per @xyflow docs).
class DOMMatrixReadOnlyMock {
  m22: number
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.]+)\)/)?.[1]
    this.m22 = scale !== undefined ? Number(scale) : 1
  }
}
window.DOMMatrixReadOnly ||= DOMMatrixReadOnlyMock as unknown as typeof DOMMatrixReadOnly

// Base UI checkboxes and radios forward a click to their hidden input with
// `new PointerEvent('click')`; jsdom has no PointerEvent, MouseEvent is close enough.
window.PointerEvent ||= MouseEvent as unknown as typeof PointerEvent
