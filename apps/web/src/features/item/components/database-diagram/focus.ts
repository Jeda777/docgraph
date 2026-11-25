import { createDiagramFocus } from '../../lib/diagram-focus'

export type DatabaseTabKind = 'table' | 'relation' | 'area' | 'enum'

export const { focusDiagramItem, onDiagramFocus } = createDiagramFocus<DatabaseTabKind>()
