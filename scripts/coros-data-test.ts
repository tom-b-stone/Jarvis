// Verify authenticated COROS data access. Run: npx tsx scripts/coros-data-test.ts
import "dotenv/config";
import { corosTools, callCorosTool } from "../src/coros.js";

await corosTools();
console.log(await callCorosTool("coros_get_recent_activities", { limit: 3 }));
process.exit(0);
