// Test Gemini + COROS tools. Run: npx tsx scripts/gemini-coros-test.ts
import "dotenv/config";
import { runGemini } from "../src/gemini.js";

const reply = await runGemini([], "What COROS sport types are available? Call the tool.", (n) =>
  console.error("[tool]", n)
);
console.log(reply);
process.exit(0);
