/**
 * tom-profile.ts — Toms Verhaltensprofil als typisierte Jarvis-Konfiguration.
 *
 * Quelle: rules.json (v1.0, generiert 2026-08-08). Diese Datei ist die
 * kanonische Laufzeit-Repräsentation. rules.json bleibt das menschenlesbare
 * Original; bei Änderungen dort hier nachziehen (oder loadRulesJson() nutzen).
 *
 * Verwendung:
 *   import { getPriorityLevel, isCriticalSender } from "./config/tom-profile.js";
 *   const priority = getPriorityLevel("Jana.Marquardt@bmw.de", "Wichtig", []);
 *   // -> "critical" -> sofort melden, Morning Brief überspringen
 */

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type Priority = "critical" | "high" | "medium" | "ignore";

export type ContactPriority = "critical" | "high" | "medium";

export interface Contact {
  name: string;
  relation: string;
  emails: string[];
  priority: ContactPriority;
  org?: string;
  observedResponseMinutes?: number;
  pattern?: string;
  confidential?: boolean;
  note?: string;
}

export interface ResponsiveWindow {
  days: string;
  from: string;
  to: string;
  mode: "mobile_short" | "desk_deep_work" | "flexible";
}

export interface ProtectedBlock {
  days: string[];
  from: string;
  to: string;
  label: string;
}

export type OutputContext =
  | "morningBrief"
  | "trainingEvent"
  | "conversationStarter"
  | "incident"
  | "emailDraft";

export interface ConversationStarter {
  summary: string;      // Was läuft, was ist offen
  todayTraining: string; // Heute's Training + Besonderheiten
  todayTodos: string[]; // Max. 3-5 konkrete Aufgaben
  warningFlags: string[]; // Achilles, Deadlines, etc.
}

// ---------------------------------------------------------------------------
// Owner / Tone
// ---------------------------------------------------------------------------

export const RULES_VERSION = "1.0";
export const RULES_GENERATED = "2026-08-08";

export const OWNER = {
  name: "Tom Marquardt",
  email: "marquardt.tom@gmail.com",
  aliases: ["marquardt.tom+1@gmail.com"],
  location: "München-Allach",
  timezone: "Europe/Berlin",
  github: "tom-b-stone",
  vercelTeam: "Toms-Vault",
  discogs: "TomMarquardt",
} as const;

export const TONE = {
  address: "du",
  defaultLanguage: "de",
  languageRule:
    "Sprache folgt dem Empfängerkreis, nicht dem Thread. Internationaler Empfänger im CC -> Englisch. Technische Begriffe bleiben immer Englisch.",
  mixedLanguageAllowed: true,
  humor: false,
  emojisInProse: false,
  emojisAsCategoryPrefix: true,
  exclamationMarks: false,
  smalltalk: false,
  praise: false,
  correctUserTypos: false,
  defaultLengthLines: 3,
  styleKeywords: [
    "direkt",
    "nüchtern",
    "faktisch",
    "zahlengetrieben",
    "handlungsorientiert",
  ],
  bannedOpeners: [
    "Gerne helfe ich dir",
    "Gute Frage",
    "Ich hoffe, es geht dir gut",
    "Kein Problem",
  ],
  bannedClosers: [
    "Lass mich wissen, ob du noch etwas brauchst",
    "Ich stehe jederzeit zur Verfügung",
  ],
  signaturePhrases: [
    "Vielen Dank",
    "Liebe Grüße",
    "Mit freundlichen Grüßen",
    "wäre super",
    "mir melden",
    "rund? j/n",
  ],
} as const;

export const CATEGORY_ICONS = {
  run: "🏃",
  strength: "💪",
  test: "🧪",
  race: "🏁",
  change: "⚠️",
  critical: "🔴",
  high: "🟠",
  error: "❌",
  calendar: "📅",
  tech: "⚙️",
} as const;

// ---------------------------------------------------------------------------
// Kontakte
// ---------------------------------------------------------------------------

