import {
  idParamSchema,
  type UserGetListOutput,
  type UserUpdateOutput,
  userCreateInputSchema,
  userUpdateInputSchema,
} from '@docgraph/common/schemas'
import { Hono } from 'hono'
import { zValidator } from '../../lib/validator'
import { requireAdmin, requireAuth } from '../auth/middleware'
import { deleteUser, inviteUser, listUsers, updateUser } from './service'

export const usersRouter = new Hono().basePath('/users').use('*', requireAuth)

usersRouter.post('/', requireAdmin, zValidator('json', userCreateInputSchema), async (c) => {
  const { email, name } = c.req.valid('json')
  await inviteUser({ email, name })
  return c.body(null, 204)
})

usersRouter.get('/', requireAdmin, async (c) => {
  const users = await listUsers()
  return c.json(users satisfies UserGetListOutput)
})

usersRouter.patch(
  '/:id',
  requireAdmin,
  zValidator('param', idParamSchema),
  zValidator('json', userUpdateInputSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = await updateUser({ ...c.req.valid('json'), id }, c.get('user'))
    return c.json(user satisfies UserUpdateOutput)
  },
)

usersRouter.delete('/:id', requireAdmin, zValidator('param', idParamSchema), async (c) => {
  await deleteUser(c.req.valid('param').id, c.get('user'))
  return c.body(null, 204)
})
