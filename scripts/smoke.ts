// Read-only smoke test of Google integrations. Run: npx tsx scripts/smoke.ts
import "dotenv/config";
import { listEvents, listTasks, searchEmails } from "../src/google.js";

const ev = await listEvents(new Date().toISOString(), new Date(Date.now() + 7 * 864e5).toISOString());
const ts = await listTasks();
const em = await searchEmails("newer_than:2d", 3);
console.log(JSON.stringify({ events: ev.length, tasks: ts.length, recentEmails: em.length }));