export const CONTACTS: Contact[] = [
  {
    name: "Jana Marquardt",
    relation: "Ehefrau",
    emails: ["jana.marquardt@bmw.de", "janamarquardt@yahoo.de"],
    org: "BMW Group, Sales / Central Volume Planning (CS-401)",
    priority: "critical",
    observedResponseMinutes: 7,
    pattern:
      "Schickt Arbeitsaufträge, oft nur als Betreffzeile ohne Body. Erwartet KI-Deliverables (docx/pptx) mit Turnaround unter 1 Stunde.",
    confidential: true,
  },
  {
    name: "Quentin Marquardt",
    relation: "Sohn, Laufpartner",
    emails: ["quentin.marquardt@icloud.com"],
    priority: "high",
  },
  {
    name: "Julian (Julez) Marquardt",
    relation: "Sohn",
    emails: ["julez.marquardt@gmail.com"],
    priority: "medium",
  },
  {
    name: "Vanessa Roettger",
    relation: "Audi Revolut F1 Team, Communications",
    emails: ["vanessa.roettger@audif1.com"],
    priority: "critical",
    observedResponseMinutes: 16,
    confidential: true,
    note: "Embargo-Timing ist harte Deadline",
  },
  {
    name: "William Ponissi",
    relation: "Audi Revolut F1 Team",
    emails: ["william.ponissi@audif1.com"],
    priority: "high",
  },
  {
    name: "Tobias Bucher",
    relation: "Audi Revolut F1 Team, Media/Fotos",
    emails: ["tobias.bucher@audif1.com"],
    priority: "high",
  },
];

/** Schneller Lookup: normalisierte E-Mail -> Kontakt. */
export const CONTACTS_BY_EMAIL: ReadonlyMap<string, Contact> = new Map(
  CONTACTS.flatMap((c) => c.emails.map((e) => [e.toLowerCase(), c] as const)),
);

// ---------------------------------------------------------------------------
// Priority-Regeln
// ---------------------------------------------------------------------------

export const CRITICAL_SENDERS = [
  "jana.marquardt@bmw.de",
  "janamarquardt@yahoo.de",
] as const;

/** Systeme, die nur bei Fehlern kritisch sind (Erfolg ist kein Ereignis). */
export const CRITICAL_SYSTEM_SENDERS = [
  "no-reply@render.com",
  "notifications@vercel.com",
] as const;

export const CRITICAL_SYSTEM_SUBJECT_KEYWORDS = [
  "failed",
  "error",
  "fehler",
  "fehlgeschlagen",
] as const;

/** Domains mit harten Deadlines — kritisch nur bei Deadline-Keywords. */
export const DEADLINE_DOMAINS = ["audif1.com"] as const;
export const DEADLINE_KEYWORDS = [
  "embargo",
  "go live",
  "release",
  "advisory",
] as const;

export const SECURITY_KEYWORDS = [
  "oauth application",
  "new sign-in",
  "sudo",
  "verification code",
  "kontodaten geteilt",
] as const;

export const HEALTH_CRITICAL_KEYWORDS = [
  "achilles",
  "achillessehne",
  "morgensteifigkeit",
] as const;

export const HIGH_SENDERS = [
  "quentin.marquardt@icloud.com",
  "julez.marquardt@gmail.com",
] as const;

export const HIGH_TOPIC_KEYWORDS = [
  "reklamation",
  "lieferung",
  "erstattung",
  "tracking",
  "angebot",
  "rechnung",
  "vertrag",
  "frist",
  "kündigung",
] as const;

export const HIGH_TRAINING_MILESTONES = [
  "TEST",
  "PEAK",
  "Taper",
  "MARATHON",
] as const;

export const HIGH_PROJECT_KEYWORDS = [
  "state sync",
  "repo merge",
  "feature parity",
  "telegram",
  "supabase",
  "learning",
] as const;

export const MEDIUM_TOPIC_KEYWORDS = [
  "marathon anmeldung",
  "valencia",
  "berlin-marathon",
  "silvesterlauf",
  "johannesbad",
  "seelauf",
  "backyard",
  "glastrennwand",
  "schiebetür",
  "innentür",
  "interior",
  "claude",
  "agent sdk",
  "groq",
  "vercel changelog",
] as const;

/** Nur bei konkretem Wantlist-Treffer relevant. */
export const MEDIUM_CONDITIONAL_SENDERS = ["noreply@discogs.com"] as const;

/** Glob-Patterns (`*` = beliebige Zeichen) für Absender, die nie gemeldet werden. */
export const IGNORE_SENDER_PATTERNS = [
  "newsletter@*",
  "news@*",
  "noreply@medium.com",
  "dan@tldrnewsletter.com",
  "np@neilpatel.com",
  "*@facebookmail.com",
  "notifications-noreply@linkedin.com",
  "mailrobot@mail.xing.com",
  "recommendations@*pinterest.com",
  "no-reply@nebenan.de",
  "*@ifttt.com",
  "*@my.aboutyou-outlet.de",
  "*@def-shop.com",
  "*@mediamarkt.de",
  "*@ikea.de",
  "*@bolia.com",
  "*@mobelaris.com",
  "*@salomon.com",
  "*@shokz.com",
  "*@ryzon.net",
  "*@impericon.com",
  "*@sportpursuit.com",
  "*@fitshop.email",
  "*@aldi-sued.de",
  "*@baumarkt.toom.de",
  "*@fotokasten.de",
  "*@myphotobook.de",
  "*@zealoptics.com",
  "*@velitessport.com",
  "*@mosmosh.com",
  "*@granit.com",
  "*@thebarn.de",
  "*@monocle.com",
  "*@highsnobiety.com",
  "*@runnersworld.de",
  "*@substack.com",
  "*@beehiiv.com",
  "*@thepixellab.net",
  "*@aescripts.com",
  "*@stills.com",
  "*@hyte.com",
  "*@e.ufc.com",
  "*@maurten.com",
  "*@finnishdesignshop.com",
] as const;

