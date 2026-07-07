# JavaLernen

Premium-Lernplattform für Java-Programmierung, ausgerichtet am **Kernlehrplan
Informatik NRW** (Gymnasiale Oberstufe, EF–Q2). Vanilla JS/CSS/PHP — kein
Framework, kein Build-Schritt. Schüler schreiben echten Java-Code im Browser,
der auf dem Server **echt kompiliert und ausgeführt** wird (kein Simulator).

Dieses Repository enthält zwei Dinge:

| Ordner | Inhalt |
|---|---|
| `app/` | **Die eigentliche App** — lauffähig, produktionsnah dokumentiert. |
| `Java Learning Design Brief/` | Ursprüngliches Design-Mockup (`.dc.html`, Design-Compiler-Prototyp) + Brief. Nur Referenz für Farben/Typografie/Layout — kein Produktionscode. Siehe eigenes `README.md` dort. |

---

## 1. Schnellstart

Voraussetzungen: PHP ≥ 8.0. Für Java-Übungen zusätzlich `javac`/`java` im
`PATH` (JDK ≥ 17 empfohlen), für Python-Übungen `python3`.

**Empfohlen — Start-Skript** (prüft Voraussetzungen, gibt einen belegten Port
frei und öffnet den Browser automatisch):

```bash
./start.sh          # Port 8100
./start.sh 9000     # eigener Port
```

**Oder manuell:**

```bash
cd app
php -S 127.0.0.1:8100
```

Dann `http://127.0.0.1:8100` öffnen. Kein `npm install`, kein Build — die
`index.html` lädt `css/*.css` und `js/app.js` direkt, PHP-Built-in-Server
reicht für Entwicklung und Kompilieren.

---

## 2. Architektur

```
app/
├── index.html          Eine Seite, vier Views (Dashboard/Übersicht/Lektion/Übung/Projekt)
│                        per data-view Tabs umgeschaltet, kein Router/Framework
├── css/
│   ├── tokens.css       Design-Tokens (Farben, Radien, Schrift) — WCAG-AA-auditiert
│   └── app.css          Komponenten, Responsive (@media), :focus-visible, a11y
├── js/
│   └── app.js           Eine IIFE: Router (Hash), Sidebar/Dashboard/Übersicht-Rendering,
│                         Editor mit Syntax-Highlighting, Fetch zum Compiler-Backend
├── content/
│   └── content.json     GESAMTER Lerninhalt (Kapitel/Lektionen/Übungen/Module) — Daten,
│                         kein Code. Neue Inhalte = JSON bearbeiten, kein JS anfassen.
└── backend/
    ├── run.php          POST {source} → kompiliert (javac) + führt aus (java), JSON zurück
    ├── sandbox.sh        Wrapper: bwrap/firejail/nsjail falls verfügbar, sonst rlimits-only
    └── DEPLOY.md         Pflichtlektüre vor Produktivbetrieb — Sandbox-Härtung
```

**Kein Build-Schritt, bewusst.** Alles ist direkt ausführbares HTML/CSS/JS.
Das hält die Angriffsfläche klein und macht die App an jedem PHP-Hoster
lauffähig, ohne Node/Webpack/Vite in der Deploy-Pipeline.

### 2.1 Frontend

- **Editor**: `<textarea>` transparent über einem `<pre>` mit eigenem
  Regex-Tokenizer (`highlight()` in `app.js`) — kein CodeMirror/Monaco, keine
  Abhängigkeit. Zeilennummern und Scroll synchron per JS.
- **Data-driven**: Sidebar, Dashboard-Lernpfad, Lektionen, Übungen und die
  Übersicht-Module werden alle aus `content.json` gerendert. Kein Kapitel ist
  hartcodiert im HTML.
- **A11y**: `:focus-visible`, `role="tablist"`, `aria-current`/`aria-selected`,
  `disabled` auf gesperrten Kapiteln, Skip-Link, `prefers-reduced-motion`.
- **Responsive**: Sidebar wird ab `900px` zum Drawer (Hamburger-Menü, Scrim).

### 2.2 Backend — der Java-Compiler

