import {
  type ItemOutput,
  idParamSchema,
  itemCreateInputSchema,
  itemUpdateInputSchema,
} from '@docgraph/common/schemas'
import { Hono } from 'hono'
import { zValidator } from '../../lib/validator'
import { requireAdmin, requireAuth } from '../auth/middleware'
import { createItem, deleteItem, getItemById, updateItem } from './service'

export const itemsRouter = new Hono().basePath('/items').use('*', requireAuth)

itemsRouter.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const user = c.get('user')
  const itemId = c.req.valid('param').id
  const item = await getItemById(itemId, user)
  return c.json(item satisfies ItemOutput)
})

itemsRouter.post('/', zValidator('json', itemCreateInputSchema), async (c) => {
  const user = c.get('user')
  const input = c.req.valid('json')
  const item = await createItem(input, user)
  return c.json(item satisfies ItemOutput)
})

itemsRouter.patch(
  '/:id',
  requireAdmin,
  zValidator('param', idParamSchema),
  zValidator('json', itemUpdateInputSchema),
  async (c) => {
    const user = c.get('user')
    const input = c.req.valid('json')
    const itemId = c.req.valid('param').id
    const item = await updateItem({ ...input, id: itemId }, user)
    return c.json(item satisfies ItemOutput)
  },
)

itemsRouter.delete('/:id', requireAdmin, zValidator('param', idParamSchema), async (c) => {
  const user = c.get('user')
  const itemId = c.req.valid('param').id
  await deleteItem(itemId, user)
  return c.body(null, 204)
})