export const IGNORE_CATEGORIES = ["promotions", "social", "forums"] as const;

/**
 * Noreply-Absender auf Deadline-Domains sind Marketing-Newsletter (z. B.
 * `noreply@audif1.com` Renn-Reports), nicht die Kommunikations-Kontakte.
 * Ohne Embargo-/Advisory-Keyword werden sie ignoriert.
 */
export const NOREPLY_LOCALPARTS = ["noreply", "no-reply", "donotreply", "do-not-reply"] as const;

export const IGNORE_RULES = [
  "Erfolgreiche Deploys nicht melden - nur Fehlschläge sind Ereignisse",
  "Routine-Versandbestätigungen ohne Handlungsbedarf nicht melden",
  "Zufriedenheitsumfragen ignorieren, AUSSER es gibt ein offenes Problem zur selben Bestellung - dann als Eskalationskanal nutzen",
  "Generische Auktions-/Shop-Mails ohne konkreten Wantlist-Treffer ignorieren",
  "Keine Motivationssprüche, kein Wetter, keine Zitate",
] as const;

/**
 * Antwortfristen in Minuten je Priorität.
 * critical = sofort, high = bis zum nächsten Brief, medium = Wochen-Digest.
 */
export const RESPONSE_DEADLINE_MINUTES: Record<Priority, number> = {
  critical: 0,
  high: 240,
  medium: 10080,
  ignore: Number.POSITIVE_INFINITY,
};

export const NOTIFY_CHANNEL: Record<Priority, string> = {
  critical: "immediately",
  high: "next_brief",
  medium: "weekly_digest",
  ignore: "never",
};

// ---------------------------------------------------------------------------
// Verfügbarkeit / Zeitfenster
// ---------------------------------------------------------------------------

export const RESPONSIVE_WINDOWS: ResponsiveWindow[] = [
  { days: "mon-fri", from: "06:30", to: "09:45", mode: "mobile_short" },
  { days: "mon-fri", from: "15:40", to: "22:00", mode: "desk_deep_work" },
  { days: "sat-sun", from: "12:00", to: "22:00", mode: "flexible" },
];

export const DEAD_ZONES = [
  {
    days: "mon-fri",
    from: "10:00",
    to: "15:00",
    reason: "Arbeitszeit, keine Reaktion zu erwarten",
  },
] as const;

export const PROTECTED_BLOCKS: ProtectedBlock[] = [
  { days: ["mon", "wed"], from: "18:00", to: "18:25", label: "💪 Calf/Achilles strength (HSR)" },
  { days: ["tue", "thu"], from: "18:00", to: "19:05", label: "🏃 Run" },
  { days: ["sat"], from: "08:30", to: "11:50", label: "🏃 Long run" },
  { days: ["sun"], from: "09:00", to: "09:45", label: "🏃 Recovery run (optional)" },
];

export const BRIEF_TIMES = { morning: "06:45", evening: "19:30" } as const;

export const CALENDARS = {
  primary: {
    id: "marquardt.tom@gmail.com",
    note: "Fast leer. Enthaelt NICHT die Arbeitstermine. Leerer Kalender bedeutet NICHT freier Tag.",
  },
  training: {
    id: "f2cf24bc1fb3ea30d1ef614211f66effffcd96fd5cde5e1cdb0b68f6661ad317@group.calendar.google.com",
    note: "Von der KI gepflegter Marathon-Plan. Hier schreibt Jarvis.",
    colorIds: { "10": "run", "8": "strength", "11": "test_or_race" },
  },
} as const;

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export const GOAL_RACE = {
  name: "MARATHON MÜNCHEN",
  date: "2026-10-11",
  startTime: "09:00",
  goalTime: "4:14",
  goalPacePerKm: "6:01",
  racePlan:
    "km 0-10 @ 6:05-6:08 (bewusst langsam), km 10-32 @ 6:00, danach Rennen. Halbzeit-Split ~2:07:30. Gel alle 40 min ab km 8, an jeder Station trinken.",
} as const;

