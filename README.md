# Klavierzeit

Lokale Browser-App zum Üben von Klaviernoten. Ohne Konto oder laufende Kosten; nur die optionale Fotoerkennung nutzt eine KI mit eigenem API-Schlüssel.

## Start unter Windows

1. **Start.cmd doppelklicken.** Beim ersten Start werden mit Internetverbindung die kostenlosen Bibliotheken installiert. Node.js ab 22.12 (oder 20.19) muss vorhanden sein.
2. Die App öffnet sich unter **http://127.0.0.1:5173**. Das Beispielstück ist sofort geladen.
3. Zum Beenden das Startfenster schließen. Ist Port 5173 belegt, die andere Instanz beenden.

Läuft Klavierzeit bereits, öffnet ein weiterer Aufruf von Start.cmd die vorhandene App und startet keinen zweiten Server. Immer `127.0.0.1` verwenden, nicht `localhost`: Unter `localhost:5173` kann ein anderes lokales Projekt antworten.

**Ohne Server per Doppelklick:** `index.html` im Projektordner (oder direkt `dist/index.html`) öffnet die eigenständige Version, die keinen Server und kein Internet braucht. Start.cmd erstellt bzw. aktualisiert sie automatisch, wenn sie fehlt oder der Quellcode neuer ist; alternativ `npm.cmd run build`. Fehlt sie noch, erklärt die Seite, was zu tun ist, statt weiß zu bleiben.

Alternativ im Projektordner: `npm.cmd ci`, dann `npm.cmd start`. Nach der Installation funktioniert die normale Nutzung offline; Noten und Klaviersamples werden lokal geladen. `npm.cmd run dev` startet ohne automatisch geöffneten Browser.

## Üben

Übemodus, Handwahl und Tempo stehen direkt am Notenpult. Import, Taktbereich und Lautstärke findest du in der Seitenleiste, auf Mobilgeräten unter der Übung. Notensystem-Zuordnung, Digitalpiano und Fortschritt kannst du aufklappen.

- **Zuhören:** Abspielen, pausieren und fortsetzen. Tempo und Lautstärke sind einstellbar.
- **Schrittmodus:** Die App wartet auf die markierten Töne. Akkorde können Ton für Ton eingegeben werden. Eine falsche Note lässt den Cursor stehen und behält richtige Teilnoten. Rhythmus und Anschlagsdauer werden nicht bewertet.
- **Computertastatur:** `A W S E D F T G Z H U J K` spielt C bis zum nächsten C. Die aktuelle Oktave steht über der Klaviertastatur; − / ＋ wechseln die Belegung. Töne auch per Maus oder Touch eingeben. Wiederholte Töne benötigen einen neuen Anschlag.
- **Takte wiederholen:** Von/Bis auswählen und Wiederholung aktivieren. Start- und Endtakt gehören dazu.
- **Hände:** Beide, Rechts oder Links wählen. Unter „Notensysteme zuordnen“ bei Bedarf die Systeme ändern. Die gesamte Partitur bleibt sichtbar.
- **Digitalpiano:** In Google Chrome oder Microsoft Edge „Digitalpiano verbinden“ wählen und den Browserzugriff erlauben. Gerät per USB verbinden, bei mehreren Eingängen das passende Gerät auswählen. MIDI wird nur empfangen; Pedal wird nicht ausgewertet. Bei fehlender Unterstützung weiterhin Bildschirm oder Computertastatur verwenden.
- **Fortschritt:** Geschaffte Einsätze, falsche Töne und Übezeit werden je Stück und Hand in IndexedDB gespeichert. Wiederholungen desselben Einsatzes erhöhen die Anzahl nicht. Tempo, Handwahl, Zuordnung und Taktbereich werden beim erneuten Laden derselben Datei wiederhergestellt. Für importierte Stücke die Datei nach einem Neustart erneut öffnen. Speicherung erfolgt spätestens alle wenigen Sekunden; Speicherfehler lassen das Üben weiterhin zu. Im Hintergrund pausiert die Wiedergabe. Im Schrittmodus pausiert die Übezeit nach 30 Sekunden ohne Eingabe.

