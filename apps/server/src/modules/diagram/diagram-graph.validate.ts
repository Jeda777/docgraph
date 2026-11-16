import { findDuplicates } from '@docgraph/common/diagram'
import type { DiagramGraphUpdate } from '@docgraph/common/schemas'
import type { z } from 'zod'
import { BadRequestException } from '../../errors'
import type { GraphConfig, GraphDocument } from './diagram-graph.model'

/** Rejects an update that gives the same node or edge id twice. */
export const assertUniqueIds = (update: DiagramGraphUpdate) => {
  const errors: string[] = []
  const duplicateNodes = findDuplicates(update.nodes.map((node) => node.id))
  if (duplicateNodes.length) errors.push(`Duplicate nodes: ${duplicateNodes.join(', ')}`)
  const duplicateEdges = findDuplicates(update.edges.flatMap((edge) => edge.id ?? []))
  if (duplicateEdges.length) errors.push(`Duplicate edges: ${duplicateEdges.join(', ')}`)
  if (errors.length) throw new BadRequestException('BAD_REQUEST', errors.join('\n'))
}

const describeIssue = (document: GraphDocument, issue: z.core.$ZodIssue) => {
  const [collection, index, ...rest] = issue.path
  const elements =
    collection === 'nodes' || collection === 'edges' || collection === 'areas'
      ? document[collection]
      : undefined
  const element = elements && typeof index === 'number' ? elements[index] : undefined
  const where = element
    ? `${String(collection).slice(0, -1)} "${element.id}"${rest.length ? ` (${rest.join('.')})` : ''}`
    : issue.path.join('.') || 'diagram'
  return `${where}: ${issue.message}`
}

/** Validates the final document against the diagram type's schema, listing every issue. */
export const assertValidDocument = (config: GraphConfig, document: GraphDocument) => {
  const result = config.validate(document)
  if (!result.success) {
    const messages = result.error.issues.map((issue) => describeIssue(document, issue))
    throw new BadRequestException(
      'BAD_REQUEST',
      `The diagram is not valid:\n- ${messages.join('\n- ')}`,
    )
  }
}
