// OpenAI-compatible fallback brain: shared by real OpenAI (gpt-4o) and local
// Ollama (OpenAI-compatible /v1 endpoint), same function-calling loop, plus
// Google (calendar/mail/tasks) and COROS tools.
import OpenAI from "openai";
import * as g from "./google.js";
import { SYSTEM_PROMPT } from "./agents.js";
import { corosTools, isCorosTool, callCorosTool } from "./coros.js";
import type { Turn } from "./types.js";

const googleTools = [
  { type: "function" as const, function: { name: "list_events", description: "List calendar events between two ISO datetimes", parameters: { type: "object", properties: { timeMin: { type: "string" }, timeMax: { type: "string" } }, required: ["timeMin", "timeMax"] } } },
  { type: "function" as const, function: { name: "create_event", description: "Create a calendar event (ISO datetimes with offset)", parameters: { type: "object", properties: { summary: { type: "string" }, start: { type: "string" }, end: { type: "string" }, description: { type: "string" }, location: { type: "string" } }, required: ["summary", "start", "end"] } } },
  { type: "function" as const, function: { name: "delete_event", description: "Delete a calendar event by id", parameters: { type: "object", properties: { eventId: { type: "string" } }, required: ["eventId"] } } },
  { type: "function" as const, function: { name: "search_emails", description: "Search Gmail (Gmail query syntax)", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function" as const, function: { name: "read_email", description: "Read full email by id", parameters: { type: "object", properties: { messageId: { type: "string" } }, required: ["messageId"] } } },
  { type: "function" as const, function: { name: "send_email", description: "Send an email. ONLY after the user explicitly confirmed the exact draft.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } } },
  { type: "function" as const, function: { name: "list_tasks", description: "List open to-dos", parameters: { type: "object", properties: {} } } },
  { type: "function" as const, function: { name: "add_task", description: "Add a to-do (due = RFC3339)", parameters: { type: "object", properties: { title: { type: "string" }, due: { type: "string" }, notes: { type: "string" } }, required: ["title"] } } },
  { type: "function" as const, function: { name: "complete_task", description: "Mark a to-do done", parameters: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } } },
  { type: "function" as const, function: { name: "drive_list_files", description: "List files in the Jarvis working folder on Google Drive", parameters: { type: "object", properties: {} } } },
  { type: "function" as const, function: { name: "drive_save_file", description: "Save a text file into the Jarvis working folder on Google Drive", parameters: { type: "object", properties: { name: { type: "string" }, content: { type: "string" }, mimeType: { type: "string" } }, required: ["name", "content"] } } },
  { type: "function" as const, function: { name: "drive_read_file", description: "Read a text file from Google Drive by file id", parameters: { type: "object", properties: { fileId: { type: "string" } }, required: ["fileId"] } } },
];

const googleImpl: Record<string, (a: any) => Promise<unknown>> = {
  list_events: (a) => g.listEvents(a.timeMin, a.timeMax),
  create_event: (a) => g.createEvent(a),
  delete_event: (a) => g.deleteEvent(a.eventId),
  search_emails: (a) => g.searchEmails(a.query),
  read_email: (a) => g.readEmail(a.messageId),
  send_email: (a) => g.sendEmail(a),
  list_tasks: () => g.listTasks(),
  add_task: (a) => g.addTask(a.title, a.due, a.notes),
  complete_task: (a) => g.completeTask(a.taskId),
  drive_list_files: () => g.driveListFiles(),
  drive_save_file: (a) => g.driveSaveFile(a.name, a.content, a.mimeType),
  drive_read_file: (a) => g.driveReadFile(a.fileId),
};

export function openaiAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function ollamaAvailable(): boolean {
  return !!process.env.OLLAMA_BASE_URL;
}

export function groqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

async function runWithClient(
  client: OpenAI,
  model: string,
  history: Turn[],
  userText: string,
  onTool?: (name: string) => void
): Promise<string> {
  const now = new Date().toLocaleString("en-GB", { timeZone: "Europe/Berlin", dateStyle: "full", timeStyle: "short" });

  // Rebuilt fresh each call from the shared, backend-agnostic history, so a
  // mid-conversation fallback from another backend still has full context.
  const messages: any[] = [{ role: "system", content: `${SYSTEM_PROMPT}\n\nCurrent date/time: ${now}` }];
  for (const t of history) messages.push({ role: t.role, content: t.text });
  messages.push({ role: "user", content: userText });

  const tools = [...googleTools, ...(await corosTools())];

  for (let turn = 0; turn < 10; turn++) {
    const res = await client.chat.completions.create({
      model,
      messages,
      tools: tools.length ? tools : undefined,
    });
    const msg = res.choices[0].message;
    messages.push(msg);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) return msg.content ?? "(empty reply)";

    for (const call of calls) {
      if (call.type !== "function") continue;
      const name = call.function.name;
      onTool?.(name.replace(/^coros_/, ""));
      let args: any = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}
      let result: unknown;
      try {
        result = isCorosTool(name) ? await callCorosTool(name, args) : await googleImpl[name](args);
      } catch (err: any) {
        result = { error: err.message };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return "Stopped after too many tool calls.";
}

export async function runOpenAI(history: Turn[], userText: string, onTool?: (name: string) => void): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return runWithClient(client, "gpt-4o", history, userText, onTool);
}

export async function runOllama(history: Turn[], userText: string, onTool?: (name: string) => void): Promise<string> {
  const client = new OpenAI({ baseURL: process.env.OLLAMA_BASE_URL, apiKey: "ollama" });
  return runWithClient(client, process.env.OLLAMA_MODEL ?? "llama3.1", history, userText, onTool);
}

// Groq: free-tier, OpenAI-compatible endpoint, fast Llama inference.
export async function runGroq(history: Turn[], userText: string, onTool?: (name: string) => void): Promise<string> {
  const client = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY });
  return runWithClient(client, process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", history, userText, onTool);
}
