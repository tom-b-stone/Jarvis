import "dotenv/config";
import express from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { OAuth2Client } from "google-auth-library";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { jarvisTools } from "./tools.js";
import { agents, SYSTEM_PROMPT } from "./agents.js";
import { runGemini, geminiAvailable } from "./gemini.js";
import { runOpenAI, runOllama, runGroq, openaiAvailable, ollamaAvailable, groqAvailable } from "./openai.js";
import {
  corosAvailable,
  corosAccessToken,
  corosToolNames,
  corosMcpUrl,
  corosStoredTokenJson,
  startCorosAuth,
  finishCorosAuth,
} from "./coros.js";
import * as g from "./google.js";
import { retrieveLearnings, storeLearning, learningAvailable } from "./learning.js";
import { extractLearnings, extractionAvailable } from "./extraction.js";
import { learningsRouter } from "./learnings-routes.js";
import type { Turn } from "./types.js";

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

// One-time COROS authorization (official OAuth-protected remote MCP server).
// Visit /coros-auth once; it redirects to COROS's consent page, which
// redirects back to /coros-oauth-callback to complete the exchange.
app.get("/coros-auth", async (_req, res) => {
  try {
    const result = await startCorosAuth();
    if (result === "already-authorized") return res.type("text/plain").send("COROS already authorized.");
    res.redirect(result);
  } catch (err: any) {
    res.status(500).send("COROS auth failed: " + err.message);
  }
});

app.get("/coros-oauth-callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).send("Missing code");
  try {
    await finishCorosAuth(code);
    res
      .type("text/plain")
      .send(
        `COROS authorized.\n\nCopy this into the COROS_TOKEN_JSON environment variable so it survives redeploys:\n\n${corosStoredTokenJson()}`
      );
  } catch (err: any) {
    res.status(500).send("COROS auth failed: " + err.message);
  }
});

// Retrieve the currently-stored COROS token without needing log/dashboard
// access (e.g. after finishCorosAuth already ran once and you just need to
// copy the value into COROS_TOKEN_JSON).
app.get("/coros-token", (_req, res) => {
  const token = corosStoredTokenJson();
  if (!token) return res.status(404).send("No COROS token stored yet. Visit /coros-auth first.");
  res.type("text/plain").send(token);
});

