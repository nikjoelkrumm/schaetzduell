# Schriften bündeln

Die App lädt keine Schriften mehr aus dem Netz. Sie erwartet vier Dateien
in einem Ordner `fonts/` direkt neben `schaetzduell.html`:

```
schaetzduell.html
fonts/
  Archivo-Variable.woff2
  ArchivoBlack-Regular.woff2
  DMMono-Regular.woff2
  DMMono-Medium.woff2
```

## Woher

Beide Familien stehen unter der SIL Open Font License, kommerzielle Nutzung
in einer bezahlten App ist erlaubt. Die OFL verlangt, dass du den Lizenztext
mitlieferst — leg `OFL.txt` aus jedem Download mit ins Projekt.

- **Archivo** und **Archivo Black**: https://github.com/Omnibus-Type/Archivo
- **DM Mono**: https://github.com/googlefonts/dm-mono

Alternativ über https://gwfh.mranftl.com — dort Familie und Schnitte wählen,
"Download files" liefert fertige `.woff2`.

## Umbenennen

Die Downloads heißen anders als oben. Entweder umbenennen oder die Pfade im
`@font-face`-Block ganz oben in `schaetzduell.html` anpassen. Gebraucht werden:

| Datei | Was |
|---|---|
| `Archivo-Variable.woff2` | Archivo Variable, Achse `wght` 100–900 |
| `ArchivoBlack-Regular.woff2` | Archivo Black, ein Schnitt |
| `DMMono-Regular.woff2` | DM Mono 400 |
| `DMMono-Medium.woff2` | DM Mono 500 |

Wenn du kein Variable Font willst, reichen auch die statischen Schnitte
Archivo 500/600/700/800 — dann brauchst du vier `@font-face`-Regeln mit
jeweils festem `font-weight` statt der einen mit `100 900`.

## Ohne die Dateien

Die App läuft trotzdem. Der Fallback-Stack greift auf Systemschriften zurück
und alle Display-Elemente sind auf Gewicht 900 gesetzt, damit die Optik nicht
zusammenfällt. Sieht ordentlich aus, aber nicht wie das fertige Design —
zum Testen reicht es, zum Release nicht.

## Prüfen

Flugmodus an, App öffnen. Wenn die Überschriften weiterhin sehr eng und
sehr fett stehen, sind die Dateien korrekt eingebunden.
