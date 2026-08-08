#!/usr/bin/env bash
#
# INBOX_CLEANUP.sh — Massenbereinigung von marquardt.tom@gmail.com
#
# Quelle der Regeln: rules.json v1.0 / src/config/tom-profile.ts
# Ausgangslage 2026-08-08: 4.208 Threads, 223 ungelesen, ~85 % Ignore-Anteil.
#
# SAFE MODE: Der Standardmodus ist DRY RUN. Es wird nichts gelöscht, nur
# gezählt und angezeigt. Löschen heisst hier immer "in den Papierkorb"
# (30 Tage wiederherstellbar) — nie permanentes Löschen.
#
#   ./INBOX_CLEANUP.sh                 # Phase 1+2+3 Preview (nichts wird geändert)
#   ./INBOX_CLEANUP.sh --phase 1       # nur Phase 1 Preview
#   ./INBOX_CLEANUP.sh --queries       # nur die Gmail-Suchstrings ausgeben
#   ./INBOX_CLEANUP.sh --phase 1 --apply   # Phase 1 wirklich ausführen
#
# --apply fragt vor jedem Schritt einzeln nach Bestätigung
# (behaviorRules: no_send_without_confirmation).
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------

# CLI-Binary. Muss `email search|trash|label|filter` unterstuetzen.
# Falls noch nicht vorhanden: Preview-Modus benutzen und die ausgegebenen
# Gmail-Suchstrings direkt in der Gmail-Weboberflaeche verwenden.
JARVIS="${JARVIS_CLI:-jarvis}"

APPLY=0
PHASES="1 2 3"
QUERIES_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)   APPLY=1; shift ;;
    --phase)   PHASES="$2"; shift 2 ;;
    --queries) QUERIES_ONLY=1; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 1 ;;
  esac
done

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; RST=$'\033[0m'

have_cli() { command -v "$JARVIS" >/dev/null 2>&1; }

if [[ $APPLY -eq 1 ]] && ! have_cli; then
  echo "${RED}FEHLER${RST}: CLI '$JARVIS' nicht gefunden."
  echo "Setze JARVIS_CLI=<pfad> oder benutze den Preview-Modus (ohne --apply)"
  echo "und fuehre die ausgegebenen Gmail-Suchen manuell aus."
  exit 1
fi

# preview <label> <gmail-query>
preview() {
  local label="$1" query="$2" count="?"
  if have_cli; then
    count="$("$JARVIS" email search --query "$query" --count-only 2>/dev/null || echo '?')"
  fi
  printf '  %-42s %6s  %s%s%s\n' "$label" "$count" "$DIM" "$query" "$RST"
}

# confirm_and_run <beschreibung> <befehl...>
confirm_and_run() {
  local desc="$1"; shift
  echo
  echo "  ${YLW}==>${RST} $desc"
  echo "      ${DIM}$*${RST}"
  read -r -p "      Ausfuehren? [j/N] " answer
  # tr statt ${var,,} — macOS liefert bash 3.2
  answer="$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')"
  if [[ "$answer" == "j" || "$answer" == "ja" ]]; then
    "$@"
    echo "      ${GRN}erledigt${RST}"
  else
    echo "      ${DIM}uebersprungen${RST}"
  fi
}

section() { echo; echo "${BOLD}$1${RST}"; echo "${DIM}$2${RST}"; echo; }

# ---------------------------------------------------------------------------
# Absenderlisten (Spiegel von rules.json -> priority.ignore.senderPatterns)
# ---------------------------------------------------------------------------

# Phase 1a: Newsletter & Content — hohe Frequenz, null Handlungsbedarf
NEWSLETTER_SENDERS=(
  "noreply@medium.com"
  "dan@tldrnewsletter.com"
  "np@neilpatel.com"
  "newsletter@monocle.com"
  "newsletter@m.highsnobiety.com"
  "thecuriositydepartment@substack.com"
  "milliondollarauthor@mail.beehiiv.com"
  "mail@runnersworld.de"
  "newsletter@trampelpfadlauf.de"
  "no-reply@nebenan.de"
  "chelsea.c@ifttt.com"
  "newsletter@finnishdesignshop.com"
  "hello@stills.com"
  "support@aescripts.com"
  "hello@creativemarket.com"
)

