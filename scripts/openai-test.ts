// Test the OpenAI fallback loop incl. COROS tools. Run: npx tsx scripts/openai-test.ts
import "dotenv/config";
import { runOpenAI } from "../src/openai.js";

const reply = await runOpenAI([], "What COROS tools do you have access to? List their names, don't call any yet.", (n) =>
  console.error("[tool]", n)
);
console.log(reply);
