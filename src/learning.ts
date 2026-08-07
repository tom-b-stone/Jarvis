// Persistent cross-session memory: stores facts/summaries/decisions extracted
// from conversations in Supabase (pgvector), retrieved by semantic search to
// personalize future responses.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

export type LearningType = "fact" | "summary" | "decision";

export interface Learning {
  id: string;
  type: LearningType;
  content: string;
  tags: string[];
  source_message: string | null;
  status: "auto" | "approved";
  created_at: string;
}

let supabase: SupabaseClient | null = null;

export function learningAvailable(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}

export function initSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
  }
  return supabase;
}

async function embed(text: string): Promise<number[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: [text],
    config: { outputDimensionality: 768 },
  });
  const values = res.embeddings?.[0]?.values;
  if (!values) throw new Error("No embedding returned");
  return values;
}

export async function storeLearning(
  type: LearningType,
  content: string,
  tags: string[] = [],
  sourceMessage?: string
): Promise<void> {
  if (!learningAvailable() || !content.trim()) return;
  const db = initSupabase();
  const embedding = await embed(content);
  const { error } = await db.from("learnings").insert({
    type,
    content,
    embedding,
    tags,
    source_message: sourceMessage ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function retrieveLearnings(query: string, limit = 5): Promise<Learning[]> {
  if (!learningAvailable() || !query.trim()) return [];
  const db = initSupabase();
  const embedding = await embed(query);
  const { data, error } = await db.rpc("match_learnings", { query_embedding: embedding, match_count: limit });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function approveLearning(id: string): Promise<void> {
  const db = initSupabase();
  const { error } = await db.from("learnings").update({ status: "approved" }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLearning(id: string): Promise<void> {
  const db = initSupabase();
  const { error } = await db.from("learnings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getLearningsForCuration(status?: "auto" | "approved", type?: LearningType): Promise<Learning[]> {
  const db = initSupabase();
  let q = db.from("learnings").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
