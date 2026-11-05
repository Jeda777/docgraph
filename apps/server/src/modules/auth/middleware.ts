import { API_KEY_HEADER } from '@docgraph/common/schemas'
import { createMiddleware } from 'hono/factory'
import type { User } from '../../db'
import { ForbiddenException, UnauthorizedException } from '../../errors'
import { getUserFromApiKey, getUserFromHeaders } from './service'

type MiddlewareContext = {
  Variables: {
    user: User
  }
}

/** Browser auth: the Better Auth session cookie. */
export const requireAuth = createMiddleware<MiddlewareContext>(async (c, next) => {
  c.set('user', await getUserFromHeaders(c.req.raw.headers))
  await next()
})

export const requireAdmin = createMiddleware<MiddlewareContext>(async (c, next) => {
  const user = c.get('user')
  if (!user) throw new UnauthorizedException('UNAUTHORIZED', 'Missing authentication')

  if (!user.isAdmin) {
    throw new ForbiddenException()
  }

  await next()
})

/** Auth for non-browser clients (MCP): a personal API key in `x-api-key` instead of a session cookie. */
export const requireApiKey = createMiddleware<MiddlewareContext>(async (c, next) => {
  c.set('user', await getUserFromApiKey(c.req.header(API_KEY_HEADER)))
  await next()
})
