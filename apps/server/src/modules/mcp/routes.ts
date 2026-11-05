import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { requireApiKey } from '../auth/middleware'
import { createMcpServer } from './server'

/**
 * Remote MCP endpoint (Streamable HTTP) for AI agents, authenticated with a
 * personal API key sent in the `x-api-key` header. Stateless: no MCP sessions, one server per request.
 */
export const mcpRouter = new Hono().basePath('/mcp').use('*', requireApiKey)

mcpRouter.post('/', async (c) => {
  const server = createMcpServer(c.get('user'))
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  await server.connect(transport)
  return transport.handleRequest(c.req.raw)
})

// A GET would open a standalone SSE stream that never closes on a server thrown
// away after the request, and there is no session to DELETE. Clients fall back
// to POST only, as in the SDK's stateless example.
mcpRouter.on(['GET', 'DELETE'], '/', (c) =>
  c.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null },
    405,
    {
      allow: 'POST',
    },
  ),
)
