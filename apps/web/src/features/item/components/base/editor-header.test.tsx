import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorHeader, type EditorHeaderProps } from './editor-header'

afterEach(cleanup)

vi.mock('@/lib/api', () => ({
  useMe: () => ({ name: 'jane doe', email: 'jane@example.com', isAdmin: false }),
  useLogout: () => ({ mutate: vi.fn() }),
}))

const header = (props: Partial<EditorHeaderProps> = {}) => (
  <EditorHeader
    itemName='Orders schema'
    itemType='DATABASE_DIAGRAM'
    exportFormats={[]}
    {...props}
  />
)

const renderHeader = (props: Partial<EditorHeaderProps> = {}) =>
  render(
    <MemoryRouter initialEntries={['/items/1']}>
      <Routes>
        <Route path='/' element={<p>Home page</p>} />
        <Route path='/items/1' element={header(props)} />
      </Routes>
    </MemoryRouter>,
  )

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
const openExport = () => fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }))

describe('EditorHeader', () => {
  it('shows the item name and its type', () => {
    renderHeader()

    expect(screen.getByText('Orders schema')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
  })

  it('shows read-only instead of the type and hides import', () => {
    renderHeader({
      readOnly: true,
      onImportClick: vi.fn(),
      exportFormats: [{ label: 'PNG', onSelect: vi.fn() }],
    })
    openMenu()

    expect(screen.getByText('Read-only')).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Import' })).not.toBeInTheDocument()
  })

  it('leaves out the menu when there is nothing to export or import', () => {
    renderHeader({ readOnly: true, onImportClick: vi.fn() })

    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
  })

  it('runs the chosen export and import', () => {
    const onPng = vi.fn()
    const onImportClick = vi.fn()
    renderHeader({ exportFormats: [{ label: 'PNG', onSelect: onPng }], onImportClick })

    openMenu()
    openExport()
    fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }))
    expect(onPng).toHaveBeenCalledOnce()

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }))
    expect(onImportClick).toHaveBeenCalledOnce()
  })

  it('goes home on Back after a direct visit', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Home page')).toBeInTheDocument()
  })

  it('goes back in history when the user came from another page', () => {
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <Routes>
          <Route path='/' element={<p>Home page</p>} />
          <Route path='/projects/1' element={<Link to='/items/1'>Open item</Link>} />
          <Route path='/items/1' element={header()} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Open item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByRole('link', { name: 'Open item' })).toBeInTheDocument()
  })
})