`backend/run.php` ist **kein Fake**: Es schreibt den eingesandten Code in
eine temporäre `Main.java`, ruft echtes `javac` + `java` auf und gibt
stdout/stderr/Exit-Code als JSON zurück. Timeout (5 s) killt Endlosschleifen
zuverlässig; das Frontend zeigt Kompilierfehler, Laufzeitfehler und
Diff (erwartet/erhalten) mit pädagogischem Hinweistext.

**⚠️ Sicherheit — vor jedem Deploy `backend/DEPLOY.md` lesen.** Der Endpunkt
führt beliebigen Code aus (Remote Code Execution per Design). Lokale
Entwicklung ist ok; öffentlicher Betrieb **verlangt** OS-Sandboxing (Container
ohne Netzwerk, cgroup-Limits) — `sandbox.sh` erkennt `bwrap`/`firejail`/
`nsjail` automatisch, fällt aber ohne sie auf reine `ulimit`-Grenzen zurück,
was **nicht** produktionstauglich ist.

---

## 3. Lerninhalt — Struktur & Umfang

Aktueller Stand: **11 Kapitel · 30 Lektionen · 16 Übungen · 18 verlinkte Videos**.

| Phase | Kapitel |
|---|---|
| **EF** (Einführungsphase) | 0 Einführung in Java · 1 Klassen & Objekte · 2 Attribute & Methoden · 3 Kontrollstrukturen (5 Lektionen) · 4 Objektbeziehungen · 5 Vererbung · 6 Modellierung: UML & Entwurfsmuster · Kapitel-Projekt (Bankkonto) |
| **Q1** | Datenstrukturen & Algorithmen (Arrays, Suchen/Sortieren, Stacks/Queues, Bäume, Graphen) |
| **Q2** | Rekursion & SQL · Kryptographie, Netzwerke & Automaten |

Jede Lektion ist ein JSON-Objekt in `content/content.json` mit `blocks`
(Absätze, Code-Beispiele, Callouts, Info-Grids) und optional einem `video`
(YouTube-Verlinkung, siehe unten). Jede Übung hat `prompt_html`, `expected`
(exakter erwarteter stdout), `starter`-Code und einen `tip_html`.

**Wichtig — jede Übungslösung ist gegen den echten Compiler verifiziert**,
bevor sie committed wurde (nicht nur "sieht richtig aus"). Das hat bereits
einen echten Bug gefangen (ein `expected`-Wert, der die tatsächliche
Mehrfach-Ausgabe nicht berücksichtigte).

### 3.1 Neue Lektion/Übung hinzufügen

1. `content/content.json` öffnen, passendes Kapitel suchen.
2. Neues Objekt in `lessons[]` bzw. `exercises[]` einfügen (Schema oben).
3. Bei Übungen: die **Lösung selbst gegen den Server laufen lassen**, bevor
   `expected` festgeschrieben wird:
   ```bash
   curl -s -X POST http://127.0.0.1:8100/backend/run.php \
     -H 'Content-Type: application/json' \
     -d '{"source":"<dein Java-Code als JSON-String>"}'
   ```
4. Kein JS/HTML-Änderung nötig — Sidebar, Pills und Rendering sind
   vollständig datengetrieben.

### 3.2 Videos pro Lektion

Optionales Feld `"video": {"id","title","channel","duration"}` — `id` ist
die rohe YouTube-Video-ID (kein volle URL). Das Frontend baut daraus:

- Thumbnail: `https://img.youtube.com/vi/{id}/hqdefault.jpg` (statisches Bild,
  kein Embed/iframe, keine Drittanbieter-JS, kein Consent-Wall-Problem)
- Link: `https://youtu.be/{id}`, öffnet in neuem Tab (`target="_blank"`)

Aktuell 18 von 30 Lektionen verlinkt, kuratiert aus einer von Alberto
bereitgestellten Playlist (Kanal **Jonas Keil**, deutschsprachige
Java-Tutorials). Bewusst **keine erzwungenen Matches** — Lektionen ohne
passendes Video (z. B. Bäume/Graphen, SQL, Kryptographie) bleiben ohne
Video-Karte, statt ein unpassendes Video zu verlinken.

> Externe Links statt Hosting: kein Speicherplatz, keine
> Urheberrechtsfragen (die Videos gehören nicht zu diesem Projekt), passt
> zum bestehenden Muster (Java-Ausführung braucht ebenfalls eine
> Internetverbindung — Kernfunktionen bleiben offline-tauglich, Zusatzmaterial
> nicht zwingend).

