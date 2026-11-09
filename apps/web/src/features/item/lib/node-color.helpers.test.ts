import { describe, expect, it } from 'vitest'
import { collaboratorColor, nodeColorVar } from './node-color.helpers'

describe('nodeColorVar', () => {
  it('maps a known node color to its theme variable', () => {
    expect(nodeColorVar('blue')).toBe('var(--color-blue-500)')
  })

  it.each([undefined, 42, 'not-a-color', 'red-500); background: url(x'])(
    'falls back to gray for %s',
    (value) => {
      expect(nodeColorVar(value)).toBe('var(--color-gray-500)')
    },
  )
})

describe('collaboratorColor', () => {
  it('uses the node color picked for the client id', () => {
    expect(collaboratorColor(3)).toBe('var(--color-lime-500)')
  })
})
