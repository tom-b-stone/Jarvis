// Test the Ollama fallback loop incl. COROS tools. Run: npx tsx scripts/ollama-test.ts
import "dotenv/config";
import { runOllama } from "../src/openai.js";

const reply = await runOllama([], "What COROS tools do you have access to? List their names, don't call any yet.", (n) =>
  console.error("[tool]", n)
);
console.log(reply);