### 3.3 Übersicht — Curriculum-Abgleich (Zertifikatskurs)

Der Tab **„Übersicht“** bildet zusätzlich das Curriculum eines
Java-Zertifikatskurses (Lehrer-Fortbildung, 6 Module) ab und zeigt live,
welche JavaLernen-Kapitel jedes Modul-Thema bereits abdecken
(`modules[].coverage` in `content.json`, verlinkt auf echte Kapitel-IDs).

| Modul | Status |
|---|---|
| 1 · Einführung in Java | teilweise (Didaktik-Themen bleiben strukturell offen — Lehrer-Methodik, kein Schüler-Lerninhalt) |
| 2 · Grundlagen der Programmierung | teilweise (fehlt: Schnittstellen/abstrakte Klassen) |
| 3 · Algorithmik | teilweise (fehlt: Laufzeitanalyse/Big-O explizit) |
| 4 · OOA & Modellierung | teilweise (fehlt: Didaktik-Umsetzung) |
| 5 · Datenstrukturen | **vollständig** |
| 6 · Weitere Themen | **vollständig** |

Diese Statuswerte sind **manuell gepflegt** (`modules[].status` in
`content.json`), nicht automatisch aus der Kapitelanzahl abgeleitet — eine
hohe Kapitelzahl bedeutet nicht automatisch vollständige Themenabdeckung.

---

## 4. Design-System

Farb-Tokens in `css/tokens.css`, **WCAG-AA-auditiert** (nicht nur übernommen
vom Mockup): drei Muted-Farbtöne (`--mut2`, `--faint`, `--dis`) wurden
korrigiert, weil sie im Original unter 4.5:1 Kontrast lagen. Rechenweg und
Werte siehe Kommentare direkt in `tokens.css`.

- **Akzentfarbe zweigeteilt**: `--accent` (`#34D399`, neongrün) für Aktionen/
  CTAs, `--accent2` (`#10B981`, gedeckter) für Fortschrittsbalken/Status —
  verhindert, dass alles gleichzeitig um Aufmerksamkeit konkurriert.
- **Schrift**: Geist (UI), JetBrains Mono (Code).
- Details zu Screens/Interaktionen des ursprünglichen Mockups:
  `Java Learning Design Brief/design_handoff_javalernen/README.md`.

---

## 5. Bekannte Lücken / nächste Schritte

- **Persistenz**: Fortschritt (abgeschlossene Kapitel, XP, Streak) ist aktuell
  reiner Frontend-Zustand — verschwindet beim Neuladen. SQLite-Anbindung im
  Backend ist der nächste sinnvolle Schritt (Architektur dafür bereits im
  ursprünglichen Design-Brief skizziert).
- **PWA/Offline**: Service Worker + Manifest für Offline-Zugriff auf
  Lektionstexte fehlen noch (Java-Ausführung bleibt online-only, siehe oben).
- **CheerpJ**: im ursprünglichen Brief als Java-Runtime-Option vorgesehen,
  bewusst **verworfen** — die Community-Lizenz erlaubt kein Self-Hosting/
  Offline-Betrieb, nur die kostenpflichtige Commercial-Lizenz. Serverseitiges
  `javac`/`java` (dieser Ansatz) hat kein Lizenzproblem und nutzt einen
  echten JDK statt einer Nachbildung.
- **Editor-Highlighting**: eigener Tokenizer deckt Java gut ab; SQL-Code-Blöcke
  (Lektion Q2) werden mit dem Java-Tokenizer angezeigt — keine SQL-spezifische
  Hervorhebung, rein kosmetisch, kein Funktionsproblem.

---

## 6. Sicherheitshinweis (Wiederholung, wichtig genug für zwei Stellen)

`backend/run.php` kompiliert und führt **beliebigen eingesandten Code aus**.
Für lokale Entwicklung/Demo unproblematisch. **Vor jedem öffentlichen Deploy
zwingend `backend/DEPLOY.md` lesen** und die dortige Sandbox-Checkliste
abarbeiten (dedizierter Nutzer ohne Rechte, `bwrap`/Container ohne Netzwerk,
`TasksMax`/`MemoryMax` per systemd). Der mitgelieferte Verifikationstest in
`DEPLOY.md` prüft, ob die Sandbox tatsächlich greift.
