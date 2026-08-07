import "dotenv/config";
import express from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { OAuth2Client } from "google-auth-library";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { jarvisTools } from "./tools.js";
import { agents, SYSTEM_PROMPT } from "./agents.js";
import { runGemini, geminiAvailable } from "./gemini.js";
import { runOpenAI, runOllama, openaiAvailable, ollamaAvailable } from "./openai.js";
import * as g from "./google.js";

const ALLOWED_EMAIL = (process.env.ALLOWED_EMAIL ?? "").toLowerCase();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const authClient = new OAuth2Client(CLIENT_ID);

// Prefer Claude subscription auth (setup-token) over API key when present
if (process.env.CLAUDE_CODE_OAUTH_TOKEN) delete process.env.ANTHROPIC_API_KEY;
const claudeAvailable = !!(process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY);

async function verifyGoogleToken(idToken: string): Promise<string | null> {
  try {
    const ticket = await authClient.verifyIdToken({ idToken, audience: CLIENT_ID });
    const p = ticket.getPayload();
    if (p?.email_verified && p.email?.toLowerCase() === ALLOWED_EMAIL) return p.email;
  } catch {}
  return null;
}

const app = express();
app.use(express.static("public"));

app.get("/config", (_req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.json({ googleClientId: CLIENT_ID });
});

// Dashboard data (events next 7 days, open tasks, recent unread mail)
app.get("/api/overview", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!(await verifyGoogleToken(token))) return res.status(401).json({ error: "unauthorized" });
  try {
    const [events, tasks, emails] = await Promise.all([
      g.listEvents(new Date().toISOString(), new Date(Date.now() + 7 * 864e5).toISOString()),
      g.listTasks(),
      g.searchEmails("is:unread newer_than:3d", 6),
    ]);
    res.json({ events, tasks, emails });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// One-time Google OAuth callback for hosted deployments (e.g. Render), where
// there's no local machine to run `npm run auth` against. Visit the
// consent URL with OAUTH_REDIRECT_URI pointed at this route; the resulting
// token is saved to disk for this instance and echoed back so it can also be
// stored in GOOGLE_TOKEN_JSON for persistence across redeploys.
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).send("Missing code");
  try {
    const client = g.getOAuthClient();
    const { tokens } = await client.getToken(code);
    g.saveToken(tokens);
    res
      .type("text/plain")
      .send(
        `Jarvis authorized.\n\nCopy this into the GOOGLE_TOKEN_JSON environment variable so it survives redeploys:\n\n${JSON.stringify(tokens)}`
      );
  } catch (err: any) {
    res.status(500).send("Auth failed: " + err.message);
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

async function runClaude(text: string, sessionRef: { id?: string }, onTool: (n: string) => void): Promise<string> {
  const now = new Date().toLocaleString("en-GB", { timeZone: "Europe/Berlin", dateStyle: "full", timeStyle: "short" });
  const result = query({
    prompt: text,
    options: {
      systemPrompt: `${SYSTEM_PROMPT}\n\nCurrent date/time: ${now}`,
      mcpServers: { jarvis: jarvisTools },
      agents,
      allowedTools: [
        "Task",
        "mcp__jarvis__list_events",
        "mcp__jarvis__create_event",
        "mcp__jarvis__delete_event",
        "mcp__jarvis__search_emails",
        "mcp__jarvis__read_email",
        "mcp__jarvis__send_email",
        "mcp__jarvis__list_tasks",
        "mcp__jarvis__add_task",
        "mcp__jarvis__complete_task",
        "mcp__jarvis__drive_list_files",
        "mcp__jarvis__drive_save_file",
        "mcp__jarvis__drive_read_file",
      ],
      permissionMode: "bypassPermissions",
      model: "claude-sonnet-5",
      resume: sessionRef.id,
    },
  });
  let reply = "";
  for await (const msg of result) {
    if (msg.type === "system" && msg.subtype === "init") sessionRef.id = msg.session_id;
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "tool_use") onTool(block.name.replace("mcp__jarvis__", ""));
      }
    }
    if (msg.type === "result") {
      if (msg.subtype !== "success") throw new Error(`claude:${msg.subtype}`);
      reply = msg.result;
    }
  }
  return reply;
}

wss.on("connection", (ws: WebSocket) => {
  const claudeSession: { id?: string } = {};
  const geminiHistory: any[] = [];
  const openaiHistory: any[] = [];
  let busy = false;
  let authedAs: string | null = null;

  ws.on("message", async (data) => {
    const parsed = JSON.parse(data.toString());

    if (parsed.type === "auth") {
      authedAs = await verifyGoogleToken(parsed.token);
      if (authedAs) return send(ws, { type: "authed", email: authedAs });
      send(ws, { type: "error", text: "Access denied." });
      return ws.close();
    }
    if (!authedAs) {
      send(ws, { type: "error", text: "Not authenticated." });
      return ws.close();
    }
    if (busy) return send(ws, { type: "error", text: "Still working on the last request." });

    busy = true;
    send(ws, { type: "status", text: "thinking" });
    const onTool = (n: string) => send(ws, { type: "status", text: `using ${n}` });

    try {
      const hasFallback = () => geminiAvailable() || openaiAvailable() || ollamaAvailable();
      let reply: string | undefined;
      if (claudeAvailable) {
        try {
          reply = await runClaude(parsed.text, claudeSession, onTool);
        } catch (err: any) {
          if (!hasFallback()) throw err;
          send(ws, { type: "status", text: "falling back to gemini" });
        }
      }
      if (reply === undefined && geminiAvailable()) {
        try {
          reply = await runGemini(geminiHistory, parsed.text, onTool);
        } catch (err: any) {
          if (!openaiAvailable() && !ollamaAvailable()) throw err;
          send(ws, { type: "status", text: "falling back to gpt-4o" });
        }
      }
      if (reply === undefined && openaiAvailable()) {
        try {
          reply = await runOpenAI(openaiHistory, parsed.text, onTool);
        } catch (err: any) {
          if (!ollamaAvailable()) throw err;
          send(ws, { type: "status", text: "falling back to ollama" });
        }
      }
      if (reply === undefined && ollamaAvailable()) {
        reply = await runOllama(openaiHistory, parsed.text, onTool);
      }
      send(ws, { type: "reply", text: reply ?? "No LLM configured. Set CLAUDE_CODE_OAUTH_TOKEN/ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL in .env." });
    } catch (err: any) {
      send(ws, { type: "error", text: err.message });
    } finally {
      busy = false;
      send(ws, { type: "status", text: "idle" });
    }
  });
});

function send(ws: WebSocket, obj: object) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () =>
  console.log(
    `Jarvis online → http://localhost:${port} (claude:${claudeAvailable} gemini:${geminiAvailable()} openai:${openaiAvailable()} ollama:${ollamaAvailable()})`
  )
);
