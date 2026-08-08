---
name: Jarvis
description: Tom's personal Chief-of-Staff dashboard — priority-driven, not chatty
colors:
  bg: "#f7f5f1"
  surface: "#ffffff"
  ink: "#171614"
  ink-dim: "#7a766e"
  line: "#eae6df"
  accent: "#e8432e"
  accent-tint: "#fdeae7"
  high: "#c8790f"
  high-tint: "#fbf0dd"
  cal-hint: "#2f6feb"
  task-hint: "#6e56cf"
typography:
  display:
    fontFamily: "IBM Plex Mono, monospace"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "2px"
rounded:
  pill: "100px"
  card: "20px"
  chip: "12px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "18px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "11px 22px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "11px 22px"
  badge-mark:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "10px"
  priority-chip-critical:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
  priority-chip-high:
    backgroundColor: "{colors.high}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
---

## Overview

Jarvis reads as an operating dashboard for a Chief of Staff, not a chat toy. It replaced an earlier dark "AI reactor" HUD costume (cyan glow, monospace terminal look) that had drifted away from what the product actually is: a single-user priority-triage and marathon-coaching tool. The redesign is grounded in real reference dashboards the user supplied (bento-grid health/sales dashboards), fused with Jarvis's own product truth in `PRODUCT.md`.

Direction: warm off-white ground, ONE committed saturated accent (signal red) carrying priority and action — not decoration. The accent is not an arbitrary brand color: it is drawn directly from the product's own priority language (🔴 critical is already the top tier in `RULES.md`/`src/config/tom-profile.ts`), so the UI's boldest color literally means "this needs you now."

## Colors

Restrained-to-Committed strategy: neutral warm-white ground and near-black ink for the vast majority of the surface; the accent red is reserved for the priority queue card, primary buttons, the race-countdown number, and critical states — never scattered as generic brand decoration. Amber (`--high`) is the second priority tier, used only inside the attention queue and training warnings. Calendar/task hint colors exist for small future accents (dots/tags) but are not yet used at page scale.

## Typography

IBM Plex Sans carries all UI text — a workhorse Operate-mode face, not a "point of view" display face, per the product's task-first register. IBM Plex Mono is reserved for every number that matters: dates, countdowns, progress indicators (`1/1`), timestamps. This is an earned use of monospace (measurement/data), not a "technical" costume.

## Layout

Mobile-first single-column bento stack: one full-width priority card, then Coach and Learned cards below. No fixed multi-column grid is defined yet — the product is used almost entirely on a phone; a wider desktop layout would introduce a two-column row for the secondary widgets but has not been built.

## Elevation & Depth

Cards use a two-layer shadow (`0 1px 2px` contact shadow + `0 12px 28px -18px` ambient shadow), both with real offset and blur — never a zero-offset colored glow. A 1px `--line` border reinforces card edges on the near-white ground where shadow alone reads too soft.

## Shapes

20px radius on cards, 100px (full pill) on every button and tab, 10-12px on the badge mark and small chips. Nothing in the system uses a hard/sharp corner or a neobrutalist offset shadow.

## Components

- **Badge mark**: a 34px rounded-square, accent-red fill, white bold "J" in Plex Mono — replaces the old pulsing reactor ring. Pulses (opacity ring) only while Jarvis is actively thinking.
- **Priority chip**: pill, filled accent (critical) or amber (high), white uppercase label — the single loudest element on the page by design.
- **Widget card**: white surface, optional 92px photo banner (real Unsplash photography, verified direct links, used as evidence/atmosphere for Coach and Learned — never as a decorative backdrop behind body text), header label, body content.
- **Buttons**: solid black pill (primary action, e.g. "ERLEDIGT") or outline pill (secondary, e.g. "SPÄTER"). Chat send button is the one place the accent red fills a button.

## Do's and Don'ts

- Do reserve the accent red for things that are actually urgent or actionable — it loses meaning the moment it becomes decorative.
- Do put every meaningful number in Plex Mono; don't put prose in it.
- Don't reintroduce colored `border-left`/`border-right` accents on cards or chat bubbles — the old dark world used them (gold/cyan borders on `.msg`); this redesign replaced them with solid fills and full borders, and that's a deliberate rule, not an oversight.
- Don't add a second saturated accent color without a product reason as strong as the priority-color grounding that justified red.
