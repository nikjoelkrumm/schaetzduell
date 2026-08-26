# Schätzduell — Stand 26.08.2026

## Live

| | |
|---|---|
| Startseite | https://sch-tzduell.onepage.me/ |
| Spiel | https://sch-tzduell.onepage.me/spielen |
| Builder | https://app.onepage.io/sites/2c310c72-35ec-400b-8339-6324ba4da703/pages |

Registrierungen landen im Onepage-CRM unter dem Formular **„Schätzduell Registrierung"**
(Felder: Spielername, E-Mail, Freundescode, Newsletter-Einwilligung).

## Was gebaut wurde

**Startseite** — sechs Sektionen: Hero, Wochenchallenge mit Live-Countdown,
„So funktioniert es" mit Mitmach-Beispiel, Modi & Kategorien, Freunde/Ligen/Abzeichen,
FAQ & Abschluss.

**Spielseite** — die komplette App: Registrierung und Anmeldung (mehrere Profile pro
Gerät, Passwort als SHA-256-Hash mit Salt), Wochenchallenge, Duell für 2–8 Spieler,
Übungsmodus, Freundesliste, Profil mit Level/Liga/Abzeichen.

**Komponenten** — elf `@siteui`-Pakete: `text`, `title`, `button`, `badge`, `card`,
`field`, `progress`, `avatar`, `stat`, `logo`, `scale`, `shell`, `quiz-data`.
`quiz-data` hält die 375 Fragen plus die Wochenlogik und wird von der App **und**
den Landing-Sektionen genutzt — die Kategoriezahlen auf der Startseite sind also echt
berechnet, nicht getippt.

**Bilder** — mit Higgsfield (`nano_banana_pro`) erzeugt, 8 Credits: Hero, Wochenring,
Duell-Motiv, Kategorien-Collage. Alle textfrei und im Petrol/Amber-Look der Bildmarke.

## Mechaniken, bewusst abgeschaut

- **Wordle** — eine Challenge pro Woche, für alle identisch, deterministisch aus der
  Kalenderwoche statt aus Zufall. Spoilerfreier Teilen-Block (`█▓▒░·`) und Serie.
- **Duolingo / Clash Royale** — XP, Level, fünf Ligen von Bronze bis Diamant.
- **Quizduell** — Freundesliste und Kopf-an-Kopf-Vergleich pro Woche.

Freunde laufen ohne Server: Nach der Wochenchallenge gibt es einen Code
(`SD1.…`, Base64url) mit Name, Woche, Prozentwert und Balken — aber ohne eine einzige
getippte Zahl und ohne Lösung. Wer ihn einträgt, sieht das Ergebnis in seiner Rangliste.

## Fehler, die dabei gefunden und behoben wurden

1. **Faktor-100-Fehler bei Dezimalfragen.** Die alte Eingabe strich jeden Punkt:
   `2.44` wurde zu `244`, `1.5` zu `15`. Betraf die zehn Fragen mit Nachkommawert
   (Fußballtor 2,44 m, Usain Bolt 9,58 s, Mindestlohn 13,90 € …). Der neue Parser
   unterscheidet Tausenderpunkte von Dezimalpunkten und versteht zusätzlich
   `12k`, `3 Mio`, `2 Mrd`.
2. **Negative Antworten.** Zwei Temperaturfragen (−89 °C, −270 °C) liefen in den
   Log-Zweig der Punkteformel. Jetzt sauber abgefangen, plus Guard gegen `NaN`.
3. **Spielstand ohne Version.** `v:1` wird geschrieben und beim Laden geprüft, sonst
   zeigen alte Stände nach einer Fragenerweiterung auf verschobene Indizes.
4. **Fragenwiederholung.** Gespielte Fragen werden gemerkt und bevorzugt übersprungen.
   Die Wochenchallenge läuft durch eine feste Permutation — 53 Wochen ohne Dublette.

Diese Fixes stecken auch in `schaetzduell-verbessert.html` — die Offline-Datei für
den Capacitor-Weg, sonst unverändert gegenüber dem Original in `_extracted/`.

## Offen

- **Fragen sind nicht quellengeprüft.** Es sind recherchierte Näherungswerte. Phase 4
  aus `claude-code-start.md` (jede Zahl per Websuche belegen) steht weiterhin aus.
  41 Fragen enthalten Preise, Gehälter oder Nutzerzahlen — die zeigen in der App den
  Hinweis „Richtwert · ändert sich mit der Zeit" und brauchen eine Pflegerunde pro Saison.
- **Spielstand liegt im Browser.** Kein Server-Konto. Wer den Browserspeicher leert oder
  das Gerät wechselt, fängt neu an. Für echte geräteübergreifende Konten bräuchte es
  ein Backend, das Onepage nicht stellt.
- **DM Mono lädt nicht.** Der Google-Fonts-Link im `<head>` ist auf dem aktuellen Tarif
  gesperrt. Die Monospace-Elemente greifen auf den Systemfont zurück. Archivo und
  Archivo Black liegen korrekt im Font-Kit.
