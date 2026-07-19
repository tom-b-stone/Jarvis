import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import * as g from "./google.js";

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const wrap = async (fn: () => Promise<unknown>) => {
  try {
    return json(await fn());
  } catch (err: any) {
    return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
  }
};

export const jarvisTools = createSdkMcpServer({
  name: "jarvis",
  version: "0.1.0",
  tools: [
    // Calendar
    tool(
      "list_events",
      "List calendar events between two ISO datetimes",
      { timeMin: z.string(), timeMax: z.string() },
      async (a) => wrap(() => g.listEvents(a.timeMin, a.timeMax))
    ),
    tool(
      "create_event",
      "Create a calendar event. start/end are ISO datetimes with timezone offset.",
      {
        summary: z.string(),
        start: z.string(),
        end: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        attendees: z.array(z.string()).optional(),
      },
      async (a) => wrap(() => g.createEvent(a))
    ),
    tool("delete_event", "Delete a calendar event by id", { eventId: z.string() }, async (a) =>
      wrap(() => g.deleteEvent(a.eventId))
    ),
    // Gmail
    tool(
      "search_emails",
      "Search Gmail with standard Gmail query syntax (e.g. 'is:unread newer_than:2d')",
      { query: z.string(), maxResults: z.number().optional() },
      async (a) => wrap(() => g.searchEmails(a.query, a.maxResults))
    ),
    tool("read_email", "Read full email by message id", { messageId: z.string() }, async (a) =>
      wrap(() => g.readEmail(a.messageId))
    ),
    tool(
      "send_email",
      "Send an email from the user's Gmail. ONLY call after the user explicitly confirmed the exact draft.",
      { to: z.string(), subject: z.string(), body: z.string(), cc: z.string().optional() },
      async (a) => wrap(() => g.sendEmail(a))
    ),
    // Tasks
    tool("list_tasks", "List open to-dos from Google Tasks", {}, async () => wrap(() => g.listTasks())),
    tool(
      "add_task",
      "Add a to-do. due is an RFC3339 date like 2026-07-21T00:00:00Z",
      { title: z.string(), due: z.string().optional(), notes: z.string().optional() },
      async (a) => wrap(() => g.addTask(a.title, a.due, a.notes))
    ),
    tool("complete_task", "Mark a to-do as done", { taskId: z.string() }, async (a) =>
      wrap(() => g.completeTask(a.taskId))
    ),
  ],
});
