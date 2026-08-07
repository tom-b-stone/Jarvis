// Extracts durable facts/summary/decisions from a finished exchange, using
// Groq (fast + free) so it doesn't compete for the same budget as the main
// reply.
import OpenAI from "openai";

export interface Extracted {
  facts: string[];
  summary: string;
  decisions: string[];
}

const EMPTY: Extracted = { facts: [], summary: "", decisions: [] };

export function extractionAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export async function extractLearnings(
  agentResponse: string,
  context: { userMessage: string; agentResponse: string }
): Promise<Extracted> {
  if (!extractionAvailable()) return EMPTY;

  const client = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY });
  try {
    const res = await client.chat.completions.create({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Analyze this conversation exchange and extract durable, reusable information. " +
            "1. Facts: specific information mentioned (e.g. 'User has a dog named Max'). " +
            "2. Summary: one sentence on what was discussed. " +
            "3. Decisions: any decisions or action items. " +
            'Respond with ONLY JSON, no prose: {"facts": [...], "summary": "...", "decisions": [...]}. ' +
            "If nothing durable was said, return empty arrays and an empty summary.",
        },
        { role: "user", content: `User: ${context.userMessage}\n\nAssistant: ${context.agentResponse}` },
      ],
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);
    return {
      facts: Array.isArray(parsed.facts) ? parsed.facts.filter((f: unknown) => typeof f === "string") : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.filter((d: unknown) => typeof d === "string") : [],
    };
  } catch {
    return EMPTY; // never let extraction failures affect the user-facing reply
  }
}
