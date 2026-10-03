# Goal
2026-09-17: Lokale Browser-App zum interaktiven Klavierüben. Funktionen vollständig; aktueller Auftrag: Interface verbessern. Erfolg: Partitur im Mittelpunkt, Übemodus/Handwahl/Tempo am Notenpult, kompakte Einstellungen und gut nutzbare Mobilansicht bei erhaltenen Funktionen.

# Current State
2026-09-20: Interface-Überarbeitung weiterhin abnahmebereit: kompakter Kopfbereich, breiteres Notenpult mit fensterabhängiger Höhe; Modus, Handwahl und Tempo direkt darüber. Import/Taktbereich/Lautstärke in der Seitenleiste; Notensystem-Zuordnung, MIDI und Fortschritt einklappbar. Bessere Lesbarkeit, Lautstärkewert sichtbar. Mobil steht das Notenpult zuerst; Computerbelegung bleibt nach Größenwechsel sichtbar. Elf Logiktests, Typprüfung, Build und vollständige Chrome-Integration erneut bestanden; Desktop/Mobil visuell geprüft. Produktionsbuild mit gesperrtem externem Netzwerk bestanden, keine externen Anfragen. Prüfdetails/Grenzen: [README.md](README.md).
2026-10-03: Weiße Seite behoben (Doppelklick auf index.html/veraltetes dist). Build ist eine eigenständige `dist/index.html` mit eingebetteten Samples; `index.html` leitet per file:// dorthin weiter; Start.cmd baut bei Bedarf neu. Commit-Sperre (verwaiste `.git/index.lock`) entfernt, Zeilenenden per `.gitattributes` geregelt (Batch-Dateien CRLF). Alle Prüfungen bestanden und committed.

# Important Decisions
TypeScript/Vite ohne UI-Framework; OSMD für Notenmodell und Darstellung; Tone.js mit lokalen Salamander-Samples. Kein Backend, keine KI-API, keine Veröffentlichung und keine Unteragenten. Takte in notierter Reihenfolge; Schrittmodus bewertet Tonhöhen. Creme-Grün-Gestaltung bleibt; selten benötigte Einstellungen verwenden native details/summary. Mobile Reihenfolge entspricht der DOM-Reihenfolge.

# Relevant Facts
Windows; Node 24.19.0, npm 11.17.0. Start.cmd oder npm.cmd start, Adresse http://127.0.0.1:5173 (nicht localhost: dort läuft auf diesem Rechner teils ein anderes Vite-Projekt). Ohne Server: index.html bzw. dist/index.html doppelklicken. OSMD 1.9.9; 30 lokale Salamander-Samples. Keine Foto-/PDF-Erkennung; Notationswiederholungen/Sprünge/Pedal/Verzierungen werden nicht interpretiert. Handfilter pro Notensystem; Schrittmodus ohne Rhythmusbewertung. Speicherschlüssel: XML-Inhaltshash und Hand. Importierte Stücke zum Wiederaufnehmen erneut öffnen.

# Open Questions
Keine offenen Produktentscheidungen oder erforderlichen Softwareaufgaben. Nicht geprüft: reales Digitalpiano und subjektives Hören. MIDI wurde simuliert, das Audiosignal technisch geprüft.

# Next Steps
Interface fertig und lokal verfügbar; Nutzer kann es ansehen und konkrete Anpassungen nennen. Optional später MIDI mit realem Digitalpiano und Klang subjektiv prüfen; bei problematischen Scannerexporten gezielt Importtests ergänzen.
