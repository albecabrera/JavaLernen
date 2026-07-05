# JavaLernen — Projektbrief für UI/UX-Design

## Kontext
Dieses Dokument ist die vollständige Grundlage, um in einem neuen Claude.ai-Chat das
Design (UI/UX, Farbpalette, Layouts, Komponenten) der Lern-App **JavaLernen** zu
entwickeln. Die technische Architektur ist bereits festgelegt (siehe unten) und wird
separat umgesetzt — hier geht es um das visuelle und interaktive Konzept.

## Vision
JavaLernen ist eine premium Lernplattform für Java-Programmierung, die chronologisch
vom absoluten Einstieg bis zu vertieftem Wissen führt — ausgerichtet am **aktuell
gültigen Kernlehrplan Informatik NRW (Gymnasiale Oberstufe, EF bis Q2)**. Zielgruppe:
Lernende ohne Vorkenntnisse, die sich strukturiert und selbstständig durcharbeiten.

## Curriculum-Gliederung (Basis: Kernlehrplan Informatik NRW, GK)

**Hinweis:** Die folgenden Inhaltsfelder sind laut Kernlehrplan bestätigt. Die exakte
Reihenfolge und Feinstruktur der einzelnen Unterrichtsvorhaben pro Halbjahr muss noch
mit dem schulinternen Lehrplan (ESG oder Referenz-Gymnasium) abgeglichen werden — das
wurde hier nicht erfunden, sondern bewusst offengelassen.

- **EF (Einführungsphase):** Einführung in objektorientierte Modellierung und
  Programmierung an einfachen Kontexten. Kein Vorwissen vorausgesetzt.
- **Q1:** Datenstrukturen (Arrays, Listen, Binärbäume), Algorithmen zum Suchen und
  Sortieren, Grundlagen technischer Informatik (Kodierung, Modellrechner).
- **Q2:** Vertiefung Datenstrukturen/Rekursion, relationale Datenbanken und SQL.
- Querschnittsthema: gesellschaftliche Auswirkungen / Datenschutz (in der Regel am
  Ende der EF behandelt).

Jede Einheit endet mit einem Kapitel-Projekt (praktische Anwendung des Gelernten).

## Kernfunktionen

1. **Chronologische Lernpfade** — Themen werden in fester Reihenfolge freigeschaltet,
   analog zum Kernlehrplan-Aufbau.
2. **Erklärungen + viele Übungen** pro Kapitel, gestufter Schwierigkeitsgrad.
3. **Abschlussprojekt** am Ende jeder Einheit.
4. **Java-Ausführung im Browser** (via CheerpJ/WASM), inkl. Compiler-Feedback.
5. **Feedback-System**: sofortiges Feedback zu Übungen, Fehleranalyse in
   verständlicher Sprache.
6. **Motivations-/Gamification-System**: Fortschrittsanzeige, Streaks, Badges,
   kleine Erfolgs-Animationen.
7. **Offline-fähig**: gesamte App inkl. Java-Ausführung funktioniert ohne
   Internetverbindung (PWA).
8. **Gemischte Inhaltserstellung**: feste kuratierte Basis-Einheiten + zusätzlich
   generierte Übungen (Claude API) zur Vertiefung.

## Technische Architektur (bereits festgelegt — nicht neu entwerfen)

```
Frontend (PWA, Vanilla JS)
├── Service Worker → cached Assets, Lektionen, Übungen
├── IndexedDB → Offline-Inhalte + lokaler Fortschritt
├── CheerpJ (WASM) → kompiliert/führt Java im Browser aus, ohne Server
└── Sync-Layer → gleicht mit Backend ab, sobald online

Backend (PHP + SQLite, eigener Server)
├── REST-API → Auth, Fortschritt, Sync
├── Admin-Panel → Pflege der festen Curriculum-Einheiten
├── Übungsgenerator → ruft Claude API, speichert Ergebnisse in SQLite
└── Export-Endpoint → verpackt Inhalte für Offline-Download
```

**Offener Punkt:** CheerpJ-Lizenzierung für produktiven Einsatz außerhalb reiner
Applet-Nutzung ist noch zu klären (siehe cheerpj.com/licensing) — kein gesicherter
Fakt, muss vor Launch verifiziert werden.

## Design-Anforderungen

- **Anspruch:** premium, modern, seriös — keine verspielte "Kinder-Lern-App"-Optik,
  eher Richtung Linear/Notion/Arc Browser: klar, ruhig, hochwertig.
- **Farbpalette:** dunkler Grundton bevorzugt (Fokus fürs Programmieren), mit einer
  präzisen Akzentfarbe für Fortschritt/Erfolg. Kein Standard-Bootstrap-Look.
- **Typografie:** klare Sans-Serif für UI, Monospace für Code-Blöcke.
- **Interaktion:** dezente Animationen bei Fortschritt/Erfolg (kein Konfetti-Overkill),
  Code-Editor mit Syntax-Highlighting, klarer Diff zwischen erwartetem und
  tatsächlichem Output bei Übungen.
- **Zielkomponenten für den Design-Chat:**
  - Dashboard / Lernpfad-Übersicht (Kapitel-Fortschritt visualisiert)
  - Lektions-Ansicht (Theorie + Code-Beispiele)
  - Übungs-Ansicht (Code-Editor + Ausführen-Button + Feedback-Panel)
  - Kapitel-Abschluss / Projekt-Ansicht
  - Fortschritts-/Gamification-Widget (Streak, Badges, XP)
  - Offline-Status-Indikator

## Auftrag an den Design-Chat

Entwirf auf Basis dieses Briefs: Farbpalette (mit Hex-Codes), Typografie-System,
und High-Fidelity-Mockups (als HTML/React-Artefakte) für die oben genannten
Zielkomponenten. Technische Umsetzbarkeit mit Vanilla JS ist Pflicht — keine
Design-Elemente vorschlagen, die sich nicht mit Vanilla JS/CSS umsetzen lassen.
