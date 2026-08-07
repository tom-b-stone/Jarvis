// COROS MCP client: connects to a locally-built coros-mcp-server (stdio) and
// exposes its tools in OpenAI function-calling format.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let client: Client | null = null;
let openaiTools: any[] = [];
let connecting: Promise<void> | null = null;

function sanitizeSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return { type: "object", properties: {} };
  const { $schema, additionalProperties, ...rest } = schema;
  return rest;
}

async function connect(): Promise<void> {
  const serverPath = process.env.COROS_MCP_SERVER_PATH;
  if (!serverPath) return;

  const transport = new StdioClientTransport({ command: "node", args: [serverPath] });
  const c = new Client({ name: "jarvis", version: "0.1.0" }, { capabilities: {} });
  await c.connect(transport);

  const { tools } = await c.listTools();
  openaiTools = tools.map((t) => ({
    type: "function" as const,
    function: {
      name: `coros_${t.name}`,
      description: t.description ?? "",
      parameters: sanitizeSchema(t.inputSchema),
    },
  }));
  client = c;
}

export function corosAvailable(): boolean {
  return !!process.env.COROS_MCP_SERVER_PATH;
}

export async function corosTools(): Promise<any[]> {
  if (!corosAvailable()) return [];
  if (!client) {
    if (!connecting) connecting = connect().catch((err) => {
      connecting = null;
      throw err;
    });
    await connecting;
  }
  return openaiTools;
}

export function isCorosTool(name: string): boolean {
  return name.startsWith("coros_");
}

export async function callCorosTool(name: string, args: unknown): Promise<unknown> {
  if (!client) throw new Error("COROS MCP client not connected");
  const toolName = name.replace(/^coros_/, "");
  const result = await client.callTool({ name: toolName, arguments: args as Record<string, unknown> });
  return result.content;
}
