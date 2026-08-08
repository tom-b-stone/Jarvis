# Conversation Starter — Auto-Greeting auf App-Start

Jedes Mal, wenn Tom eine neue Konversation startet (öffnet die App, refreshed Telegram, etc.), zeigt Jarvis automatisch:

1. **Status-Zusammenfassung** — Was läuft, was ist offen
2. **Heute's Training** — Mit Pace, HR-Cap, Schuh
3. **TO-DO für heute** — Prioritäten nach Rules
4. **⚠️ Warning Flags** — Achilles-Status, überfällige Aufgaben

## Setup

### 1. Browser App (Express / Node)

In `src/index.ts` oder `src/app.ts`:

```typescript
import { initializeConversation } from './handlers/conversation-starter.js'

app.get('/api/conversation/start', async (req, res) => {
  const greeting = await initializeConversation()
  res.json({ greeting })
})
```

Frontend (React/Vue) beim App-Mount:

```javascript
useEffect(() => {
  fetch('/api/conversation/start')
    .then(r => r.json())
    .then(data => {
      setGreeting(data.greeting) // Zeige im UI
    })
}, [])
```

### 2. Telegram Bot

In `src/handlers/telegram-bot.ts`:

```typescript
import { initializeConversationTelegram } from './handlers/conversation-starter.js'

// Beim Start oder `/start` Command:
const greeting = await initializeConversationTelegram()
bot.sendMessage(chatId, greeting, { parse_mode: 'Markdown' })
```

### 3. Real-Time Data

**Aktuell:** Hardcodiert Beispiel-Daten (Jana-Threads, Status).

**TODO:** Integriere echte Quellen:

```typescript
// In generateConversationStarter():

// Gmail: Offene Jana-Threads abrufen
const openJanaThreads = await gmail.search({
  query: 'from:Jana.Marquardt@bmw.de is:unread'
})

// Google Calendar: Heute's Training
const todayEvents = await calendar.listEvents({
  calendarId: TRAINING_CALENDAR_ID,
  timeMin: new Date().toISOString().split('T')[0],
})

// COROS: Achilles-Status aus letztem Lauf
const lastWorkout = await coros.getLatestWorkout()
const achillesStatus = lastWorkout.notes.includes('>3/10') ? 'elevated' : 'normal'

// Render: Deployment Status
const deployStatus = await render.getLatestDeployment()
```

## Output-Format

### Browser (Markdown)

```
**Zusammenfassung**
- Jarvis: Learning-System läuft, Browser-Telegram Sync offen
- Training: Marathon-Prep (W3/6), TEST 2 in 14d
- Inbox: 2 Jana-Threads offen (China Quentin 4d, Fragebogen Reiter 2 11d)
- Critical: keine aktuellen

**Heute**
🏃 W3: 8 km easy (18:00–19:05) — Pace 6:10–6:35, HR ≤145, Schuh Hoka Challenger 8

**Zu tun**
1. Jana: "China Quentin" (offen 4d) — beantworten
2. Jana: "Fragebogen Reiter 2" (offen 11d) — Entwurf + Freigabe
3. Render: Env Vars checken (SUPABASE_URL, GROQ_API_KEY)
4. Nach dem Lauf: A | RPE | Magen | Schuh | rund?

**⚠️ Hinweise**
- ⚠️ Jana-Thread überfällig (Erwartet: <1h Turnaround)
```

### Telegram (Text, Kompakt)

```
Status: Jarvis läuft, Training on-track

🏃 W3: 8 km easy (18:00–19:05) — Pace 6:10–6:35, HR ≤145

👉 Zu tun:
  • Jana: "China Quentin" (offen 4d)
  • Jana: "Fragebogen Reiter 2" (offen 11d)
  • Env Vars checken

⚠️ Jana-Thread überfällig (Erwartet: <1h)
```

## Konfiguration

Alle Konstanten in `src/config/tom-profile.ts`:

- `BRIEF_TIMES.morning` — Wann der Morning Brief gesendet wird (nicht der Starter!)
- `RESPONSIVE_WINDOWS` — Wann Tom erreichbar ist
- `PROTECTED_BLOCKS` — Trainingsfenster (nicht einplanen)
- `TRAINING` → `MILESTONES` — Test-Termine, Ziele

## Rules beachten

Der Conversation Starter nutzt **alle Tom-Regeln**:

- ✓ Kurz & konkret (Zahlen, Uhrzeiten, nicht Adjektive)
- ✓ Keine Floskeln, kein Lob, kein Smalltalk
- ✓ Duzen (du)
- ✓ Deutsch, aber Englisch für technische Begriffe (Pace, HR, Tempo)
- ✓ Prioritäten nach RULES (Critical → sofort, High → nächster Brief)
- ✓ Keine Erfolgreiche Deploys (nur Fehlschläge melden)

## Testing

```bash
# TypeScript kompilieren
npm run build

# Conversation Starter testen
npx ts-node -O '{"module":"esnext"}' -e "
  import { generateConversationStarter } from './src/config/tom-profile.js'
  const starter = await generateConversationStarter({
    openJanaThreads: [
      { subject: 'Test', daysSinceCreated: 1 }
    ]
  })
  console.log(starter)
"
```
