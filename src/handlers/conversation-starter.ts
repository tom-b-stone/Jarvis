/**
 * conversation-starter.ts — Initialisiert eine neue Konversation mit Tom.
 *
 * Wird aufgerufen, wenn Tom die App öffnet oder eine neue Chat-Session startet.
 * Zeigt automatisch: (1) Status-Zusammenfassung, (2) Heute's Training, (3) TO-DO
 *
 * Verwendung:
 *   import { initializeConversation } from './handlers/conversation-starter'
 *   const greeting = await initializeConversation()
 *   console.log(greeting)
 */

import { generateConversationStarter, TOM_PROFILE } from '../config/tom-profile.js'

/**
 * Initialisiert eine neue Konversation.
 *
 * In echter Impl. würde das:
 * - Render/Vercel Status via API abrufen
 * - Offene Jana-Threads aus Gmail laden
 * - COROS-Status für Achilles auslesen
 * - Heute's Training aus Google Calendar abrufen
 *
 * Hier: Mockup mit Beispiel-Daten
 */
export async function initializeConversation(): Promise<string> {
  const starter = await generateConversationStarter({
    todayDate: new Date(),
    openJanaThreads: [
      { subject: 'China Quentin', daysSinceCreated: 4 },
      { subject: 'Fragebogen Reiter 2', daysSinceCreated: 11 },
    ],
    currentJarvisStatus: 'Learning-System läuft, Browser-Telegram Sync offen',
    trainingPhase: 'Marathon-Prep (W3/6)',
    achillesStatus: 'normal', // oder 'elevated'
  })

  // Formatiere als Markdown
  return formatConversationStarter(starter)
}

function formatConversationStarter(starter: ReturnType<typeof generateConversationStarter> extends Promise<infer T> ? T : never): string {
  const lines: string[] = []

  lines.push(starter.summary)
  lines.push('')
  lines.push('**Heute**')
  lines.push(starter.todayTraining)
  lines.push('')
  lines.push('**Zu tun**')
  starter.todayTodos.forEach((todo) => lines.push(`- ${todo}`))

  if (starter.warningFlags.length > 0) {
    lines.push('')
    lines.push('**⚠️ Hinweise**')
    starter.warningFlags.forEach((flag) => lines.push(`- ${flag}`))
  }

  return lines.join('\n')
}

/**
 * Telegram-Variante: Kompakter, ohne Markdown.
 */
export async function initializeConversationTelegram(): Promise<string> {
  const starter = await generateConversationStarter({
    todayDate: new Date(),
    openJanaThreads: [
      { subject: 'China Quentin', daysSinceCreated: 4 },
    ],
    trainingPhase: 'Marathon-Prep (W3/6)',
  })

  const lines: string[] = [
    'Status: Jarvis läuft, Training on-track',
    '',
    starter.todayTraining,
    '',
    '👉 Zu tun:',
    ...starter.todayTodos.map((t) => `  • ${t}`),
  ]

  if (starter.warningFlags.length > 0) {
    lines.push('')
    lines.push('⚠️ ' + starter.warningFlags[0]) // Erste Warnung nur
  }

  return lines.join('\n')
}
