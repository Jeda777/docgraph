import { ForbiddenException } from '../../errors'
import type { Actor } from './actor'

/**
 * The API key restrictions of an actor (see `apiKeyRestrictionsSchema`). They only narrow access:
 * callers check the user's own access (`requireProjectAccess`, `visibilityWhere`) as well.
 */

const scopeOf = (actor: Actor, projectId: string) =>
  actor.apiKeyRestrictions?.projects?.find((scope) => scope.projectId === projectId)

const hasProjectList = (actor: Actor) => Boolean(actor.apiKeyRestrictions?.projects)

/** Ids of the projects the key is limited to; `undefined` — no limit. */
export const keyScopeProjectIds = (actor: Actor): string[] | undefined =>
  actor.apiKeyRestrictions?.projects?.map(({ projectId }) => projectId)

/** The key reaches the project, as a whole or through some of its items. */
export const isProjectInKeyScope = (actor: Actor, projectId: string) =>
  !hasProjectList(actor) || Boolean(scopeOf(actor, projectId))

/** The key reaches the whole project, including items created later. */
export const isWholeProjectInKeyScope = (actor: Actor, projectId: string) => {
  if (!hasProjectList(actor)) return true
  const scope = scopeOf(actor, projectId)
  return Boolean(scope) && !scope?.itemIds
}

export const isItemInKeyScope = (actor: Actor, projectId: string, itemId: string) => {
  if (!hasProjectList(actor)) return true
  const scope = scopeOf(actor, projectId)
  return Boolean(scope) && (!scope?.itemIds || scope.itemIds.includes(itemId))
}

/** The items of a project the key reaches. */
export const filterItemsInKeyScope = <T extends { id: string }>(
  actor: Actor,
  projectId: string,
  items: T[],
) => items.filter((item) => isItemInKeyScope(actor, projectId, item.id))

/** Refuses writes through a read-only key. */
export const assertKeyCanWrite = (actor: Actor) => {
  if (actor.apiKeyRestrictions?.readOnly) {
    throw new ForbiddenException('FORBIDDEN', 'This API key is read-only')
  }
}
