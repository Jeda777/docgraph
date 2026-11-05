import { createDiagramFocus } from '../../lib/diagram-focus'

export type DatabaseTabKind = 'table' | 'relation' | 'area'

export const { focusDiagramItem, onDiagramFocus } = createDiagramFocus<DatabaseTabKind>()
