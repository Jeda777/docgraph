import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from './ui-store'

describe('ui store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    useUiStore.setState({ theme: 'light' })
  })

  it('toggles the theme and mirrors it on the document element', () => {
    act(() => useUiStore.getState().toggleTheme())

    expect(useUiStore.getState().theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => useUiStore.getState().toggleTheme())

    expect(useUiStore.getState().theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists only the theme', () => {
    act(() => {
      useUiStore.setState({ theme: 'dark' })
    })

    const persisted = JSON.parse(localStorage.getItem('ui-store') ?? '{}') as {
      state?: Record<string, unknown>
    }

    expect(persisted.state?.theme).toBe('dark')
    expect(Object.keys(persisted.state ?? {})).toEqual(['theme'])
  })
})
