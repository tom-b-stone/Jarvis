import { Router } from "express";
import { getLearningsForCuration, approveLearning, deleteLearning, storeLearning } from "./learning.js";
import { extractLearnings } from "./extraction.js";

export const learningsRouter = Router();

learningsRouter.get("/api/learnings", async (req, res) => {
  try {
    const status = req.query.status as "auto" | "approved" | undefined;
    const type = req.query.type as "fact" | "summary" | "decision" | undefined;
    res.json(await getLearningsForCuration(status, type));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

learningsRouter.get("/api/learnings/dashboard", async (_req, res) => {
  try {
    res.json(await getLearningsForCuration("auto"));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

learningsRouter.post("/api/learnings/approve/:id", async (req, res) => {
  try {
    await approveLearning(req.params.id);
    res.json({ approved: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

learningsRouter.delete("/api/learnings/:id", async (req, res) => {
  try {
    await deleteLearning(req.params.id);
    res.json({ deleted: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual extraction trigger, for testing without a live chat exchange.
learningsRouter.post("/api/learnings/extract", async (req, res) => {
  try {
    const { userMessage, agentResponse } = req.body ?? {};
    if (!userMessage || !agentResponse) {
      return res.status(400).json({ error: "userMessage and agentResponse are required" });
    }
    const extracted = await extractLearnings(agentResponse, { userMessage, agentResponse });
    for (const fact of extracted.facts) await storeLearning("fact", fact, ["auto-extracted"], userMessage);
    if (extracted.summary) await storeLearning("summary", extracted.summary, ["auto-extracted"], userMessage);
    for (const decision of extracted.decisions) await storeLearning("decision", decision, ["auto-extracted"], userMessage);
    res.json(extracted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
