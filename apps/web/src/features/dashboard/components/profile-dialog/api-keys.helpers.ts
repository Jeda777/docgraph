import type { ApiKey } from '@docgraph/common/schemas'
import { formatDate } from '@/lib/utils'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** What a key may do, e.g. `Read-only · Billing, Docs (2 items)`. */
export const describeApiKeyAccess = (
  { readOnly, projects }: ApiKey['restrictions'],
  projectNames: ReadonlyMap<string, string>,
) => {
  const mode = readOnly ? 'Read-only' : 'Read and write'
  if (!projects) return `${mode} · All projects`

  const scopes = projects.map(({ projectId, itemIds }) => {
    const name = projectNames.get(projectId) ?? 'Unavailable project'
    return itemIds ? `${name} (${plural(itemIds.length, 'item')})` : name
  })
  return `${mode} · ${scopes.join(', ')}`
}

export const describeApiKeyExpiry = (expiresAt: Date | null, now = new Date()) => {
  if (!expiresAt) return 'Never expires'
  return `${expiresAt <= now ? 'Expired' : 'Expires'} ${formatDate(expiresAt)}`
}
