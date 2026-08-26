# Schätzduell auf Windows fertigstellen — Startpaket für Claude Code

## 1. Vorbereiten (einmalig, ca. 45 Min)

**Ordner anlegen**, z. B. `C:\projekte\schaetzduell\`, und diese drei Dateien reinlegen:

```
schaetzduell.html
appicon.svg
FONTS.md
```

**Das brauchst du installiert:**

| Was | Wozu | Woher |
|---|---|---|
| Git for Windows | Claude Code nutzt intern Git Bash | git-scm.com, "Add Git to PATH" angehakt lassen |
| Node.js LTS | Capacitor läuft über npm | nodejs.org |
| Android Studio | SDK, JDK, Emulator, Signierung | developer.android.com/studio |
| Claude Code | der Agent | siehe unten |

**Claude Code installieren** — PowerShell öffnen, dann:

```powershell
irm https://claude.ai/install.ps1 | iex
```

Danach Terminal schließen, neu öffnen, `claude --version` prüfen. Falls
"nicht erkannt": PATH ist noch stale, neues Fenster reicht meist. Sonst
hilft `claude doctor`. Du brauchst ein bezahltes Claude-Abo oder einen
API-Key, der kostenlose Plan schaltet Claude Code nicht frei.

**Starten:** in den Projektordner wechseln (`cd C:\projekte\schaetzduell`)
und `claude` eingeben.

---

## 2. Der Startprompt

Alles ab hier in Claude Code reinkopieren:

---

Ich baue aus einer fertigen HTML-Datei eine native Android-App und will sie
im Google Play Store veröffentlichen. Ich bin auf Windows. Arbeite in Phasen
und zeig mir nach jeder Phase, was du geändert hast, bevor du weitermachst.

**Ausgangslage:** `schaetzduell.html` ist ein vollständiges Schätzspiel in
einer einzigen Datei, ohne Build-Schritt, ohne Framework. Es hat einen
Duell-Modus für 2–8 Spieler am selben Gerät und einen Solo-Übungsmodus,
375 Fragen in 5 Kategorien, und eine gekapselte Speicherschicht, die
`window.storage` bevorzugt und auf `localStorage` zurückfällt.
`appicon.svg` ist das App-Icon in 1024×1024. `FONTS.md` beschreibt, welche
Schriftdateien fehlen.

**Phase 1 — Schriften.**
Lies `FONTS.md`. Lade Archivo, Archivo Black und DM Mono als .woff2 herunter,
leg sie unter `fonts/` ab, benenne sie so, wie die `@font-face`-Regeln in
`schaetzduell.html` es erwarten. Leg die OFL-Lizenztexte mit ins Projekt.
Prüfe danach im Browser mit deaktiviertem Netzwerk, dass die Schriften
wirklich lokal laden.

**Phase 2 — Capacitor-Projekt.**
Setz ein Capacitor-Projekt auf, App-ID `de.schaetzduell.app`, Name
"Schätzduell". `schaetzduell.html` wird als `index.html` zum Web-Asset,
zusammen mit `fonts/`. Generiere aus `appicon.svg` alle Android-Icon-Größen
inklusive adaptive icon und einen Splash-Screen im gleichen Petrol-Ton
(#0D2B2F). Bau einen Debug-APK und sag mir, wie ich ihn auf mein Handy
bekomme.

**Phase 3 — App-Verhalten.**
- Haptisches Feedback beim Auflösen einer Frage, stärker bei einem Volltreffer
- Zurück-Taste des Handys sinnvoll belegen statt App schließen
- Bildschirm während einer laufenden Runde nicht schlafen legen
- Statusleiste passend zum Hintergrund einfärben
- Der gespeicherte Spielstand bekommt ein Feld `v:1`. Beim Laden wird die
  Version geprüft; passt sie nicht zur aktuellen, wird der Stand verworfen
  statt auf verschobene Fragen-Indizes zu zeigen. Das ist wichtig, weil
  später Kategorien nachkommen.

**Phase 4 — Fragen prüfen.**
Im Array `Q` stehen 375 Fragen als `[Kategorie, Frage, Antwort, Einheit]`.
Die Zahlen sind recherchierte Näherungswerte, aber nicht quellengeprüft.
Geh sie in Blöcken von 25 durch, prüf jede Zahl per Websuche, und leg mir
eine Liste vor mit: Frage, alter Wert, gefundener Wert, Quelle. Ändere
nichts ohne meine Freigabe. Fragen, deren Antwort sich schnell ändert
(Preise, Nutzerzahlen), markierst du gesondert — die brauchen später eine
Pflege-Strategie.

**Phase 5 — Release-Vorbereitung.**
Signierten Release-Build, Keystore anlegen und mir erklären, wie ich ihn
sichere. Dann eine Checkliste für die Play Console: Store-Eintrag,
Screenshots, Datenschutzerklärung, Data-Safety-Formular, Altersfreigabe.

**Noch nicht machen:** Werbung, In-App-Käufe, Consent-Banner, Accounts.
Das kommt erst, wenn die erste Version läuft.

---

## 3. Danach

Google Play Console kostet einmalig 25 $. Rechne mit ein paar Tagen für die
erste Prüfung. Neue Entwicklerkonten müssen ihre App vor Veröffentlichung
außerdem eine Zeit lang mit einer kleinen Testergruppe laufen lassen — plan
also lieber ein paar Wochen ein als ein Wochenende, und prüf die aktuellen
Anforderungen direkt in der Play Console, die ändern sich regelmäßig.
