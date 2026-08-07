// COROS MCP client: connects to a locally-built coros-mcp-server (stdio) and
// exposes its tools in OpenAI function-calling format.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let client: Client | null = null;
let openaiTools: any[] = [];
let rawTools: { name: string; description: string; inputSchema: any }[] = [];
let connecting: Promise<void> | null = null;

function sanitizeSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return { type: "object", properties: {} };
  const { $schema, additionalProperties, ...rest } = schema;
  return rest;
}

// Gemini's Schema type wants UPPERCASE type names (e.g. "STRING"), unlike
// plain JSON Schema / OpenAI's "string". Recursively convert.
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  const out: any = { ...schema };
  if (typeof out.type === "string") out.type = out.type.toUpperCase();
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  if (out.items) out.items = toGeminiSchema(out.items);
  return out;
}

async function connect(): Promise<void> {
  const serverPath = process.env.COROS_MCP_SERVER_PATH;
  if (!serverPath) return;

  const transport = new StdioClientTransport({ command: "node", args: [serverPath] });
  const c = new Client({ name: "jarvis", version: "0.1.0" }, { capabilities: {} });
  await c.connect(transport);

  const { tools } = await c.listTools();
  rawTools = tools.map((t) => ({
    name: `coros_${t.name}`,
    description: t.description ?? "",
    inputSchema: sanitizeSchema(t.inputSchema),
  }));
  openaiTools = rawTools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
  client = c;
}

export function corosAvailable(): boolean {
  return !!process.env.COROS_MCP_SERVER_PATH;
}

async function ensureConnected(): Promise<void> {
  if (!corosAvailable() || client) return;
  if (!connecting) connecting = connect().catch((err) => {
    connecting = null;
    throw err;
  });
  await connecting;
}

export async function corosTools(): Promise<any[]> {
  if (!corosAvailable()) return [];
  await ensureConnected();
  return openaiTools;
}

// Same tools, in Gemini FunctionDeclaration format (uppercase JSON-schema types).
export async function corosGeminiTools(): Promise<any[]> {
  if (!corosAvailable()) return [];
  await ensureConnected();
  return rawTools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: toGeminiSchema(t.inputSchema),
  }));
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
