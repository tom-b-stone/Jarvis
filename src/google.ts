import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";

const TOKEN_PATH = path.resolve("token.json");

export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
];

export function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:8765/oauth2callback"
  );
  if (fs.existsSync(TOKEN_PATH)) {
    client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")));
  }
  return client;
}

export function saveToken(tokens: object) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

const auth = () => getOAuthClient();

// ---------- Calendar ----------

export async function listEvents(timeMin: string, timeMax: string) {
  const cal = google.calendar({ version: "v3", auth: auth() });
  const res = await cal.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });
  return (res.data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
    attendees: e.attendees?.map((a) => a.email),
  }));
}

export async function createEvent(input: {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
}) {
  const cal = google.calendar({ version: "v3", auth: auth() });
  const res = await cal.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      attendees: input.attendees?.map((email) => ({ email })),
    },
  });
  return { id: res.data.id, htmlLink: res.data.htmlLink };
}

export async function deleteEvent(eventId: string) {
  const cal = google.calendar({ version: "v3", auth: auth() });
  await cal.events.delete({ calendarId: "primary", eventId, sendUpdates: "all" });
  return { deleted: eventId };
}

// ---------- Gmail ----------

export async function searchEmails(query: string, maxResults = 10) {
  const gmail = google.gmail({ version: "v1", auth: auth() });
  const res = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
  const out = [];
  for (const m of res.data.messages ?? []) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: m.id!,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "Date"],
    });
    const h = (name: string) =>
      msg.data.payload?.headers?.find((x) => x.name === name)?.value ?? "";
    out.push({
      id: m.id,
      from: h("From"),
      subject: h("Subject"),
      date: h("Date"),
      snippet: msg.data.snippet,
    });
  }
  return out;
}

export async function readEmail(messageId: string) {
  const gmail = google.gmail({ version: "v1", auth: auth() });
  const msg = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const h = (name: string) =>
    msg.data.payload?.headers?.find((x) => x.name === name)?.value ?? "";
  let body = "";
  const walk = (part: any) => {
    if (part?.mimeType === "text/plain" && part.body?.data) {
      body += Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    part?.parts?.forEach(walk);
  };
  walk(msg.data.payload);
  return { from: h("From"), to: h("To"), subject: h("Subject"), date: h("Date"), body: body.slice(0, 8000) };
}

export async function sendEmail(input: { to: string; subject: string; body: string; cc?: string }) {
  const gmail = google.gmail({ version: "v1", auth: auth() });
  const lines = [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : "",
    `Subject: ${input.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.body,
  ].filter(Boolean);
  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return { sent: true, id: res.data.id };
}

// ---------- Tasks ----------

export async function listTasks() {
  const tasks = google.tasks({ version: "v1", auth: auth() });
  const lists = await tasks.tasklists.list();
  const listId = lists.data.items?.[0]?.id;
  if (!listId) return [];
  const res = await tasks.tasks.list({ tasklist: listId, showCompleted: false, maxResults: 50 });
  return (res.data.items ?? []).map((t) => ({ id: t.id, title: t.title, due: t.due, notes: t.notes }));
}

export async function addTask(title: string, due?: string, notes?: string) {
  const tasks = google.tasks({ version: "v1", auth: auth() });
  const lists = await tasks.tasklists.list();
  const listId = lists.data.items?.[0]?.id!;
  const res = await tasks.tasks.insert({ tasklist: listId, requestBody: { title, due, notes } });
  return { id: res.data.id, title: res.data.title };
}

export async function completeTask(taskId: string) {
  const tasks = google.tasks({ version: "v1", auth: auth() });
  const lists = await tasks.tasklists.list();
  const listId = lists.data.items?.[0]?.id!;
  await tasks.tasks.patch({ tasklist: listId, task: taskId, requestBody: { status: "completed" } });
  return { completed: taskId };
}