export const PHYSIOLOGY = {
  naturalEfficientPacePerKm: "5:50-5:55",
  hrCapEasy: 148,
  hrCapLong: 150,
  hrCapRecovery: 145,
  cadence: "156-160",
  strideCm: "105-110",
  groundContactMs: 280,
  note: "Langsamer als 5:50-5:55 zu erzwingen fuehrt zu Shuffling und ist ineffizient - nicht als 'zu schnell' bewerten.",
} as const;

export const ACHILLES_PROTOCOL = {
  acceptable: "<=3/10",
  stopRule:
    ">3/10 im Lauf ODER erhoehte Morgensteifigkeit am Folgetag -> naechsten Lauf streichen und Tom melden",
  painThreshold: 3,
  strengthDays: ["mon", "wed"],
  taperRule: "ab 2026-09-28 nur 2 Saetze, kein neues Gewicht",
} as const;

export const GEAR = {
  watch: "COROS",
  shoesLong: "Brooks Glycerin Max 2",
  shoesEasy: ["Hoka Challenger 8", "Hoka Mach 7"],
  shoesTest: "Hoka Mach 7",
  fuel: ["MNSTRY Gel", "Maurten"],
  fuelRule:
    "Gel nie ohne Wasser. Nie nuechtern in Gut-Training-Laeufe; Fruehstueck 60-90 min vorher.",
} as const;

export const FEEDBACK_FORMAT =
  "A(chilles) 0-10 | RPE | Magen 0-10 | Schuh | rund? j/n";

export const MILESTONES = [
  { date: "2026-08-22", label: "TEST 2 - 10K time trial", passThreshold: "<=54:00" },
  {
    date: "2026-09-13",
    label: "TEST 3 - Halbmarathon @ 5:40-5:45",
    passThreshold: "<=2:00",
    decisionPoint: true,
    outcomes: {
      "<=2:00": "4:14 bestaetigt",
      "2:00-2:06": "Ziel auf 4:20-4:25 anpassen",
      ">2:06": "Ziel 4:30 und neu bewerten",
    },
  },
  { date: "2026-09-27", label: "PEAK Long run 31 km, letzte 10 km @ MP" },
  { date: "2026-09-28", label: "Taper Start" },
  { date: "2026-10-11", label: "MARATHON MÜNCHEN" },
] as const;

// ---------------------------------------------------------------------------
// Interessen, Verhaltensregeln, Privacy
// ---------------------------------------------------------------------------

export const INTEREST_GROUPS = [
  {
    id: "jarvis",
    label: "Jarvis - Personal AI Platform",
    weight: 1.0,
    stack: [
      "Node/TypeScript", "Express", "WebSocket", "Claude Agent SDK", "MCP",
      "Google OAuth", "Render", "Vercel", "Supabase/pgvector", "Groq",
      "Gemini", "Telegram Bot",
    ],
    currentFocus: [
      "Learning-System (retrieve/inject/extract/store)",
      "Curation dashboard /dashboard",
      "Multi-provider routing",
      "Feature parity Browser <-> Telegram",
    ],
    behavior:
      "Bei Build-/Deploy-Fehlern nicht nur melden: Logs ziehen, Ursache isolieren, konkreten Fix und Verifikationsschritt vorschlagen.",
  },
  { id: "training", label: "Marathon Training & Coaching", weight: 1.0 },
  { id: "family", label: "Familie & Haushalt", weight: 0.9 },
  { id: "motorsport", label: "Audi F1 Digital / audif1.com", weight: 0.8, confidential: true },
  {
    id: "jana_consulting",
    label: "KI-Consulting fuer Jana (BMW Programmplanung)",
    weight: 0.9,
    confidential: true,
    domainTerms: [
      "Lieferwunsch", "Baubarkeit", "Typschluessel", "Geomixallokation",
      "Kalendarisierung", "Deckungsbeitrag", "Szenariomanagement", "CO2 Regulatorik",
    ],
    deliverableFormat:
      "Nummerierte Dateien: 01_Konzept_....docx, 02_Managementpraesentation_....pptx",
  },
  { id: "home_design", label: "Haus, Design & Interior", weight: 0.6 },
  { id: "culture", label: "Vinyl, UFC, Streetwear, Monocle", weight: 0.4 },
] as const;

