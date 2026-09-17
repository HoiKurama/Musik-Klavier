# Klavierzeit

Lokale Browser-App zum Üben von Klaviernoten. Ohne Konto, KI-API oder laufende Kosten.

## Start unter Windows

1. **Start.cmd doppelklicken.** Beim ersten Start werden mit Internetverbindung die kostenlosen Bibliotheken installiert. Node.js ab 22.12 (oder 20.19) muss vorhanden sein.
2. Die App öffnet sich unter **http://127.0.0.1:5173**. Das Beispielstück ist sofort geladen.
3. Zum Beenden das Startfenster schließen. Ist Port 5173 belegt, die andere Instanz beenden.

Alternativ im Projektordner: `npm.cmd ci`, dann `npm.cmd start`. Nach der Installation funktioniert die normale Nutzung offline; Noten und Klaviersamples werden lokal geladen. `npm.cmd run dev` startet ohne automatisch geöffneten Browser.

## Üben

- **Zuhören:** Abspielen, pausieren und fortsetzen. Tempo und Lautstärke sind einstellbar.
- **Schrittmodus:** Die App wartet auf die markierten Töne. Akkorde können Ton für Ton eingegeben werden. Eine falsche Note lässt den Cursor stehen und behält richtige Teilnoten. Rhythmus und Anschlagsdauer werden nicht bewertet.
- **Computertastatur:** `A W S E D F T G Z H U J K` spielt C bis zum nächsten C. Die aktuelle Oktave steht über der Klaviertastatur; − / ＋ wechseln die Belegung. Töne auch per Maus oder Touch eingeben. Wiederholte Töne benötigen einen neuen Anschlag.
- **Takte wiederholen:** Von/Bis auswählen und Wiederholung aktivieren. Start- und Endtakt gehören dazu.
- **Hände:** Beide, Rechts oder Links wählen. Unter „Notensysteme zuordnen“ bei Bedarf die Systeme ändern. Die gesamte Partitur bleibt sichtbar.
- **MusicXML öffnen:** `.musicxml`, `.xml` oder komprimiertes `.mxl` aus einem externen Notenscanner verwenden. Es wird eine `score-partwise`-Klavierpartitur benötigt. Maximal 15 MB Dateigröße, 40 MB entpacktes Archiv. Ein fehlgeschlagener Import behält die bisherige Partitur.

## Grenzen

Keine eigene Foto-/PDF-Erkennung. Scannerfehler werden nicht automatisch korrigiert. Wiedergabe in notierter Taktfolge; Wiederholungszeichen, Sprünge, Verzierungen, Pedal und spätere Tempoänderungen werden nicht interpretiert. Die Oberfläche weist auf solche Inhalte hin. Klang verwendet eine Sample-Dynamikstufe, keine vollständige Klaviersimulation. Unterstützter Tonumfang A0–C8. Große Partituren können beim Import länger benötigen.

## Entwicklung und Prüfungen

- `npm.cmd run check`: TypeScript prüfen.
- `npm.cmd test`: gezielte Logiktests.
- `npm.cmd run build`: Produktionsbuild in `dist/`.
- `npm.cmd run test:browser`: Integrationstest in installiertem Google Chrome; vorher `npm.cmd run dev` starten. Screenshots liegen in `test-results/`.

**Bestätigt am 17.09.2026:** neun Logiktests bestanden; Typprüfung und Produktionsbuild erfolgreich. Echter Chrome-Browser: achtaktiges Beispiel komplett im Schrittmodus, korrekte C4-Tonhöhe und Haltebogendauer, Cursorfolge, Akkordteilnoten, falsche Eingaben, gehaltene Tasten, Pause/Fortsetzen, Taktloop, XML/MXL und fehlerhafter Import, Maus/Tastatur/Touch, Desktop und 390 px breite Ansicht. Alle 30 Samples dekodieren; Audiosignal im C4-Sample nachgewiesen. Desktopoberfläche visuell angesehen. Kein subjektiver Hörtest oder Test mit physischem Digitalpiano durchgeführt.

Fortschritt des Projekts: [PROJECT_STATE.md](PROJECT_STATE.md). Klangherkunft und Lizenzen: [THIRD_PARTY_NOTICES.md](public/THIRD_PARTY_NOTICES.md).
