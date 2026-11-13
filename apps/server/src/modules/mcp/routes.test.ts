import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, projectsToUsers } from '../../db'
import {
  addMember,
  createApiKeyFor,
  createItem,
  createProject,
  createUser,
  migrateTestDb,
  resetTestDb,
  sessionCookieFor,
} from '../../test/db'
import { mcpRouter } from './routes'

const app = new Hono()
app.route('/', mcpRouter)

let rpcId = 0

const callMcp = (apiKey: string, method: string, params: Record<string, unknown> = {}) =>
  app.request('/mcp', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })

type ToolResult = { isError?: boolean; content: { type: string; text: string }[] }

const callTool = async (apiKey: string, name: string, args: Record<string, unknown>) => {
  const res = await callMcp(apiKey, 'tools/call', { name, arguments: args })
  expect(res.status).toBe(200)
  const { result } = (await res.json()) as { result: ToolResult }
  return { isError: Boolean(result.isError), text: result.content[0].text }
}

const setup = async () => {
  const user = await createUser()
  const apiKey = await createApiKeyFor(user.id)
  const project = await createProject({ isForAllUsers: true })
  return { user, apiKey, project }
}

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('POST /mcp', () => {
  it('rejects requests without an API key', async () => {
    const res = await app.request('/mcp', { method: 'POST' })

    expect(res.status).toBe(401)
  })

  it('answers GET and DELETE with 405 instead of opening a stream', async () => {
    const { apiKey } = await setup()

    for (const method of ['GET', 'DELETE']) {
      const res = await app.request('/mcp', {
        method,
        headers: { 'x-api-key': apiKey, accept: 'text/event-stream' },
      })
      expect(res.status).toBe(405)
      expect(res.headers.get('allow')).toBe('POST')
    }
  })

  it('rejects session tokens sent as an API key', async () => {
    const user = await createUser()
    const sessionToken = (await sessionCookieFor(user.id)).cookie.split('=')[1] ?? ''

    const res = await callMcp(sessionToken, 'tools/list')

    expect(res.status).toBe(401)
  })

  it('lists the tools', async () => {
    const { apiKey } = await setup()

    const res = await callMcp(apiKey, 'tools/list')

    const { result } = (await res.json()) as { result: { tools: { name: string }[] } }
    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      'create_database_diagram',
      'create_diagram',
      'create_document',
      'get_database_schema',
      'get_diagram',
      'get_document',
      'list_items',
      'list_projects',
      'update_database_schema',
      'update_diagram',
      'update_document',
    ])
  })

  it('writes a schema into a diagram and reads it back', async () => {
    const { apiKey, project } = await setup()
    const item = await createItem(project.id)

    const update = await callTool(apiKey, 'update_database_schema', {
      itemId: item.id,
      tables: [
        { name: 'users', columns: [{ name: 'id', type: 'bigint', primaryKey: true }] },
        { name: 'posts', columns: [{ name: 'author_id', type: 'bigint' }] },
      ],
      relations: [
        { from: { table: 'users', column: 'id' }, to: { table: 'posts', column: 'author_id' } },
      ],
    })
    expect(update.isError).toBe(false)
    expect(JSON.parse(update.text)).toMatchObject({
      tablesCreated: ['users', 'posts'],
      relations: 1,
    })

    const read = await callTool(apiKey, 'get_database_schema', { itemId: item.id })
    const schema = JSON.parse(read.text)
    expect(schema.tables.map((table: { name: string }) => table.name)).toEqual(['users', 'posts'])
    expect(schema.relations).toHaveLength(1)
  })

  it('creates a new diagram with a schema', async () => {
    const { apiKey, project } = await setup()

    const created = await callTool(apiKey, 'create_database_diagram', {
      projectId: project.id,
      name: 'Shop',
      tables: [{ name: 'orders', columns: [{ name: 'id', type: 'uuid' }] }],
    })
    const { item } = JSON.parse(created.text)

    const items = await callTool(apiKey, 'list_items', { projectId: project.id })
    expect(JSON.parse(items.text)).toEqual([
      { id: item.id, name: 'Shop', type: 'DATABASE_DIAGRAM', archived: false },
    ])
  })

  it('does not create a diagram when the schema is invalid', async () => {
    const { apiKey, project } = await setup()

    const created = await callTool(apiKey, 'create_database_diagram', {
      projectId: project.id,
      name: 'Shop',
      tables: [{ name: 'orders', columns: [{ name: 'id', type: 'uuid' }] }],
      relations: [{ from: { table: 'orders', column: 'id' }, to: { table: 'nope', column: 'x' } }],
    })
    expect(created.isError).toBe(true)

    const items = await callTool(apiKey, 'list_items', { projectId: project.id })
    expect(JSON.parse(items.text)).toEqual([])
  })

  it('does not reveal projects the key owner cannot access', async () => {
    const { apiKey } = await setup()
    const hidden = await createProject({ isForAllUsers: false })
    const item = await createItem(hidden.id)

    const read = await callTool(apiKey, 'get_database_schema', { itemId: item.id })

    expect(read.isError).toBe(true)
    expect(read.text).toMatch(/not found/)
  })

  it('refuses to write into archived diagrams', async () => {
    const { apiKey, project } = await setup()
    const item = await createItem(project.id, { isArchived: true })

    const update = await callTool(apiKey, 'update_database_schema', {
      itemId: item.id,
      tables: [],
    })

    expect(update.isError).toBe(true)
    expect(update.text).toMatch(/read-only/)
  })

  it('refuses items of another type', async () => {
    const { apiKey, project } = await setup()
    const item = await createItem(project.id, { type: 'FLOWCHART' })

    const read = await callTool(apiKey, 'get_database_schema', { itemId: item.id })

    expect(read.isError).toBe(true)
    expect(read.text).toMatch(/not a DATABASE_DIAGRAM/)
  })

  const writeTools = [
    {
      tool: 'update_database_schema',
      args: { tables: [] },
      wrongType: 'DOCUMENT',
      error: /not a DATABASE_DIAGRAM/,
    },
    {
      tool: 'update_diagram',
      args: { nodes: [], edges: [] },
      wrongType: 'DATABASE_DIAGRAM',
      error: /not a FLOWCHART or BUSINESS_PROCESS/,
    },
    {
      tool: 'update_document',
      args: { markdown: '# Notes', mode: 'replace' },
      wrongType: 'FLOWCHART',
      error: /not a DOCUMENT/,
    },
  ] as const

  it.each(writeTools)(
    '$tool refuses items of another type',
    async ({ tool, args, wrongType, error }) => {
      const { apiKey, project } = await setup()
      const item = await createItem(project.id, { type: wrongType })

      const update = await callTool(apiKey, tool, { itemId: item.id, ...args })

      expect(update.isError).toBe(true)
      expect(update.text).toMatch(error)
    },
  )

  it.each(writeTools)(
    '$tool does not reveal items the key owner cannot access',
    async ({ tool, args }) => {
      const { apiKey } = await setup()
      const hidden = await createProject({ isForAllUsers: false })
      const item = await createItem(hidden.id)

      const update = await callTool(apiKey, tool, { itemId: item.id, ...args })

      expect(update.isError).toBe(true)
      expect(update.text).toMatch(`Item with id ${item.id} not found`)
    },
  )

  it('writes a flowchart and reads it back', async () => {
    const { apiKey, project } = await setup()
    const item = await createItem(project.id, { type: 'FLOWCHART' })

    const update = await callTool(apiKey, 'update_diagram', {
      itemId: item.id,
      nodes: [
        { id: 'start', type: 'terminator', text: 'Start' },
        { id: 'work', type: 'process', text: 'Work' },
      ],
      edges: [{ source: 'start', target: 'work' }],
    })
    expect(update.isError).toBe(false)
    expect(JSON.parse(update.text)).toMatchObject({ nodesCreated: ['start', 'work'] })

    const read = await callTool(apiKey, 'get_diagram', { itemId: item.id })
    const graph = JSON.parse(read.text)
    expect(graph.item).toMatchObject({ id: item.id, type: 'FLOWCHART' })
    expect(graph.nodes.map((node: { type: string }) => node.type)).toEqual([
      'terminator',
      'process',
    ])
    expect(graph.edges).toMatchObject([{ type: 'flowLine', source: 'start', target: 'work' }])
  })

  it('creates a business process and reports invalid diagrams without creating them', async () => {
    const { apiKey, project } = await setup()

    const created = await callTool(apiKey, 'create_diagram', {
      projectId: project.id,
      name: 'Orders',
      type: 'BUSINESS_PROCESS',
      nodes: [
        { id: 'start', type: 'event' },
        { id: 'task', type: 'activity', text: 'Ship' },
      ],
      edges: [{ source: 'start', target: 'task' }],
    })
    expect(created.isError).toBe(false)

    const invalid = await callTool(apiKey, 'create_diagram', {
      projectId: project.id,
      name: 'Broken',
      type: 'BUSINESS_PROCESS',
      nodes: [{ id: 'task', type: 'activity', data: { taskType: 'nope' } }],
    })
    expect(invalid.isError).toBe(true)
    expect(invalid.text).toMatch(/node "task"/)

    const items = await callTool(apiKey, 'list_items', { projectId: project.id })
    expect(JSON.parse(items.text).map((entry: { name: string }) => entry.name)).toEqual(['Orders'])
  })

  it('refuses database diagrams in the diagram tools', async () => {
    const { apiKey, project } = await setup()
    const item = await createItem(project.id)

    const read = await callTool(apiKey, 'get_diagram', { itemId: item.id })

    expect(read.isError).toBe(true)
    expect(read.text).toMatch(/not a FLOWCHART or BUSINESS_PROCESS/)
  })

  it('writes Markdown into a document and reads it back', async () => {
    const { apiKey, project } = await setup()
    const created = await callTool(apiKey, 'create_document', {
      projectId: project.id,
      name: 'Notes',
      markdown: '# Setup\n\nRun **pnpm install**.',
    })
    const { item } = JSON.parse(created.text)

    await callTool(apiKey, 'update_document', {
      itemId: item.id,
      markdown: '- one\n- two',
      mode: 'append',
    })

    const read = await callTool(apiKey, 'get_document', { itemId: item.id })
    expect(read.isError).toBe(false)
    expect(read.text).toBe('# Setup\n\nRun **pnpm install**.\n\n- one\n- two')
  })

  it('refuses to write into archived documents', async () => {
    const { apiKey, project } = await setup()
    const item = await createItem(project.id, { type: 'DOCUMENT', isArchived: true })

    const update = await callTool(apiKey, 'update_document', {
      itemId: item.id,
      markdown: 'x',
      mode: 'replace',
    })

    expect(update.isError).toBe(true)
    expect(update.text).toMatch(/read-only/)
  })

  describe('API key restrictions', () => {
    const toolNames = async (apiKey: string) => {
      const res = await callMcp(apiKey, 'tools/list')
      const { result } = (await res.json()) as { result: { tools: { name: string }[] } }
      return result.tools.map((tool) => tool.name).sort()
    }

    it('offers only reading tools to a read-only key', async () => {
      const user = await createUser()
      const apiKey = await createApiKeyFor(user.id, {
        restrictions: { readOnly: true, projects: null },
      })

      expect(await toolNames(apiKey)).toEqual([
        'get_database_schema',
        'get_diagram',
        'get_document',
        'list_items',
        'list_projects',
      ])
    })

    it('refuses writes through a read-only key', async () => {
      const user = await createUser()
      const project = await createProject({ isForAllUsers: true })
      const item = await createItem(project.id, { type: 'DOCUMENT' })
      const apiKey = await createApiKeyFor(user.id, {
        restrictions: { readOnly: true, projects: null },
      })

      const update = await callTool(apiKey, 'update_document', {
        itemId: item.id,
        markdown: 'x',
        mode: 'replace',
      })
      const read = await callTool(apiKey, 'get_document', { itemId: item.id })

      expect(update.isError).toBe(true)
      expect(read.isError).toBe(false)
    })

    it('limits a key to its projects', async () => {
      const user = await createUser()
      const allowed = await createProject({ isForAllUsers: true })
      const other = await createProject({ isForAllUsers: true })
      const otherItem = await createItem(other.id)
      const apiKey = await createApiKeyFor(user.id, {
        restrictions: { readOnly: false, projects: [{ projectId: allowed.id }] },
      })

      const projects = await callTool(apiKey, 'list_projects', {})
      const items = await callTool(apiKey, 'list_items', { projectId: other.id })
      const read = await callTool(apiKey, 'get_database_schema', { itemId: otherItem.id })
      const created = await callTool(apiKey, 'create_document', {
        projectId: allowed.id,
        name: 'Notes',
      })

      expect(JSON.parse(projects.text).map(({ id }: { id: string }) => id)).toEqual([allowed.id])
      expect(items.isError).toBe(true)
      expect(items.text).toMatch(/not found/)
      expect(read.isError).toBe(true)
      expect(read.text).toMatch(/not found/)
      expect(created.isError).toBe(false)
    })

    it('limits a key to selected items of a project', async () => {
      const user = await createUser()
      const project = await createProject({ isForAllUsers: true })
      const allowed = await createItem(project.id)
      const other = await createItem(project.id)
      const apiKey = await createApiKeyFor(user.id, {
        restrictions: {
          readOnly: false,
          projects: [{ projectId: project.id, itemIds: [allowed.id] }],
        },
      })

      const items = await callTool(apiKey, 'list_items', { projectId: project.id })
      const readAllowed = await callTool(apiKey, 'get_database_schema', { itemId: allowed.id })
      const readOther = await callTool(apiKey, 'get_database_schema', { itemId: other.id })
      const created = await callTool(apiKey, 'create_document', {
        projectId: project.id,
        name: 'Notes',
      })

      expect(JSON.parse(items.text).map(({ id }: { id: string }) => id)).toEqual([allowed.id])
      expect(readAllowed.isError).toBe(false)
      expect(readOther.isError).toBe(true)
      expect(readOther.text).toMatch(/not found/)
      expect(created.isError).toBe(true)
      expect(created.text).toMatch(/only selected items/)
    })

    it('ignores an item listed under another project', async () => {
      const user = await createUser()
      const project = await createProject({ isForAllUsers: true })
      const other = await createProject({ isForAllUsers: true })
      const item = await createItem(other.id)
      const apiKey = await createApiKeyFor(user.id, {
        restrictions: {
          readOnly: false,
          projects: [{ projectId: project.id, itemIds: [item.id] }],
        },
      })

      const read = await callTool(apiKey, 'get_database_schema', { itemId: item.id })

      expect(read.isError).toBe(true)
    })

    it("still checks the owner's access to the key's projects", async () => {
      const user = await createUser()
      const project = await createProject({ isForAllUsers: false })
      await addMember(project.id, user.id)
      const item = await createItem(project.id)
      const apiKey = await createApiKeyFor(user.id, {
        restrictions: { readOnly: false, projects: [{ projectId: project.id }] },
      })
      expect((await callTool(apiKey, 'get_database_schema', { itemId: item.id })).isError).toBe(
        false,
      )

      await db.delete(projectsToUsers).where(eq(projectsToUsers.projectId, project.id))

      const projects = await callTool(apiKey, 'list_projects', {})
      const read = await callTool(apiKey, 'get_database_schema', { itemId: item.id })
      expect(JSON.parse(projects.text)).toEqual([])
      expect(read.isError).toBe(true)
      expect(read.text).toMatch(/not found/)
    })
  })
})