# Phase 1b: Shops & Werbung
SHOP_SENDERS=(
  "luke@club.sportpursuit.com"
  "news@my.aboutyou-outlet.de"
  "neuigkeiten@aboutyou.com"
  "newsletter@news.def-shop.com"
  "info@mail.my.mediamarkt.de"
  "ikea@hej.news.email.ikea.de"
  "news@designuniverse.bolia.com"
  "customersupport@mobelaris.com"
  "email@news.salomon.com"
  "info@shokz.com"
  "info@ryzon.net"
  "shop@impericon.com"
  "no-reply@fitshop.email"
  "newsletter@angebote.aldi-sued.de"
  "newsletter@baumarkt.toom.de"
  "info@email.fotokasten.de"
  "info@email.myphotobook.de"
  "zealoptics@email.zealoptics.com"
  "velites@velitessport.com"
  "web@mosmosh.com"
  "webshop@thebarn.de"
  "news@mail.granit.com"
  "donotreply@hyte.com"
  "ufc@e.ufc.com"
  "news@email.inoui-editions.com"
  "newsletter@email.thecircle.de"
  "info@mailing.catawiki.com"
  "newsletter@news.outdooractive.com"
  "no-reply@airahome.com"
  "mail@update.strava.com"
  "gamescom@visitor.koelnmesse.de"
  "frida@von.kleinanzeigen.de"
)

# Phase 1c: Social & Jobs — Kategorie social/forums
SOCIAL_SENDERS=(
  "notification@facebookmail.com"
  "close_friend_updates@facebookmail.com"
  "friendsuggestion@facebookmail.com"
  "notifications-noreply@linkedin.com"
  "mailrobot@mail.xing.com"
  "news@mail.xing.com"
  "jobs@mail.xing.com"
  "jobupdates@info.kununu.com"
  "jobs@getbaito.com"
  "recommendations@explore.pinterest.com"
  "recommendations@discover.pinterest.com"
)

join_or() {
  local IFS="|"; local out=""
  for s in "$@"; do out+="${out:+ OR }from:$s"; done
  echo "$out"
}

Q_NEWSLETTER="in:inbox ($(join_or "${NEWSLETTER_SENDERS[@]}"))"
Q_SHOPS="in:inbox ($(join_or "${SHOP_SENDERS[@]}"))"
Q_SOCIAL="in:inbox ($(join_or "${SOCIAL_SENDERS[@]}"))"
Q_CATEGORIES="in:inbox (category:promotions OR category:social OR category:forums) -is:starred -has:userlabels"

# ---------------------------------------------------------------------------
# --queries: nur Suchstrings ausgeben
# ---------------------------------------------------------------------------

if [[ $QUERIES_ONLY -eq 1 ]]; then
  echo "$Q_NEWSLETTER"; echo; echo "$Q_SHOPS"; echo; echo "$Q_SOCIAL"; echo; echo "$Q_CATEGORIES"
  exit 0
fi

echo "${BOLD}Inbox-Cleanup — marquardt.tom@gmail.com${RST}"
if [[ $APPLY -eq 1 ]]; then
  echo "${RED}APPLY-MODUS${RST} — Aenderungen werden nach Einzelbestaetigung ausgefuehrt."
  echo "Loeschen = Papierkorb, 30 Tage wiederherstellbar."
else
  echo "${GRN}DRY RUN${RST} — es wird nichts geaendert. Mit --apply ausfuehren."
fi

# ===========================================================================
# PHASE 1 — Newsletter & Werbung loeschen
# ===========================================================================

