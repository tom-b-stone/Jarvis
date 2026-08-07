// Triggers the COROS MCP server's login tool, which opens a local browser
// login form at http://localhost:8111. Run: npx tsx scripts/coros-login.ts
import "dotenv/config";
import { corosTools, callCorosTool } from "../src/coros.js";

await corosTools();
console.log(await callCorosTool("coros_login", {}));