// Curation dashboard API - same Bearer-token gate as /api/overview.
app.use("/api/learnings", express.json(), async (req, res, next) => {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!(await verifyGoogleToken(token))) return res.status(401).json({ error: "unauthorized" });
  next();
});
app.use(learningsRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

async function runClaude(
  text: string,
  history: Turn[],
  sessionRef: { id?: string },
  onTool: (n: string) => void
): Promise<string> {
  const now = new Date().toLocaleString("en-GB", { timeZone: "Europe/Berlin", dateStyle: "full", timeStyle: "short" });
  // Claude keeps its own memory via `resume`, but if earlier turns in this
  // connection happened on another backend (a prior fallback), Claude's own
  // session has no idea - recap them once, on this connection's first call.
  const recap =
    !sessionRef.id && history.length
      ? `Recent conversation so far (for context, don't repeat it back):\n${history
          .map((t) => `${t.role === "user" ? "Tom" : "Jarvis"}: ${t.text}`)
          .join("\n")}\n\n---\n\n${text}`
      : text;
  const mcpServers: Record<string, any> = { jarvis: jarvisTools };
  const allowedTools = [
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
  ];
  const corosToken = corosAvailable() ? await corosAccessToken() : undefined;
  if (corosToken) {
    mcpServers.coros = {
      type: "http",
      url: corosMcpUrl(),
      headers: { Authorization: `Bearer ${corosToken}` },
    };
    const names = await corosToolNames();
    allowedTools.push(...names.map((t) => `mcp__coros__${t}`));
  }
  const result = query({
    prompt: recap,
    options: {
      systemPrompt: `${SYSTEM_PROMPT}\n\nCurrent date/time: ${now}`,
      mcpServers,
      agents,
      allowedTools,
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
        if (block.type === "tool_use") onTool(block.name.replace(/^mcp__(jarvis|coros)__/, ""));
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
  // Shared across all backends, so a mid-conversation fallback (e.g. Gemini
  // rate-limits and Groq takes over) doesn't lose prior turns.
  const history: Turn[] = [];
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
      // RETRIEVE: relevant past learnings, folded in as silent background
      // context (the system prompt tells the model to weave it in naturally
      // rather than reciting it, so this wrapper is internal-only).
      let promptText = parsed.text;
      if (learningAvailable()) {
        try {
          const relevant = await retrieveLearnings(parsed.text, 5);
          if (relevant.length) {
            promptText = `[Background context from memory, use only if relevant, do not mention this note]\n${relevant
              .map((l) => `- ${l.content}`)
              .join("\n")}\n\n${parsed.text}`;
          }
        } catch (err: any) {
          console.error("[learning] retrieve failed:", err.message);
        }
      }

      const remaining = (...checks: (() => boolean)[]) => checks.some((c) => c());
      let reply: string | undefined;
      if (claudeAvailable) {
        try {
          reply = await runClaude(promptText, history, claudeSession, onTool);
        } catch (err: any) {
          if (!remaining(geminiAvailable, groqAvailable, openaiAvailable, ollamaAvailable)) throw err;
          send(ws, { type: "status", text: "falling back to gemini" });
        }
      }
      if (reply === undefined && geminiAvailable()) {
        try {
          reply = await runGemini(history, promptText, onTool);
        } catch (err: any) {
          if (!remaining(groqAvailable, openaiAvailable, ollamaAvailable)) throw err;
          send(ws, { type: "status", text: "falling back to groq" });
        }
      }
      if (reply === undefined && groqAvailable()) {
        try {
          reply = await runGroq(history, promptText, onTool);
        } catch (err: any) {
          if (!remaining(openaiAvailable, ollamaAvailable)) throw err;
          send(ws, { type: "status", text: "falling back to gpt-4o" });
        }
      }
      if (reply === undefined && openaiAvailable()) {
        try {
          reply = await runOpenAI(history, promptText, onTool);
        } catch (err: any) {
          if (!ollamaAvailable()) throw err;
          send(ws, { type: "status", text: "falling back to ollama" });
        }
      }
      if (reply === undefined && ollamaAvailable()) {
        reply = await runOllama(history, promptText, onTool);
      }
      send(ws, { type: "reply", text: reply ?? "No LLM configured. Set CLAUDE_CODE_OAUTH_TOKEN/ANTHROPIC_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL in .env." });

      if (reply) {
        history.push({ role: "user", text: parsed.text }, { role: "assistant", text: reply });
        if (history.length > 40) history.splice(0, history.length - 40); // cap context growth
      }

      // EXTRACT + STORE: fire-and-forget, never blocks or fails the reply.
      if (reply && learningAvailable() && extractionAvailable()) {
        extractLearnings(reply, { userMessage: parsed.text, agentResponse: reply })
          .then(async (extracted) => {
            for (const fact of extracted.facts) await storeLearning("fact", fact, ["auto-extracted"], parsed.text);
            if (extracted.summary) await storeLearning("summary", extracted.summary, ["auto-extracted"], parsed.text);
            for (const decision of extracted.decisions)
              await storeLearning("decision", decision, ["auto-extracted"], parsed.text);
          })
          .catch((err) => console.error("[learning] extract/store failed:", err.message));
      }
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
    `Jarvis online → http://localhost:${port} (claude:${claudeAvailable} gemini:${geminiAvailable()} groq:${groqAvailable()} openai:${openaiAvailable()} ollama:${ollamaAvailable()} coros:${corosAvailable()})`
  )
);
