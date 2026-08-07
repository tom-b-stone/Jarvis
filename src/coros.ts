// COROS's official remote MCP server (OAuth-protected, Streamable HTTP).
// Replaces the earlier local/unofficial stdio server, which turned out to be
// broken against COROS's current API. This connects to mcp.coros.com
// directly, so it also works from a hosted deployment (no local subprocess).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import fs from "node:fs";
import path from "node:path";

const COROS_MCP_URL =
  process.env.COROS_MCP_URL ??
  (process.env.COROS_REGION === "eu" ? "https://mcpeu.coros.com/mcp" : "https://mcp.coros.com/mcp");
const TOKEN_PATH = path.resolve("coros-token.json");
const CLIENT_INFO_PATH = path.resolve("coros-client.json");
const REDIRECT_URI = process.env.COROS_OAUTH_REDIRECT_URI ?? "http://localhost:3000/coros-oauth-callback";

class FileOAuthProvider implements OAuthClientProvider {
  private _clientInfo?: any;
  private _tokens?: any;
  private _codeVerifier?: string;
  pendingAuthUrl?: string;

  constructor() {
    if (process.env.COROS_TOKEN_JSON) {
      this._tokens = JSON.parse(process.env.COROS_TOKEN_JSON);
    } else if (fs.existsSync(TOKEN_PATH)) {
      this._tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    }
    if (fs.existsSync(CLIENT_INFO_PATH)) {
      this._clientInfo = JSON.parse(fs.readFileSync(CLIENT_INFO_PATH, "utf8"));
    }
  }

  get redirectUrl() {
    return REDIRECT_URI;
  }

  get clientMetadata() {
    return {
      client_name: "Jarvis",
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    };
  }

  clientInformation() {
    return this._clientInfo;
  }

  saveClientInformation(info: any) {
    this._clientInfo = info;
    fs.writeFileSync(CLIENT_INFO_PATH, JSON.stringify(info));
  }

  tokens() {
    return this._tokens;
  }

  saveTokens(tokens: any) {
    this._tokens = tokens;
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log(
      `[coros] tokens saved. For persistence across redeploys, set COROS_TOKEN_JSON=${JSON.stringify(tokens)}`
    );
  }

  redirectToAuthorization(url: URL) {
    this.pendingAuthUrl = url.toString();
  }

  saveCodeVerifier(v: string) {
    this._codeVerifier = v;
  }

  codeVerifier() {
    if (!this._codeVerifier) throw new Error("No PKCE code verifier saved");
    return this._codeVerifier;
  }
}

let client: Client | null = null;
let openaiTools: any[] = [];
let rawTools: { name: string; description: string; inputSchema: any }[] = [];
let connecting: Promise<void> | null = null;

// Kept alive between /coros-auth and /coros-oauth-callback (same process).
let pendingProvider: FileOAuthProvider | null = null;
let pendingTransport: StreamableHTTPClientTransport | null = null;

function sanitizeSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return { type: "object", properties: {} };
  const { $schema, additionalProperties, ...rest } = schema;
  return rest;
}

function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  const out: any = { ...schema };
  if (typeof out.type === "string") out.type = out.type.toUpperCase();
  if (out.properties) {
    out.properties = Object.fromEntries(Object.entries(out.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
  }
  if (out.items) out.items = toGeminiSchema(out.items);
  return out;
}

function hasStoredTokens(): boolean {
  return !!process.env.COROS_TOKEN_JSON || fs.existsSync(TOKEN_PATH);
}

async function loadToolsFrom(c: Client): Promise<void> {
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
}

async function connect(): Promise<void> {
  if (!hasStoredTokens()) return; // not authorized yet; visit /coros-auth
  const provider = new FileOAuthProvider();
  const transport = new StreamableHTTPClientTransport(new URL(COROS_MCP_URL), { authProvider: provider });
  const c = new Client({ name: "jarvis", version: "0.1.0" }, { capabilities: {} });
  await c.connect(transport);
  client = c;
  await loadToolsFrom(c);
}

async function ensureConnected(): Promise<void> {
  if (client) return;
  if (!connecting) connecting = connect().catch((err) => {
    connecting = null;
    throw err;
  });
  await connecting;
}

export function corosAvailable(): boolean {
  return hasStoredTokens();
}

export async function corosTools(): Promise<any[]> {
  if (!corosAvailable()) return [];
  try {
    await ensureConnected();
  } catch {
    return []; // token likely revoked/expired past refresh; degrade quietly
  }
  return openaiTools;
}

export async function corosGeminiTools(): Promise<any[]> {
  if (!corosAvailable()) return [];
  try {
    await ensureConnected();
  } catch {
    return [];
  }
  return rawTools.map((t) => ({ name: t.name, description: t.description, parameters: toGeminiSchema(t.inputSchema) }));
}

export function isCorosTool(name: string): boolean {
  return name.startsWith("coros_");
}

// Bare tool names (no "coros_" prefix), for Claude's allowedTools list.
export async function corosToolNames(): Promise<string[]> {
  if (!corosAvailable()) return [];
  try {
    await ensureConnected();
  } catch {
    return [];
  }
  return rawTools.map((t) => t.name.replace(/^coros_/, ""));
}

export async function callCorosTool(name: string, args: unknown): Promise<unknown> {
  await ensureConnected();
  if (!client) throw new Error("COROS not authorized. Visit /coros-auth to connect your COROS account.");
  const toolName = name.replace(/^coros_/, "");
  const result = await client.callTool({ name: toolName, arguments: args as Record<string, unknown> });
  return result.content;
}

// Current bearer token, for passing to Claude's native external-MCP-server
// support (which talks to mcp.coros.com directly over HTTP with a header,
// rather than going through this module's own Client instance).
export async function corosAccessToken(): Promise<string | undefined> {
  if (!corosAvailable()) return undefined;
  try {
    await ensureConnected();
  } catch {
    return undefined;
  }
  const provider = new FileOAuthProvider();
  const tokens = provider.tokens();
  return tokens?.access_token;
}

// ---- One-time admin authorization flow (see /coros-auth, /coros-oauth-callback) ----

export async function startCorosAuth(): Promise<string> {
  const provider = new FileOAuthProvider();
  const transport = new StreamableHTTPClientTransport(new URL(COROS_MCP_URL), { authProvider: provider });
  const c = new Client({ name: "jarvis", version: "0.1.0" }, { capabilities: {} });
  try {
    await c.connect(transport);
    // Already authorized (existing valid tokens) - nothing to do.
    client = c;
    await loadToolsFrom(c);
    return "already-authorized";
  } catch (err) {
    if (!(err instanceof UnauthorizedError) || !provider.pendingAuthUrl) throw err;
    pendingProvider = provider;
    pendingTransport = transport;
    return provider.pendingAuthUrl;
  }
}

export async function finishCorosAuth(code: string): Promise<void> {
  if (!pendingTransport || !pendingProvider) throw new Error("No pending COROS authorization. Visit /coros-auth first.");
  await pendingTransport.finishAuth(code);
  // Per the MCP SDK's OAuth example: reconnect with a *fresh* transport
  // (reusing the just-authorized transport instance throws "already started").
  const transport = new StreamableHTTPClientTransport(new URL(COROS_MCP_URL), { authProvider: pendingProvider });
  const c = new Client({ name: "jarvis", version: "0.1.0" }, { capabilities: {} });
  await c.connect(transport);
  client = c;
  await loadToolsFrom(c);
  pendingProvider = null;
  pendingTransport = null;
}
