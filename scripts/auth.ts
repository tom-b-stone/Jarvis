// One-time Google OAuth flow. Run: npm run auth
import "dotenv/config";
import http from "node:http";
import { getOAuthClient, saveToken, SCOPES } from "../src/google.js";

const client = getOAuthClient();
const url = client.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });

console.log("\nOpen this URL in your browser to authorize Jarvis:\n\n" + url + "\n");

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url!, "http://localhost:8765");
  if (u.pathname !== "/oauth2callback") return res.end();
  const code = u.searchParams.get("code");
  if (!code) return res.end("Missing code");
  const { tokens } = await client.getToken(code);
  saveToken(tokens);
  res.end("Jarvis is authorized. You can close this tab.");
  console.log("Token saved to token.json");
  server.close();
});
server.listen(8765);
