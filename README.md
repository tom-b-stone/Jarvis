# JARVIS — Personal Digital Assistant

Claude Agent SDK backend + Jarvis-style mobile web UI. Manages Gmail, Google Calendar, and Google Tasks through chat.

## Setup

1. **Install** (Node 20+ required):
   ```bash
   npm install
   cp .env.example .env
   ```

2. **Anthropic API key** — create at [console.anthropic.com](https://console.anthropic.com), put in `.env`.

3. **Google credentials** (one OAuth client covers API access AND app login):
   - Go to [console.cloud.google.com](https://console.cloud.google.com) → new project "Jarvis"
   - Enable **Gmail API**, **Google Calendar API**, **Tasks API**
   - OAuth consent screen → External → add yourself as test user
   - Credentials → Create OAuth Client ID → **Web application**
     - Authorized JavaScript origins: `http://localhost:3000` and your Vercel URL (e.g. `https://jarvis-jade-nine.vercel.app`)
     - Authorized redirect URI: `http://localhost:8765/oauth2callback`
   - Copy client ID/secret into `.env`; set `ALLOWED_EMAIL` to your Gmail address

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

## Access control

- The web UI requires Google Sign-In; the backend only accepts the account in `ALLOWED_EMAIL`. Everyone else is rejected at the WebSocket level.
- A static copy of `public/` can be hosted anywhere (e.g. Vercel). Point it at your backend once with `?backend=https://your-backend-host` — it's remembered in localStorage. The backend itself must run on a machine you control (Mac or VPS); Vercel cannot host the WebSocket/agent process.

## Safety

- Jarvis must show you drafts and get confirmation before sending email or invites (enforced in prompts; harden later via `canUseTool` hook).
- `.env` and `token.json` are git-ignored. Never commit them.

## Roadmap

- [ ] Browser agent (Playwright) for form filling
- [ ] Voice input (Web Speech API)
- [ ] Dashboard widgets (calendar strip, task list)
- [ ] Dockerfile + deploy to VPS (Hetzner/Railway), HTTPS via Caddy, auth or Tailscale
