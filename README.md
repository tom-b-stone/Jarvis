# JARVIS — Personal Digital Assistant

Claude Agent SDK backend + Jarvis-style mobile web UI. Manages Gmail, Google Calendar, and Google Tasks through chat.

## Setup

1. **Install** (Node 20+ required):
   ```bash
   npm install
   cp .env.example .env
   ```

2. **Anthropic API key** — create at [console.anthropic.com](https://console.anthropic.com), put in `.env`.

3. **Google credentials**:
   - Go to [console.cloud.google.com](https://console.cloud.google.com) → new project "Jarvis"
   - Enable **Gmail API**, **Google Calendar API**, **Tasks API**
   - OAuth consent screen → External → add yourself as test user
   - Credentials → Create OAuth Client ID → **Desktop app** → copy ID/secret into `.env`
   - Add `http://localhost:8765/oauth2callback` as authorized redirect URI

4. **Authorize** (one-time, opens browser):
   ```bash
   npm run auth
   ```

5. **Run**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000. On your phone (same Wi-Fi): `http://<mac-ip>:3000`, then "Add to Home Screen" for the app feel.

## Architecture

- `src/index.ts` — Express + WebSocket server, Agent SDK loop with session resume
- `src/tools.ts` — MCP tools (calendar, gmail, tasks) exposed to the agent
- `src/agents.ts` — Jarvis persona + calendar/email/task subagents
- `src/google.ts` — Google API implementations
- `public/` — mobile-first Jarvis UI (PWA)

## Safety

- Jarvis must show you drafts and get confirmation before sending email or invites (enforced in prompts; harden later via `canUseTool` hook).
- `.env` and `token.json` are git-ignored. Never commit them.

## Roadmap

- [ ] Browser agent (Playwright) for form filling
- [ ] Voice input (Web Speech API)
- [ ] Dashboard widgets (calendar strip, task list)
- [ ] Dockerfile + deploy to VPS (Hetzner/Railway), HTTPS via Caddy, auth or Tailscale
