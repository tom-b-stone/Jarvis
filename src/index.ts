import "dotenv/config";
import express from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { jarvisTools } from "./tools.js";
import { agents, SYSTEM_PROMPT } from "./agents.js";

const app = express();
app.use(express.static("public"));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  let sessionId: string | undefined;
  let busy = false;

  ws.on("message", async (data) => {
    if (busy) return send(ws, { type: "error", text: "Still working on the last request." });
    const { text } = JSON.parse(data.toString());
    busy = true;
    send(ws, { type: "status", text: "thinking" });

    try {
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
          ],
          permissionMode: "bypassPermissions",
          model: "claude-sonnet-5",
          resume: sessionId,
        },
      });

      for await (const msg of result) {
        if (msg.type === "system" && msg.subtype === "init") sessionId = msg.session_id;
        if (msg.type === "assistant") {
          for (const block of msg.message.content) {
            if (block.type === "tool_use") {
              send(ws, { type: "status", text: `using ${block.name.replace("mcp__jarvis__", "")}` });
            }
          }
        }
        if (msg.type === "result") {
          const text = msg.subtype === "success" ? msg.result : `Something went wrong (${msg.subtype}).`;
          send(ws, { type: "reply", text });
        }
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
server.listen(port, () => console.log(`Jarvis online → http://localhost:${port}`));
