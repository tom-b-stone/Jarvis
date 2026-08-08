# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Single user: Tom, owner and sole operator. No multi-tenant, no other accounts — access is gated by a one-address allowlist (`ALLOWED_EMAIL`). He runs marathon training (goal race 2026-10-11), works in motorsport digital (Audi F1 Team, embargo-sensitive), and does ad-hoc AI-consulting work for his wife Jana's BMW role. He drives the product from a phone in short bursts (commute, evenings) and from a desk in longer sessions.

## Product Purpose

Jarvis is Tom's personal Chief of Staff, not a chatbot: a single always-on assistant surface over his Gmail, Calendar, Tasks, Google Drive, and COROS training data, with a persistent memory system that learns durable facts across conversations. Success is measured by whether it reduces what he has to hold in his head and surfaces the right next action, not by conversational polish.

## Positioning

Unlike a general chat assistant, Jarvis's replies and dashboard are filtered through a codified priority ruleset derived from a year of Tom's actual email/calendar behavior (`RULES.md`, `src/config/tom-profile.ts`) — critical/high/medium/ignore tiers with concrete rules, not generic importance heuristics. It also runs as a marathon coach with real physiological targets and an Achilles injury protocol, and degrades gracefully across five LLM backends (Claude, Gemini, Groq, OpenAI, Ollama) so it never goes fully dark.

## Operating Context

- Primary surface: a mobile-width-first web app (chat + dashboard), used standing up, between meetings, or mid-run-planning.
- Secondary surface: a separate `/dashboard.html` curation view for approving/deleting auto-extracted memory facts.
- Real external systems in play: Gmail, Google Calendar, Google Tasks, Google Drive, COROS (via its official OAuth MCP server), Supabase/pgvector (memory).
- Frequency: multiple short check-ins per day, not one long session.

## Capabilities and Constraints

- Reading email/calendar/tasks needs no confirmation; sending email, creating calendar invites, or deleting anything always requires an explicit shown draft/action and Tom's confirmation first.
- Confidential sources (wife's BMW mail, pre-embargo Audi F1 content) must never be sent to third-party LLM providers or written into the learning system.
- The dashboard's "needs attention" queue is priority-ordered and presented one item at a time (not a flat list) — Tom works through it in sequence rather than triaging a wall of items.
- Widget/dashboard interactions (dismiss, skip, thumbs up/down) are themselves learning signal, fed back into the memory system.
- No native app; must work as a responsive web view on a phone screen first.

## Brand Commitments

- Name: Jarvis. Existing icon motif: a glowing ring ("reactor"), currently cyan-on-near-black — open for reconsideration in this redesign, not a fixed constraint.
- Voice (fixed, not open for redesign): direct, dry, businesslike. No opening filler, no praise, no trailing "let me know if...". No humor, no exclamation marks. Emoji are used only as structural category prefixes (🏃 run, 💪 strength, 🧪 test, 🏁 race, ⚠️ warning), never as tone.

## Evidence on Hand

- Real, current priority/behavior rules: `RULES.md`, `src/config/tom-profile.ts`, `rules.json`.
- Real training data model: goal race, HR zones, Achilles protocol, weekly schedule (`src/config/tom-profile.ts`).
- No customer testimonials, pricing, or marketing claims apply — this is a private single-user tool, not a product with an audience to persuade.

## Product Principles

1. Operate, never persuade: Tom already uses this daily; every surface optimizes task completion and scanability, not conversion or delight-for-its-own-sake.
2. One thing at a time beats a wall of information: the priority queue pattern (highest priority first, act, then see the next) is a durable product principle, not just today's implementation.
3. The tool's judgment is worth showing its work: priority levels, training thresholds, and Achilles rules are concrete and numeric, and the UI should make that legibility a feature, not hide it behind vague icons.
4. Graceful degradation is a feature: COROS data, specific LLM backends, and learning storage are all optional-if-unconfigured; the UI must never assume they exist.
5. Interaction is data: every dismiss/click is feedback the system learns from — this should be visible in the design, not a hidden backend detail.

## Accessibility & Inclusion

No specific standard mandated by the user. Single sighted user, mixed German/English reading, frequently on a small phone screen in variable outdoor light (training-related use) — body text contrast and touch-target size matter more than screen-reader support for this specific product.