Fortschritt gehört zu diesem Browser und zur Adresse `http://127.0.0.1:5173`; die per Doppelklick geöffnete Version hat einen eigenen Speicher. Ein anderer Browser, Privatmodus oder Löschen der Browserdaten hat einen anderen beziehungsweise leeren Speicher. „Fortschritt dieses Stücks löschen“ entfernt nach Bestätigung nur die Statistik dieses Stücks für alle Hände; die Partitur bleibt erhalten.
- **Fotos und PDFs erkennen (optional, KI):** Foto oder PDF unter „Noten öffnen“ wählen oder ablegen, mehrere Seiten gleichzeitig möglich (sortiert nach Dateiname, höchstens 8). Beim ersten Mal unter „Fotos erkennen (KI)“ einen eigenen Anthropic-API-Schlüssel von [console.anthropic.com](https://console.anthropic.com/settings/keys) eintragen; danach startet die Erkennung automatisch. Claude Opus 5.5 liest die Noten (meist 1–3 Minuten), die App baut daraus MusicXML und lädt es. Die tatsächlichen Kosten werden nach jeder Erkennung angezeigt (meist etwa 20–80 US-Cent pro Seite, abgerechnet über das eigene Anthropic-Konto). „Als MusicXML speichern“ sichert das Ergebnis, damit das Stück ohne erneute Kosten wieder geöffnet werden kann. Der Schlüssel wird nur im Browser gespeichert (localStorage) und nur an Anthropic gesendet; Fotos werden zur Erkennung an Anthropic übertragen. Die Erkennung kann Fehler enthalten: Die App weist darauf hin und nennt Takte, deren Rhythmus nicht zur Taktart passt.
- **MusicXML öffnen:** `.musicxml`, `.xml` oder komprimiertes `.mxl` aus einem externen Notenscanner verwenden. Es wird eine `score-partwise`-Klavierpartitur benötigt. Maximal 15 MB Dateigröße, 40 MB entpacktes Archiv. Ein fehlgeschlagener Import behält die bisherige Partitur.

## Grenzen

Fotoerkennung nur mit eigenem Anthropic-API-Schlüssel und Internetverbindung; erkannt werden Tonhöhen, Rhythmus, Akkorde, bis zu vier Stimmen je System, Haltebögen, Tonart, Taktart und Tempoangabe (keine Dynamik, Artikulation oder Fingersätze). Scannerfehler werden nicht automatisch korrigiert. Wiedergabe in notierter Taktfolge; Wiederholungszeichen, Sprünge, Verzierungen, Pedal und spätere Tempoänderungen werden nicht interpretiert. Die Oberfläche weist auf solche Inhalte hin. Klang verwendet eine Sample-Dynamikstufe, keine vollständige Klaviersimulation. Unterstützter Tonumfang A0–C8. Große Partituren können beim Import länger benötigen.

## Entwicklung und Prüfungen

- `npm.cmd run check`: TypeScript prüfen.
- `npm.cmd test`: gezielte Logiktests.
- `npm.cmd run build`: Produktionsbuild als eigenständige Datei `dist/index.html` (JavaScript, CSS, Beispielstück und Klaviersamples eingebettet). Funktioniert per Doppelklick, auf jedem statischen Server und auf GitHub Pages.
- `npm.cmd run test:browser`: Integrationstest in installiertem Google Chrome; vorher `npm.cmd run dev` starten. Screenshots liegen in `test-results/`. Läuft der Server auf einer anderen Adresse, diese in `KLAVIER_URL` angeben.
- `npm.cmd run test:photo`: Fotoerkennung im Browser mit simulierter Anthropic-API (keine echten Anfragen oder Kosten); vorher `npm.cmd run dev` starten.
- `npm.cmd run test:production`: eigenständiger Test des gebauten `dist/` auf localhost:5174; externe Netzwerkverbindungen werden gesperrt. Prüft außerdem das Öffnen von `dist/index.html` und `index.html` per Doppelklick (file://). Vorher Build ausführen. Tests verwenden isolierte Browserkontexte und simulieren MIDI; sie greifen nicht auf persönliche Browserdaten zu.

**Bestätigt am 17.09.2026:** elf Logiktests bestanden; Typprüfung und Produktionsbuild erfolgreich. Chrome-Browser: gesamtes Beispiel im Schrittmodus, C4/MIDI 60, Haltebögen, Cursorfolge, Akkorde/falsche Eingaben/gehaltene Tasten, Pause/Fortsetzen und Taktloop. XML/MXL, fehlerhafter Import, Drag-and-drop und gleichzeitige Importe geprüft; zusätzliche Partitur mit Auftakt, Vorzeichen, Punktierung, Triolen, mehreren Stimmen sowie Takt-/divisions-Wechsel. Maus/Tastatur/Touch, Handfilter und Zuordnung, simulierte MIDI-Eingaben/Note-off/Trennen, IndexedDB/Neuladen/Löschen und Speicherfehler geprüft. Alle 30 Samples dekodieren; Signal am tatsächlichen Audioausgang nachgewiesen. Zurücksetzen bricht auch einen noch ladenden Wiedergabestart ab. Desktop und 390 px breite Ansicht visuell angesehen. Kein subjektiver Hörtest oder Test mit physischem Digitalpiano durchgeführt.

Produktionsbuild zusätzlich auf localhost:5174 bei gesperrtem externem Netzwerk geprüft: Beispiel, Partitur, Schrittmodus, lokale Wiedergabe, Pause, Lizenzdatei und korrigierte Mobilansicht funktionieren; keine externen Anfragen. Start.cmd wurde sowohl bei gestopptem als auch bei bereits laufendem Server erfolgreich ausgeführt. Abhängigkeiten wurden erfolgreich mit `npm.cmd install` installiert. Die Start.cmd-Zweige für fehlende Abhängigkeiten (`npm ci`) und fehlendes/zu altes Node.js wurden nicht separat durchlaufen.

Fortschritt des Projekts: [PROJECT_STATE.md](PROJECT_STATE.md). Klangherkunft und Lizenzen: [THIRD_PARTY_NOTICES.md](public/THIRD_PARTY_NOTICES.md).

**Weiße Seite behoben am 03.10.2026:** Ursache war das Öffnen von `index.html` bzw. eines veralteten `dist/index.html` per Doppelklick; Chrome blockiert dann die Skripte. Der Build ist jetzt eine eigenständige Datei, `index.html` leitet dorthin weiter. Typprüfung, elf Logiktests, vollständige Chrome-Integration und Produktionsprüfung (http und file://, gesperrtes Netzwerk, Wiedergabe mit Klang) bestanden. Start.cmd-Ablauf mit automatischem Build nicht per Doppelklick ausgeführt, nur die Prüfung auf veralteten Build getestet.

**Interface-Überarbeitung am 17.09.2026:** Typprüfung, Build und vollständige Chrome-Integration erneut bestanden. Modus und Handwahl am Notenpult, Lautstärkeanzeige per Tastatur, mobile Reihenfolge und sichtbare Computerbelegung nach Größenwechsel geprüft. Keine horizontale Seitenausdehnung bei 320, 390, 768, 1024 und 1920 px; Desktop/Mobil visuell geprüft. Produktionsprüfung bei gesperrtem externem Netzwerk einschließlich aufklappbarem Fortschritt auf Mobilgeräten bestanden.

**Fotoerkennung am 04.10.2026:** Typprüfung, 18 Logiktests (davon 7 für die MusicXML-Umwandlung), vollständige Chrome-Integration, neuer Fototest und Produktionsprüfung bestanden. Der Fototest simuliert die Anthropic-API: Schlüsselabfrage, automatischer Start, Anfrage (Modell, Bild/PDF, JSON-Schema, Fallback, Browser-Header), dargestellte Partitur mit Akkord, Vorzeichen und Haltebogen, Kostenanzeige, Download, gespeicherter Schlüssel, Fehler 401, Abbrechen und Mobilansicht. Zusätzlich im Produktionsbuild per Doppelklick (file://) mit simulierter API geprüft. **Nicht geprüft:** echte Erkennung mit einem realen API-Schlüssel, Erkennungsqualität und tatsächliche Kosten.
