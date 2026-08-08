import { Router } from "express";
import * as g from "./google.js";
import { getPriorityLevel, generateConversationStarter, getUpcomingTraining } from "./config/tom-profile.js";
import { getLearningsForCuration, storeLearning, learningAvailable } from "./learning.js";
import { corosAvailable, callCorosTool } from "./coros.js";

export const dashboardRouter = Router();

type AttentionItem = {
  type: "mail" | "calendar" | "task";
  id: string;
  priority: "critical" | "high";
  label: string;
  meta?: string;
};

function hoursUntil(iso?: string | null): number {
  if (!iso) return Infinity;
  return (new Date(iso).getTime() - Date.now()) / 36e5;
}

dashboardRouter.get("/api/dashboard", async (_req, res) => {
  try {
    const [events, tasks, emails, starter, learnings] = await Promise.all([
      g.listEvents(new Date().toISOString(), new Date(Date.now() + 7 * 864e5).toISOString()),
      g.listTasks(),
      g.searchEmails("is:unread newer_than:3d", 15),
      generateConversationStarter({ todayDate: new Date() }),
      learningAvailable() ? getLearningsForCuration("approved") : Promise.resolve([]),
    ]);

    const attention: AttentionItem[] = [];

    for (const e of emails) {
      const priority = getPriorityLevel(e.from ?? "", e.subject ?? "");
      if (priority === "critical" || priority === "high") {
        attention.push({ type: "mail", id: e.id!, priority, label: e.subject ?? "(no subject)", meta: e.from ?? undefined });
      }
    }

    for (const ev of events) {
      const h = hoursUntil(ev.start);
      if (h >= 0 && h <= 24) {
        attention.push({ type: "calendar", id: ev.id!, priority: "high", label: ev.summary ?? "(untitled)", meta: ev.start ?? undefined });
      }
    }

    for (const t of tasks) {
      const h = hoursUntil(t.due);
      if (t.due && h <= 24) {
        attention.push({ type: "task", id: t.id!, priority: "high", label: t.title ?? "(untitled)", meta: t.due ?? undefined });
      }
    }

    attention.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "critical" ? -1 : 1));

    let recentActivity: unknown = null;
    if (corosAvailable()) {
      try {
        recentActivity = await callCorosTool("coros_querySportRecords", { limit: 3 });
      } catch {
        recentActivity = null; // degrade quietly - COROS data is a bonus, not required
      }
    }

    res.json({
      attention,
      training: {
        today: starter.todayTraining,
        upcoming: getUpcomingTraining(4).slice(1), // next 3 days, today is already in "today"
        warnings: starter.warningFlags,
        recentActivity,
      },
      learnings: learnings.slice(0, 5),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Records a widget interaction (click/dismiss) as a learning signal - what
// Tom actually engages with vs. ignores.
dashboardRouter.post("/api/dashboard/interact", async (req, res) => {
  try {
    const { itemType, action, label } = req.body ?? {};
    if (!itemType || !action || !label) {
      return res.status(400).json({ error: "itemType, action, and label are required" });
    }
    if (learningAvailable()) {
      await storeLearning("fact", `Tom ${action}ed a ${itemType} widget item: "${label}"`, ["interaction", itemType, action]);
    }
    res.json({ recorded: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
