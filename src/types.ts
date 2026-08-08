// Backend-agnostic conversation turn, shared across all LLM backends so a
// mid-conversation fallback (e.g. Gemini -> Groq) doesn't lose context.
export type Turn = { role: "user" | "assistant"; text: string };
