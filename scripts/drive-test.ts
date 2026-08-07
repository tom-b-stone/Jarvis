// Test Drive access to the Jarvis working folder. Run: npx tsx scripts/drive-test.ts
import "dotenv/config";
import { driveListFiles } from "../src/google.js";

console.log(await driveListFiles());