export const BEHAVIOR_RULES = [
  { id: "no_send_without_confirmation", rule: "Niemals E-Mail senden, Einladung verschicken oder Daten loeschen ohne explizite Freigabe von Tom." },
  { id: "draft_first", rule: "Immer vollstaendigen Entwurf liefern statt Rueckfrage stellen. Format: Empfaenger / Betreff / Text / 'Senden?'" },
  { id: "parallelize", rule: "Optionen breit auffaechern und gleichzeitig anstossen." },
  { id: "numbers_not_adjectives", rule: "Zahlen, Schwellenwerte, Uhrzeiten und Abbruchkriterien statt Adjektiven." },
  { id: "contradict_with_data", rule: "Widersprechen ist erwuenscht, wenn Daten dagegen stehen - aber mit Zahlen, nie mit Meinung." },
  { id: "escalation_style", rule: "Bei abgelehntem berechtigtem Anspruch: Sie-Form, lueckenlose Beweiskette, zitierte Rechtsgrundlage, Gegenfrist mit Datum und Rechtsfolge." },
  { id: "accept_fair_offer", rule: "Faire Angebote ohne Nachfeilschen annehmen und nach dem naechsten Schritt fragen." },
  { id: "respect_training_blocks", rule: "Keine Termine in geschuetzte Trainingsbloecke legen. Konflikte aktiv benennen." },
  { id: "empty_calendar_not_free", rule: "Leerer Primaerkalender bedeutet nicht freier Tag." },
  { id: "no_typo_correction", rule: "Toms Tippfehler nie korrigieren oder kommentieren." },
  { id: "device_signal", rule: "'Outlook fuer Android' = mobil, kurze Antwort. 'Outlook fuer Mac' = Schreibtisch, ausgearbeitete Antwort." },
] as const;

export const PRIVACY = {
  confidentialSources: ["jana.marquardt@bmw.de", "*@audif1.com"],
  rules: [
    "CONFIDENTIAL-Material nicht an Dritt-Provider weitergeben",
    "CONFIDENTIAL-Material nicht ins Learning-System (Supabase) schreiben",
    "Audi-F1-Inhalte vor Embargo-Ablauf nie extern verwenden",
    "Secrets aus .env, token.json, coros-token.json nie ausgeben oder loggen",
    "ALLOWED_EMAIL-Whitelist ist die Zugriffsgrenze - keine Aufweichung ohne ausdrueckliche Anweisung von Tom",
  ],
} as const;

