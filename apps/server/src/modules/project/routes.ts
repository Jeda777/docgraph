import {
  idParamSchema,
  type ProjectCreateOutput,
  type ProjectGetByIdOutput,
  type ProjectGetListOutput,
  type ProjectUpdateOutput,
  projectCreateInputSchema,
  projectGetByIdInputSchema,
  projectUpdateInputSchema,
} from '@docgraph/common/schemas'
import { Hono } from 'hono'
import { zValidator } from '../../lib/validator'
import { requireAdmin, requireAuth } from '../auth/middleware'
import {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  updateProject,
} from './service'

export const projectsRouter = new Hono().basePath('/projects').use('*', requireAuth)

projectsRouter.get('/', async (c) => {
  const user = c.get('user')
  const projects = await listProjects(user)
  return c.json(projects satisfies ProjectGetListOutput)
})

projectsRouter.get(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('query', projectGetByIdInputSchema),
  async (c) => {
    const user = c.get('user')
    const projectId = c.req.valid('param').id
    const query = c.req.valid('query')
    const project = await getProjectById({ id: projectId, ...query }, user)
    return c.json(project satisfies ProjectGetByIdOutput)
  },
)

projectsRouter.post('/', requireAdmin, zValidator('json', projectCreateInputSchema), async (c) => {
  const input = c.req.valid('json')
  const project = await createProject(input)
  return c.json(project satisfies ProjectCreateOutput)
})

projectsRouter.patch(
  '/:id',
  requireAdmin,
  zValidator('param', idParamSchema),
  zValidator('json', projectUpdateInputSchema),
  async (c) => {
    const input = c.req.valid('json')
    const projectId = c.req.valid('param').id
    const project = await updateProject({ ...input, id: projectId })
    return c.json(project satisfies ProjectUpdateOutput)
  },
)

projectsRouter.delete('/:id', requireAdmin, zValidator('param', idParamSchema), async (c) => {
  const projectId = c.req.valid('param').id
  await deleteProject(projectId)
  return c.body(null, 204)
})