if [[ " $PHASES " == *" 1 "* ]]; then
  section "Phase 1: Newsletter & Werbung (LOESCHEN)" \
    "Alle Absender stehen in rules.json -> priority.ignore.senderPatterns. Notify: never."

  echo "  ${BOLD}Cluster                                    Threads  Query${RST}"
  preview "1a Newsletter & Content (${#NEWSLETTER_SENDERS[@]} Absender)" "$Q_NEWSLETTER"
  preview "1b Shops & Werbung (${#SHOP_SENDERS[@]} Absender)"            "$Q_SHOPS"
  preview "1c Social & Jobs (${#SOCIAL_SENDERS[@]} Absender)"            "$Q_SOCIAL"
  preview "1d Gmail-Kategorien (Rest)"                                   "$Q_CATEGORIES"

  echo
  echo "  ${DIM}Beobachtet im 72-h-Fenster: sportpursuit 7, medium 4, aboutyou-outlet 4,${RST}"
  echo "  ${DIM}nebenan 4, tldr 3, strava 3, facebookmail 3 — zusammen ~28 Threads.${RST}"

  if [[ $APPLY -eq 1 ]]; then
    confirm_and_run "1a Newsletter & Content in den Papierkorb" \
      "$JARVIS" email trash --query "$Q_NEWSLETTER"
    confirm_and_run "1b Shops & Werbung in den Papierkorb" \
      "$JARVIS" email trash --query "$Q_SHOPS"
    confirm_and_run "1c Social & Jobs in den Papierkorb" \
      "$JARVIS" email trash --query "$Q_SOCIAL"
    confirm_and_run "1d Restliche Promotions/Social/Forums (ohne Stern, ohne eigene Labels)" \
      "$JARVIS" email trash --query "$Q_CATEGORIES"
  else
    echo
    echo "  ${DIM}Befehle im Apply-Modus:${RST}"
    for s in "${NEWSLETTER_SENDERS[@]:0:3}" ; do
      echo "  ${DIM}jarvis email trash --sender '$s'${RST}"
    done
    echo "  ${DIM}... ($(( ${#NEWSLETTER_SENDERS[@]} + ${#SHOP_SENDERS[@]} + ${#SOCIAL_SENDERS[@]} )) Absender gesamt)${RST}"
  fi
fi

# ===========================================================================
# PHASE 2 — Automatische Filter
# ===========================================================================

if [[ " $PHASES " == *" 2 "* ]]; then
  section "Phase 2: Automatische Filter (Gmail Labels + Regeln)" \
    "Damit Phase 1 nicht in vier Wochen wieder noetig ist."

  cat <<'PLAN'
  Labels:
    🤖 Auto-Archive    Newsletter, Shops, Social — landen nie in der Inbox
    🔴 Critical        Jana, audif1.com (Personen), Render/Vercel-Fehler, Security
    🟠 High            Reklamation, Lieferung, Rechnung, Vertrag, Frist
    🟡 Digest          Discogs-Wantlist, Marathon-Anmeldungen, Stack-News
    📦 Belege          Bestellbestaetigungen, Rechnungen

  Regeln:
    R1  Ignore-Absenderliste            -> Skip Inbox, Label 🤖 Auto-Archive, als gelesen markieren
    R2  category:promotions/social      -> Skip Inbox, Label 🤖 Auto-Archive
    R3  from:Jana.Marquardt@bmw.de      -> Label 🔴 Critical, Stern, nie Auto-Archive
    R4  from:*@audif1.com -from:noreply -> Label 🔴 Critical, Stern
    R5  from:no-reply@render.com subject:(failed OR error)    -> Label 🔴 Critical
    R6  from:no-reply@render.com -subject:(failed OR error)   -> Skip Inbox, archivieren
        (rules.json: "Erfolgreiche Deploys nicht melden")
    R7  from:notifications@vercel.com subject:(failed OR error OR sign-in) -> Label 🔴 Critical
    R8  subject:(reklamation OR lieferung OR erstattung OR rechnung OR
        vertrag OR frist OR kuendigung)                       -> Label 🟠 High
    R9  from:noreply@discogs.com subject:Wantlist             -> Skip Inbox, Label 🟡 Digest
    R10 Bestellbestaetigungen/Versand                          -> Label 📦 Belege, Skip Inbox

  Aufraeum-Automatik:
    A1  label:🤖 Auto-Archive older_than:7d is:unread  -> Papierkorb
    A2  label:📦 Belege older_than:90d                 -> Archiv
    A3  label:🟡 Digest older_than:30d                 -> Papierkorb
