import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { type APIRequestContext, expect } from '@playwright/test'
import { BASE_URL } from '../env'
import { createApiKey, revokeApiKey } from './api'

type TextContent = { type: 'text'; text: string }

/** Connects the official MCP client to `/mcp`, the way Claude Code or Cursor would. */
export const connectMcp = async (apiKey: string) => {
  const client = new Client({ name: 'docgraph-e2e', version: '0.0.1' })
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', BASE_URL), {
    requestInit: { headers: { 'x-api-key': apiKey } },
  })
  await client.connect(transport)
  return client
}

/**
 * Connects an agent with a new API key of the user behind `request`. `close()` also revokes the
 * key, so keys don't pile up in that user's Profile while other specs run.
 */
export const connectAgent = async (request: APIRequestContext) => {
  const { id, key } = await createApiKey(request)
  const client = await connectMcp(key)
  const disconnect = client.close.bind(client)
  client.close = async () => {
    await disconnect()
    await revokeApiKey(request, id)
  }
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