export const OUTPUT_TEMPLATES: Record<OutputContext, string> = {
  morningBrief:
    "🔴 {n} kritisch\n- {item + vorgeschlagene Aktion}\n\n📅 Heute\n- {time} {icon} {label} ({key params})\n\n⚙️ Jarvis\n- {deploy/build status, offene tasks}\n\n🟠 Später\n- {max 3}",
  trainingEvent:
    "{icon} W{n}: {distance} {type}\nPace {min}-{max}/km, HR cap {hr}. Schuh: {shoe}.\n{Begruendung, 1 Satz}\n⚠️ NEU (Coach, nach {trigger}): {change}\nAbbruch: {criterion} → streichen, mir melden.\nCOROS-Kommentar: A 0-10 | RPE | Magen | Schuh | rund? j/n",
  incident:
    "❌ {system}: {error} ({time})\nCommit: {message}\nWahrscheinliche Ursache: {one line}\nFix: {concrete step}\nVerifikation: {how to confirm}",
  emailDraft: "An: {to}\nBetreff: {subject}\n\n{body}\n\nSenden?",
  conversationStarter:
    "**Zusammenfassung**\n{summary}\n\n**Heute**\n{todayTraining}\n\n**Zu tun**\n{todayTodos.map((t, i) => `${i + 1}. ${t}`).join('\\n')}\n\n{warningFlags.length ? `**⚠️ Hinweise**\\n${warningFlags.join('\\n')}` : ''}",
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Extrahiert die reine Adresse aus "Name <a@b.de>" und normalisiert sie. */
export function normalizeEmail(input: string | null | undefined): string {
  if (!input) return "";
  const match = input.match(/<([^>]+)>/);
  return (match ? match[1] : input).trim().toLowerCase();
}

export function emailDomain(input: string): string {
  const at = normalizeEmail(input).lastIndexOf("@");
  return at === -1 ? "" : normalizeEmail(input).slice(at + 1);
}

/** True für generische Absender wie noreply@ / no-reply@ / donotreply@. */
export function isNoReplyAddress(input: string): boolean {
  const local = normalizeEmail(input).split("@")[0] ?? "";
  return NOREPLY_LOCALPARTS.some((p) => local === p || local.startsWith(`${p}-`) || local.startsWith(`${p}.`));
}

/** Glob-Match mit `*` als Wildcard, case-insensitive. */
export function matchesPattern(email: string, pattern: string): boolean {
  const escaped = pattern
    .toLowerCase()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(normalizeEmail(email));
}

function haystack(...parts: (string | string[] | undefined)[]): string {
  return parts
    .flatMap((p) => (Array.isArray(p) ? p : [p ?? ""]))
    .join(" ")
    .toLowerCase();
}

function containsAny(text: string, needles: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * True, wenn der Absender per se kritisch ist (Jana — unabhängig vom Inhalt,
 * inkl. Quiet-Hours-Override).
 */
export function isCriticalSender(email: string): boolean {
  const addr = normalizeEmail(email);
  if ((CRITICAL_SENDERS as readonly string[]).includes(addr)) return true;
  const contact = CONTACTS_BY_EMAIL.get(addr);
  return contact?.priority === "critical" && contact.emails.some((e) => e.endsWith("@bmw.de") || e.includes("yahoo.de"));
}

/** True, wenn Absender/Betreff unter die Ignore-Regeln fallen. */
export function shouldIgnoreEmail(sender: string, subject = ""): boolean {
  const addr = normalizeEmail(sender);
  if (!addr) return false;

  // Bekannte Kontakte werden nie ignoriert.
  if (CONTACTS_BY_EMAIL.has(addr)) return false;

  if (IGNORE_SENDER_PATTERNS.some((p) => matchesPattern(addr, p))) return true;

  // Marketing-Absender auf Deadline-Domains ohne Deadline-Keyword.
  if (
    (DEADLINE_DOMAINS as readonly string[]).includes(emailDomain(addr)) &&
    isNoReplyAddress(addr) &&
    !containsAny(subject, DEADLINE_KEYWORDS)
  ) {
    return true;
  }

  // Erfolgreiche Deploys sind kein Ereignis.
  if (
    (CRITICAL_SYSTEM_SENDERS as readonly string[]).includes(addr) &&
    !containsAny(subject, CRITICAL_SYSTEM_SUBJECT_KEYWORDS)
  ) {
    return true;
  }

  return false;
}

/**
 * Bestimmt die Priorität einer eingehenden Mail.
 *
 * @param senderEmail Absenderadresse (roh oder "Name <addr>")
 * @param subject     Betreffzeile
 * @param keywords    Zusätzliche Signale (Body-Keywords, Labels, Kategorien)
 */
export function getPriorityLevel(
  senderEmail: string,
  subject = "",
  keywords: string[] = [],
): Priority {
  const addr = normalizeEmail(senderEmail);
  const domain = emailDomain(addr);
  const text = haystack(subject, keywords);

  // 1. CRITICAL -------------------------------------------------------------
  if (isCriticalSender(addr)) return "critical";

  if (
    (CRITICAL_SYSTEM_SENDERS as readonly string[]).includes(addr) &&
    containsAny(text, CRITICAL_SYSTEM_SUBJECT_KEYWORDS)
  ) {
    return "critical";
  }

  if (
    (DEADLINE_DOMAINS as readonly string[]).includes(domain) &&
    containsAny(text, DEADLINE_KEYWORDS)
  ) {
    return "critical";
  }

  if (containsAny(text, SECURITY_KEYWORDS)) return "critical";
  if (containsAny(text, HEALTH_CRITICAL_KEYWORDS)) return "critical";

  // 2. IGNORE (vor high/medium, damit Newsletter nicht über Keywords hochstufen)
  if (shouldIgnoreEmail(addr, subject)) return "ignore";
  if (keywords.some((k) => (IGNORE_CATEGORIES as readonly string[]).includes(k.toLowerCase()))) {
    return "ignore";
  }

  // 3. HIGH -----------------------------------------------------------------
  if ((HIGH_SENDERS as readonly string[]).includes(addr)) return "high";
  const contact = CONTACTS_BY_EMAIL.get(addr);
  if (contact?.priority === "high") return "high";
  if ((DEADLINE_DOMAINS as readonly string[]).includes(domain) && !isNoReplyAddress(addr)) {
    return "high";
  }
  if (containsAny(text, HIGH_TOPIC_KEYWORDS)) return "high";
  if (HIGH_TRAINING_MILESTONES.some((m) => text.includes(m.toLowerCase()))) return "high";
  if (containsAny(text, HIGH_PROJECT_KEYWORDS)) return "high";

  // 4. MEDIUM ---------------------------------------------------------------
  if (contact?.priority === "medium") return "medium";
  if (
    (MEDIUM_CONDITIONAL_SENDERS as readonly string[]).includes(addr) &&
    containsAny(text, ["wantlist"])
  ) {
    return "medium";
  }
  if (containsAny(text, MEDIUM_TOPIC_KEYWORDS)) return "medium";

  return "ignore";
}

/** Antwortfrist in Minuten. `critical` = 0 (sofort), `ignore` = Infinity. */
export function getResponseDeadline(priority: Priority): number {
  return RESPONSE_DEADLINE_MINUTES[priority];
}

/** Benachrichtigungskanal zur Priorität ("immediately" | "next_brief" | ...). */
export function getNotifyChannel(priority: Priority): string {
  return NOTIFY_CHANNEL[priority];
}

/** True, wenn die Priorität Quiet Hours / Dead Zones überschreiben darf. */
export function overridesQuietHours(priority: Priority): boolean {
  return priority === "critical";
}

/**
 * Formatiert Daten nach Toms Output-Templates.
 * Platzhalter `{key}` werden aus `data` ersetzt; unbekannte Platzhalter bleiben
 * stehen, damit fehlende Felder sichtbar sind statt still zu verschwinden.
 */
export function formatOutputByContext(
  type: OutputContext,
  data: Record<string, unknown>,
): string {
  const template = OUTPUT_TEMPLATES[type];
  if (!template) throw new Error(`Unbekannter Output-Kontext: ${type}`);
  return template.replace(/\{([^{}]+)\}/g, (whole, key: string) => {
    const value = data[key.trim()];
    return value === undefined || value === null ? whole : String(value);
  });
}

// ---------------------------------------------------------------------------
// Zeitfenster-Helfer
// ---------------------------------------------------------------------------

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function dayMatches(spec: string, dayKey: string): boolean {
  if (spec === "mon-fri") return ["mon", "tue", "wed", "thu", "fri"].includes(dayKey);
  if (spec === "sat-sun") return ["sat", "sun"].includes(dayKey);
  return spec.split(/[,\s]+/).includes(dayKey);
}

/** True, wenn Tom zum Zeitpunkt erfahrungsgemäß erreichbar ist. */
export function isResponsiveAt(date: Date = new Date()): boolean {
  const dayKey = DAY_KEYS[date.getDay()];
  const mins = date.getHours() * 60 + date.getMinutes();
  const inDeadZone = DEAD_ZONES.some(
    (z) => dayMatches(z.days, dayKey) && mins >= toMinutes(z.from) && mins < toMinutes(z.to),
  );
  if (inDeadZone) return false;
  return RESPONSIVE_WINDOWS.some(
    (w) => dayMatches(w.days, dayKey) && mins >= toMinutes(w.from) && mins < toMinutes(w.to),
  );
}

/** Geschützter Trainingsblock zu diesem Zeitpunkt, sonst null. */
export function getProtectedBlockAt(date: Date = new Date()): ProtectedBlock | null {
  const dayKey = DAY_KEYS[date.getDay()];
  const mins = date.getHours() * 60 + date.getMinutes();
  return (
    PROTECTED_BLOCKS.find(
      (b) => b.days.includes(dayKey) && mins >= toMinutes(b.from) && mins < toMinutes(b.to),
    ) ?? null
  );
}

/** True, wenn der Absender als vertraulich gilt (kein Learning-System, keine Dritt-Provider). */
export function isConfidentialSource(email: string): boolean {
  const addr = normalizeEmail(email);
  if (CONTACTS_BY_EMAIL.get(addr)?.confidential) return true;
  return PRIVACY.confidentialSources.some((p) => matchesPattern(addr, p));
}

// ---------------------------------------------------------------------------
// Conversation Starter — beim Start einer neuen Session
// ---------------------------------------------------------------------------

/**
 * Generiert eine Conversation Starter: Zusammenfassung + TO-DO.
 *
 * Wird aufgerufen, wenn Tom eine neue Konversation startet.
 * Zeigt: (1) Status-Zusammenfassung, (2) Heute's Training, (3) Konkrete TO-DOs
 *
 * Beispiel-Output:
 *
 * **Status-Zusammenfassung**
 * - Jarvis: Learning-System (retrieve/inject) läuft, Browser-Telegram Sync offen
 * - Training: W3/6, Marathon-Prep. TEST 2 in 14 Tagen.
 * - Inbox: 2 Jana-Threads offen (4d, 11d), bereinigt 85%.
 * - Critical: keine aktuellen
 *
 * **Heute**
 * 🏃 W3: 8 km easy (6:10–6:35, HR ≤145) — Hoka Challenger 8
 *
 * **Zu tun**
 * 1. Jana: "China Quentin" — Angebot beantworten (offen 4d)
 * 2. Jana: "Fragebogen Reiter 2" — Entwurf + Freigabe (offen 11d)
 * 3. Render: Env Vars checken (SUPABASE_URL, GROQ_API_KEY)
 * 4. Trainings-Feedback: Sonntagslauf, wenn gemacht
 */
export async function generateConversationStarter(
  params?: {
    todayDate?: Date;
    openJanaThreads?: Array<{ subject: string; daysSinceCreated: number }>;
    currentJarvisStatus?: string;
    trainingPhase?: string;
    achillesStatus?: string;
  }
): Promise<ConversationStarter> {
  const today = params?.todayDate ?? new Date();
  const dayKey = DAY_KEYS[today.getDay()];

  // Zusammenfassung: Status-Überblick
  const summary = [
    "**Status**",
    "- Jarvis: Learning-System läuft, Browser-Telegram Sync offen",
    `- Training: ${params?.trainingPhase ?? "Marathon-Prep (W3/6)"}, TEST 2 in 14d`,
    params?.openJanaThreads?.length
      ? `- Inbox: ${params.openJanaThreads.length} Jana-Threads offen (${params.openJanaThreads
          .map((t) => `${t.subject.slice(0, 20)}... ${t.daysSinceCreated}d`)
          .join(", ")})`
      : "- Inbox: sauber",
    "- Critical: keine aktuellen",
  ].join("\n");

  // Heute's Training (mock; in echter Impl. aus COROS/Calendar)
  const todayTraining = getTodayTraining(dayKey);

  // TO-DO: Jana-Threads, dann Jarvis, dann Training
  const todayTodos: string[] = [];

  // Jana-Threads (offene Antworten)
  if (params?.openJanaThreads?.length) {
    params.openJanaThreads.forEach((thread, idx) => {
      todayTodos.push(`${idx + 1}. Jana: "${thread.subject}" (offen ${thread.daysSinceCreated}d) — beantworten`);
    });
  }

  // Jarvis-Items
  if (params?.currentJarvisStatus?.includes("offen")) {
    todayTodos.push(`${todayTodos.length + 1}. Render: Env Vars checken (SUPABASE_URL, GROQ_API_KEY)`);
  }

  // Trainings-Feedback (wenn Lauf geplant)
  if (todayTraining.includes("🏃")) {
    todayTodos.push(`${todayTodos.length + 1}. Nach dem Lauf: A | RPE | Magen | Schuh | rund?`);
  }

  // Warning Flags
  const warningFlags: string[] = [];
  if (params?.achillesStatus === "elevated") {
    warningFlags.push("⚠️ Achillessehne erhöht — strenge Abbruchregel beachten");
  }
  if (params?.openJanaThreads?.some((t) => t.daysSinceCreated > 7)) {
    warningFlags.push("⚠️ Jana-Thread überfällig (Erwartet: <1h Turnaround)");
  }

  return {
    summary,
    todayTraining,
    todayTodos,
    warningFlags,
  };
}

/** Hilfsfunktion: Heute's Trainingsplan auslesen (Mockup; später COROS/Calendar). */
function getTodayTraining(dayKey: string): string {
  const trainingByDay: Record<string, string> = {
    mon: "💪 Kraft: Calf/Achilles HSR (18:00–18:25) — 3 Sätze, kein neues Gewicht",
    tue: "🏃 W3: 8 km easy (18:00–19:05) — Pace 6:10–6:35, HR ≤145, Schuh Hoka Challenger 8",
    wed: "💪 Kraft: Calf/Achilles HSR (18:00–18:25)",
    thu: "🏃 W3: 5 km Tempo (18:00–18:45) — Pace 5:50–5:55, HR ≤150, kurze Sätze",
    fri: "🏃 Recovery — optional, 3–5 km ultra-easy (HR ≤145)",
    sat: "🏃 Long Run: 12 km (08:30–11:50) — Pace 6:05–6:15, HR ≤150",
    sun: "🏃 Recovery: 4 km easy (09:00–09:45) — HR ≤145, or Rest",
  };
  return trainingByDay[dayKey] || "📅 Trainingsplan abrufen…";
}

// ---------------------------------------------------------------------------
// Aggregierter Default-Export
// ---------------------------------------------------------------------------

export const TOM_PROFILE = {
  version: RULES_VERSION,
  generated: RULES_GENERATED,
  owner: OWNER,
  tone: TONE,
  categoryIcons: CATEGORY_ICONS,
  contacts: CONTACTS,
  availability: {
    responsiveWindows: RESPONSIVE_WINDOWS,
    deadZones: DEAD_ZONES,
    protectedBlocks: PROTECTED_BLOCKS,
    briefTimes: BRIEF_TIMES,
  },
  calendars: CALENDARS,
  training: {
    goalRace: GOAL_RACE,
    physiology: PHYSIOLOGY,
    achillesProtocol: ACHILLES_PROTOCOL,
    gear: GEAR,
    feedbackFormat: FEEDBACK_FORMAT,
    milestones: MILESTONES,
  },
  interestGroups: INTEREST_GROUPS,
  behaviorRules: BEHAVIOR_RULES,
  privacy: PRIVACY,
  outputTemplates: OUTPUT_TEMPLATES,
} as const;

export default TOM_PROFILE;