PLAN

  if [[ $APPLY -eq 1 ]]; then
    for lbl in "🤖 Auto-Archive" "🔴 Critical" "🟠 High" "🟡 Digest" "📦 Belege"; do
      confirm_and_run "Label anlegen: $lbl" "$JARVIS" email label create --name "$lbl"
    done
    confirm_and_run "R1: Ignore-Absender automatisch archivieren" \
      "$JARVIS" email filter create --query "$Q_NEWSLETTER $Q_SHOPS $Q_SOCIAL" \
      --skip-inbox --mark-read --label "🤖 Auto-Archive"
    confirm_and_run "R3: Jana immer kritisch" \
      "$JARVIS" email filter create --from "Jana.Marquardt@bmw.de" --label "🔴 Critical" --star --never-spam
    confirm_and_run "R6: Erfolgreiche Deploys automatisch archivieren" \
      "$JARVIS" email filter create --query "from:no-reply@render.com -subject:(failed OR error)" --skip-inbox
    confirm_and_run "R9: Discogs-Wantlist in den Digest" \
      "$JARVIS" email filter create --query "from:noreply@discogs.com subject:Wantlist" \
      --skip-inbox --label "🟡 Digest"
  fi
fi

# ===========================================================================
# PHASE 3 — Smart-Archiv
# ===========================================================================

if [[ " $PHASES " == *" 3 "* ]]; then
  section "Phase 3: Smart-Archiv (nicht loeschen, nur aus der Inbox)" \
    "Erledigte Vorgaenge, die als Beleg relevant bleiben."

  Q_ARCH_KLAER="in:inbox older_than:30d (reklamation OR erstattung OR ruecksendung) -is:starred"
  Q_ARCH_VERSAND="in:inbox older_than:30d (subject:versand OR subject:lieferung OR subject:bestellung OR subject:sendungsverfolgung)"
  Q_ARCH_AUDI="in:inbox from:*@audif1.com older_than:30d"
  Q_ARCH_SECURITY="in:inbox older_than:14d (subject:'verification code' OR subject:'sign-in' OR from:noreply-accounts@google.com)"
  Q_ARCH_DEPLOY="in:inbox from:(no-reply@render.com OR notifications@vercel.com) older_than:7d"

  echo "  ${BOLD}Cluster                                    Threads  Query${RST}"
  preview "3a Geloeste Reklamationen (>30 T)"   "$Q_ARCH_KLAER"
  preview "3b Alte Versandbestaetigungen"       "$Q_ARCH_VERSAND"
  preview "3c Audi-F1 nach Embargo (>30 T)"     "$Q_ARCH_AUDI"
  preview "3d Erledigte Security-Meldungen"     "$Q_ARCH_SECURITY"
  preview "3e Abgeschlossene Deploy-Incidents"  "$Q_ARCH_DEPLOY"

  echo
  echo "  ${YLW}Nicht anfassen:${RST} offene Jana-Threads 'China Quentin' (04.08.)"
  echo "  und 'Fragebogen Reiter 2' (28.07.) — beide unbeantwortet."

  if [[ $APPLY -eq 1 ]]; then
    confirm_and_run "3a Geloeste Reklamationen archivieren" "$JARVIS" email archive --query "$Q_ARCH_KLAER"
    confirm_and_run "3b Alte Versandbestaetigungen archivieren" "$JARVIS" email archive --query "$Q_ARCH_VERSAND" --label "📦 Belege"
    confirm_and_run "3c Audi-F1 nach Embargo archivieren" "$JARVIS" email archive --query "$Q_ARCH_AUDI"
    confirm_and_run "3d Security-Meldungen archivieren" "$JARVIS" email archive --query "$Q_ARCH_SECURITY"
    confirm_and_run "3e Deploy-Incidents archivieren" "$JARVIS" email archive --query "$Q_ARCH_DEPLOY"
  fi
fi

echo
if [[ $APPLY -eq 0 ]]; then
  echo "${GRN}Preview beendet — nichts geaendert.${RST}"
  echo "Naechster Schritt: ${BOLD}./INBOX_CLEANUP.sh --phase 1 --apply${RST}"
  echo "Ohne CLI: ${BOLD}./INBOX_CLEANUP.sh --queries${RST} und die Suchstrings in Gmail einfuegen."
else
  echo "${GRN}Fertig.${RST} Papierkorb pruefen, bevor Gmail nach 30 Tagen endgueltig loescht."
fi
