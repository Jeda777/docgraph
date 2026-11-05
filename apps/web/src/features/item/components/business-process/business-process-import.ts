import { businessProcessSchema } from '@docgraph/common/schemas'
import type { z } from 'zod'
import { normalizeBoundaryEventAttachments } from './business-process-attachments'
import type { BusinessProcessNode } from './business-process-node'

/**
 * Validates an imported business process, pins its boundary events to their activities and
 * validates again: normalization can make a valid file invalid, e.g. by closing a containment
 * cycle through a boundary event.
 */
export const businessProcessImportSchema = businessProcessSchema
  .transform(
    (document) =>
      ({
        ...document,
        nodes: normalizeBoundaryEventAttachments(document.nodes as BusinessProcessNode[]),
      }) as z.input<typeof businessProcessSchema>,
  )
  .pipe(businessProcessSchema)
