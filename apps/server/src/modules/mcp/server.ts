import {
  DIAGRAM_GRAPH_TYPES,
  type DiagramGraphType,
  DOCUMENT_WRITE_MODES,
  databaseSchemaRelationSchema,
  databaseSchemaTableSchema,
  diagramGraphUpdateSchema,
  ITEM_TYPES,
  idSchema,
  nameSchema,
  SCHEMA_APPLY_MODES,
} from '@docgraph/common/schemas'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
// Named import, so the bundle inlines only `version` instead of the whole package.json.
import { version as SERVER_VERSION } from '../../../package.json'
import type { Actor } from '../auth/actor'
import {
  createDatabaseDiagram,
  getDatabaseSchema,
  updateDatabaseSchema,
} from '../diagram/database-diagram.service'
import { diagramGraphTypeNames } from '../diagram/diagram-graph.mapper'
import {
  createDiagram,
  getDiagramGraph,
  updateDiagramGraph,
} from '../diagram/diagram-graph.service'
import {
  createDocument,
  getDocumentMarkdown,
  updateDocumentMarkdown,
} from '../document/document.service'
import { getProjectById, listProjects } from '../project/service'

const SERVER_NAME = 'docgraph'

const INSTRUCTIONS = `DocGraph keeps project documentation: database diagrams, flowcharts, business process diagrams and documents, grouped in projects. Find items with list_projects and list_items.

Database diagrams can be synced with code in both directions:
- Diagram -> code: read it with get_database_schema, then write migrations/ORM models from the returned tables and relations.
- Code -> diagram: read the schema from the codebase (ORM models, migrations, SQL DDL), translate it into tables and relations and call update_database_schema (or create_database_diagram for a new diagram).
Tables and columns are matched by name, so positions and colors chosen by users are kept. Relations go from the referenced column (usually a primary key) to the referencing foreign key column.

Flowcharts and business processes are graphs of nodes and edges: read them with get_diagram, change them with update_diagram, create them with create_diagram. Nodes are matched by id; nodes sent without a position are laid out automatically, so send positions only to place nodes deliberately.

In update_database_schema and update_diagram, prefer mode "merge" for partial changes and "replace" only when sending the complete content.

Documents are read and written as Markdown with get_document, update_document and create_document. update_document has no partial mode: "append" adds Markdown at the end, "replace" overwrites the whole document. To change part of a document, read it with get_document, edit the Markdown and write all of it back with "replace".`

const READ_ONLY_INSTRUCTIONS =
  'This API key is read-only: only the reading tools are available, nothing can be created or changed.'

const typeNamesHelp = (type: DiagramGraphType) => {
  const names = diagramGraphTypeNames(type)
  return `- ${type} nodes: ${names.nodes.join(', ')}. Edges: ${names.edges.join(', ')} (default ${names.defaultEdge}).`
}

const DIAGRAM_TYPES_HELP = `Node and edge types:
${DIAGRAM_GRAPH_TYPES.map(typeNamesHelp).join('\n')}
Business process nodes take type-specific fields in "data", e.g. activity { taskType: task|userTask|serviceTask|sendTask|receiveTask|manualTask|businessRuleTask|scriptTask|callActivity|embeddedSubProcess|… }, event { context: start|intermediateCatch|intermediateThrow|boundary|end, eventType: none|message|timer|error|signal|…, attachedToId for boundary events }, gateway { gatewayType: exclusive|inclusive|parallel|complex|…, defaultFlowId }, participant { participantType: pool|lane, blackBox }, data { dataType: object|input|output|store }. Lanes and the elements inside them set parentId to their pool or lane. Sequence flows stay inside one pool; message flows connect different pools.`

/** JSON text result without indentation — agents read the text, so every token counts. */
const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
})

const schemaInput = {
  tables: z.array(databaseSchemaTableSchema).describe('Complete definitions of tables'),
  relations: z
    .array(databaseSchemaRelationSchema)
    .default([])
    .describe('Foreign key relations between columns'),
}

