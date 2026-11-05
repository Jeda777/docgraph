import { Hono } from 'hono'
import { handleAuthRequest } from './service'

/** Every endpoint under `/api/auth` belongs to Better Auth (see `better-auth.ts`). */
export const authRouter = new Hono().basePath('/auth')

authRouter.on(['GET', 'POST'], '/*', (c) => handleAuthRequest(c.req.raw))
