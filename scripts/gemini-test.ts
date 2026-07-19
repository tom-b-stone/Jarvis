// Test the Gemini fallback loop. Run: npx tsx scripts/gemini-test.ts
import "dotenv/config";
import { runGemini } from "../src/gemini.js";

const reply = await runGemini([], "How many events are on my calendar in the next 7 days? Just the number and titles.", (n) =>
  console.error("[tool]", n)
);
console.log(reply);
