// Gemini fallback brain: same tools, simple function-calling loop.
import { GoogleGenAI, Type, type Content, type FunctionDeclaration } from "@google/genai";
import * as g from "./google.js";
import { SYSTEM_PROMPT } from "./agents.js";
import { corosGeminiTools, isCorosTool, callCorosTool } from "./coros.js";

const S = { type: Type.STRING } as const;
const decls: FunctionDeclaration[] = [
  { name: "list_events", description: "List calendar events between two ISO datetimes", parameters: { type: Type.OBJECT, properties: { timeMin: S, timeMax: S }, required: ["timeMin", "timeMax"] } },
  { name: "create_event", description: "Create a calendar event (ISO datetimes with offset)", parameters: { type: Type.OBJECT, properties: { summary: S, start: S, end: S, description: S, location: S }, required: ["summary", "start", "end"] } },
  { name: "delete_event", description: "Delete a calendar event by id", parameters: { type: Type.OBJECT, properties: { eventId: S }, required: ["eventId"] } },
  { name: "search_emails", description: "Search Gmail (Gmail query syntax)", parameters: { type: Type.OBJECT, properties: { query: S }, required: ["query"] } },
  { name: "read_email", description: "Read full email by id", parameters: { type: Type.OBJECT, properties: { messageId: S }, required: ["messageId"] } },
  { name: "send_email", description: "Send an email. ONLY after the user explicitly confirmed the exact draft.", parameters: { type: Type.OBJECT, properties: { to: S, subject: S, body: S }, required: ["to", "subject", "body"] } },
  { name: "list_tasks", description: "List open to-dos", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "add_task", description: "Add a to-do (due = RFC3339)", parameters: { type: Type.OBJECT, properties: { title: S, due: S, notes: S }, required: ["title"] } },
  { name: "complete_task", description: "Mark a to-do done", parameters: { type: Type.OBJECT, properties: { taskId: S }, required: ["taskId"] } },
  { name: "drive_list_files", description: "List files in the Jarvis working folder on Google Drive", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "drive_save_file", description: "Save a text file into the Jarvis working folder on Google Drive", parameters: { type: Type.OBJECT, properties: { name: S, content: S, mimeType: S }, required: ["name", "content"] } },
  { name: "drive_read_file", description: "Read a text file from Google Drive by file id", parameters: { type: Type.OBJECT, properties: { fileId: S }, required: ["fileId"] } },
];

const impl: Record<string, (a: any) => Promise<unknown>> = {
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

export function geminiAvailable() {
  return !!process.env.GEMINI_API_KEY;
}

export async function runGemini(
  history: Content[],
  userText: string,
  onTool?: (name: string) => void
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const now = new Date().toLocaleString("en-GB", { timeZone: "Europe/Berlin", dateStyle: "full", timeStyle: "short" });
  history.push({ role: "user", parts: [{ text: userText }] });

  const allDecls = [...decls, ...(await corosGeminiTools())];

  for (let turn = 0; turn < 10; turn++) {
    const res = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: history,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\nCurrent date/time: ${now}`,
        tools: [{ functionDeclarations: allDecls }],
      },
    });
    const cand = res.candidates?.[0];
    if (!cand?.content) return "No response from Gemini.";
    history.push(cand.content);

    const calls = cand.content.parts?.filter((p) => p.functionCall) ?? [];
    if (calls.length === 0) {
      return cand.content.parts?.map((p) => p.text ?? "").join("") || "(empty reply)";
    }
    const responses = [];
    for (const c of calls) {
      const { name, args } = c.functionCall!;
      onTool?.(name!.replace(/^coros_/, ""));
      let result: unknown;
      try {
        result = isCorosTool(name!) ? await callCorosTool(name!, args ?? {}) : await impl[name!](args ?? {});
      } catch (err: any) {
        result = { error: err.message };
      }
      responses.push({ functionResponse: { name: name!, response: { result } } });
    }
    history.push({ role: "user", parts: responses });
  }
  return "Stopped after too many tool calls.";
}