/**
 * A fresh MCP server per request, bound to the caller — the endpoint is
 * stateless, so every tool runs with the permissions of the token's owner,
 * narrowed by the key's restrictions.
 */
export const createMcpServer = (actor: Actor) => {
  const readOnly = Boolean(actor.apiKeyRestrictions?.readOnly)
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: readOnly ? `${INSTRUCTIONS} ${READ_ONLY_INSTRUCTIONS}` : INSTRUCTIONS },
  )

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'Projects visible to the current user.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const projects = await listProjects(actor)
      return json(
        projects.map((project) => ({
          id: project.id,
          name: project.name,
          archived: project.isArchived,
        })),
      )
    },
  )

  server.registerTool(
    'list_items',
    {
      title: 'List project items',
      description: 'Diagrams and documents of a project, optionally filtered by type.',
      inputSchema: { projectId: idSchema, type: z.enum(ITEM_TYPES).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, type }) => {
      const project = await getProjectById({ id: projectId, getItems: true }, actor)
      return json(
        (project.items ?? [])
          .filter((item) => !type || item.type === type)
          .map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            archived: item.isArchived,
          })),
      )
    },
  )

  server.registerTool(
    'get_database_schema',
    {
      title: 'Read database diagram',
      description:
        'Tables, columns, indexes and relations of a DATABASE_DIAGRAM item, without layout.',
      inputSchema: { itemId: idSchema },
      annotations: { readOnlyHint: true },
    },
    async ({ itemId }) => {
      const { item, schema } = await getDatabaseSchema(itemId, actor)
      return json({ item: { id: item.id, name: item.name }, ...schema })
    },
  )

  const updateDatabaseSchemaTool = server.registerTool(
    'update_database_schema',
    {
      title: 'Update database diagram',
      description:
        'Writes tables and relations into a DATABASE_DIAGRAM item. Every given table is a complete definition (its columns replace the current ones). mode "merge" keeps tables and relations that are not mentioned; mode "replace" removes them.',
      inputSchema: {
        itemId: idSchema,
        mode: z.enum(SCHEMA_APPLY_MODES).default('merge'),
        ...schemaInput,
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ itemId, mode, tables, relations }) => {
      const { summary } = await updateDatabaseSchema(itemId, { tables, relations }, mode, actor)
      return json({ itemId, mode, ...summary })
    },
  )

  const createDatabaseDiagramTool = server.registerTool(
    'create_database_diagram',
    {
      title: 'Create database diagram',
      description: 'Creates a new DATABASE_DIAGRAM item in a project, optionally with a schema.',
      inputSchema: {
        projectId: idSchema,
        name: nameSchema,
        tables: schemaInput.tables.optional(),
        relations: schemaInput.relations,
      },
    },
    async ({ projectId, name, tables, relations }) => {
      const { item, summary } = await createDatabaseDiagram(
        { projectId, name, schema: tables ? { tables, relations } : undefined },
        actor,
      )
      return json({ item: { id: item.id, name: item.name, type: item.type }, ...summary })
    },
  )

  server.registerTool(
    'get_diagram',
    {
      title: 'Read flowchart or business process',
      description: `Nodes, edges and areas of a FLOWCHART or BUSINESS_PROCESS item, with positions and sizes. ${DIAGRAM_TYPES_HELP}`,
      inputSchema: { itemId: idSchema },
      annotations: { readOnlyHint: true },
    },
    async ({ itemId }) => {
      const { item, graph } = await getDiagramGraph(itemId, actor)
      return json({ item: { id: item.id, name: item.name, type: item.type }, ...graph })
    },
  )

  const updateDiagramTool = server.registerTool(
    'update_diagram',
    {
      title: 'Update flowchart or business process',
      description: `Writes nodes and edges into a FLOWCHART or BUSINESS_PROCESS item. Nodes are matched by id, edges by id (or by source, target and type when no id is given); fields left out keep their current values. mode "merge" keeps nodes and edges that are not mentioned (delete them with removeNodeIds / removeEdgeIds); mode "replace" removes them. Areas are kept. The resulting diagram is validated as a whole and errors name the offending node or edge. ${DIAGRAM_TYPES_HELP}`,
      inputSchema: {
        itemId: idSchema,
        mode: z.enum(SCHEMA_APPLY_MODES).default('merge'),
        ...diagramGraphUpdateSchema.shape,
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ itemId, mode, ...update }) => {
      const { summary } = await updateDiagramGraph(itemId, update, mode, actor)
      return json({ itemId, mode, ...summary })
    },
  )

  const createDiagramTool = server.registerTool(
    'create_diagram',
    {
      title: 'Create flowchart or business process',
      description: `Creates a new FLOWCHART or BUSINESS_PROCESS item in a project, optionally with nodes and edges. ${DIAGRAM_TYPES_HELP}`,
      inputSchema: {
        projectId: idSchema,
        name: nameSchema,
        type: z.enum(DIAGRAM_GRAPH_TYPES),
        nodes: diagramGraphUpdateSchema.shape.nodes,
        edges: diagramGraphUpdateSchema.shape.edges,
      },
    },
    async ({ projectId, name, type, nodes, edges }) => {
      const { item, summary } = await createDiagram(
        { projectId, name, type, graph: { nodes, edges, removeNodeIds: [], removeEdgeIds: [] } },
        actor,
      )
      return json({ item: { id: item.id, name: item.name, type: item.type }, ...summary })
    },
  )

  server.registerTool(
    'get_document',
    {
      title: 'Read document',
      description: 'Content of a DOCUMENT item as Markdown.',
      inputSchema: { itemId: idSchema },
      annotations: { readOnlyHint: true },
    },
    async ({ itemId }) => {
      const { markdown } = await getDocumentMarkdown(itemId, actor)
      return { content: [{ type: 'text' as const, text: markdown }] }
    },
  )

  const updateDocumentTool = server.registerTool(
    'update_document',
    {
      title: 'Update document',
      description:
        'Writes Markdown (headings, paragraphs, bold, italic, strikethrough, inline code, links, bullet and numbered lists, blockquotes, code blocks, horizontal rules) into a DOCUMENT item. mode is required: "replace" overwrites the whole content (send the complete document); "append" adds it at the end. Blocks that did not change are kept, so people editing the document at the same time are not disrupted.',
      inputSchema: {
        itemId: idSchema,
        markdown: z.string(),
        // Required: a default "replace" would let a forgotten mode overwrite the document.
        mode: z.enum(DOCUMENT_WRITE_MODES),
      },
      annotations: { destructiveHint: true },
    },
    async ({ itemId, markdown, mode }) => {
      await updateDocumentMarkdown(itemId, markdown, mode, actor)
      return json({ itemId, mode })
    },
  )

  const createDocumentTool = server.registerTool(
    'create_document',
    {
      title: 'Create document',
      description: 'Creates a new DOCUMENT item in a project, optionally with Markdown content.',
      inputSchema: {
        projectId: idSchema,
        name: nameSchema,
        markdown: z.string().optional(),
      },
    },
    async ({ projectId, name, markdown }) => {
      const { item } = await createDocument({ projectId, name, markdown }, actor)
      return json({ item: { id: item.id, name: item.name, type: item.type } })
    },
  )

  // Disabled tools are not listed and refuse calls; the services refuse writes as well.
  if (readOnly) {
    for (const tool of [
      updateDatabaseSchemaTool,
      createDatabaseDiagramTool,
      updateDiagramTool,
      createDiagramTool,
      updateDocumentTool,
      createDocumentTool,
    ])
      tool.disable()
  }

  return server
}
