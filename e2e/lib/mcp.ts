import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { expect } from '@playwright/test'
import { BASE_URL } from '../env'

type TextContent = { type: 'text'; text: string }

/** What `get_diagram` answers with, limited to the fields specs look at. */
export type DiagramGraph = {
  nodes: { id: string; text: string; parentId?: string }[]
  edges: unknown[]
}

/** Connects the official MCP client to `/mcp`, the way Claude Code or Cursor would. */
export const connectMcp = async (apiKey: string) => {
  const client = new Client({ name: 'docgraph-e2e', version: '0.0.1' })
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', BASE_URL), {
    requestInit: { headers: { 'x-api-key': apiKey } },
  })
  await client.connect(transport)
  return client
}

/** Calls a tool and parses the JSON text every DocGraph tool answers with. */
export const callTool = async <T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) => {
  const result = await client.callTool({ name, arguments: args })
  const [content] = result.content as (TextContent | undefined)[]
  expect(result.isError, content?.text).toBeFalsy()
  expect(content?.text, `${name} answered without text content`).toEqual(expect.any(String))
  return JSON.parse(content?.text ?? '') as T
}
