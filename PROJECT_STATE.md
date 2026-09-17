# Goal
2026-09-17: Lokale Browser-App zum interaktiven Klavierüben. Erfolg: MusicXML importieren, synchron anzeigen/abspielen, Takte wiederholen und Schritte per Bildschirm/Computertastatur lösen; danach Handwahl, MIDI und Fortschritt.

# Current State
2026-09-17: Gesamter vereinbarter Umfang fertig: MusicXML/MXL, Noten/Cursor/Tastatur, lokaler Klavierklang, Tempo/Pause/Taktloops/Schrittmodus, Beispiel, Importverbesserungen, Handwahl/Zuordnung, MIDI und IndexedDB-Fortschritt. Elf Logiktests, Typprüfung, Build und vollständige Chrome-Integration bestanden. Produktionsbuild bei gesperrtem externem Netzwerk geprüft; keine externen Anfragen. Desktop/Mobil visuell geprüft, Start.cmd bei gestopptem und laufendem Server bestätigt. Prüfdetails und Grenzen sind maßgeblich in [README.md](README.md) dokumentiert. V1, Import/Handwahl und finaler Stand lokal in Git gesichert. App läuft auf localhost:5173.

# Important Decisions
TypeScript/Vite ohne UI-Framework; OSMD für Notenmodell und Darstellung; Tone.js mit lokalen Salamander-Samples. Kein Backend, keine KI-API, keine Veröffentlichung und keine Unteragenten. Takte in notierter Reihenfolge; Schrittmodus bewertet Tonhöhen.

# Relevant Facts
Windows; Node 24.19.0, npm 11.17.0. Start.cmd oder npm.cmd start, Adresse http://127.0.0.1:5173. OSMD 1.9.9; 30 lokale Salamander-Samples. Keine Foto-/PDF-Erkennung; Notationswiederholungen/Sprünge/Pedal/Verzierungen werden nicht interpretiert. Handfilter pro Notensystem; Schrittmodus ohne Rhythmusbewertung. Speicherschlüssel: XML-Inhaltshash und Hand. Importierte Stücke zum Wiederaufnehmen erneut öffnen.

# Open Questions
Keine offenen Produktentscheidungen oder erforderlichen Softwareaufgaben. Nicht geprüft: reales Digitalpiano und subjektives Hören. MIDI wurde simuliert, das Audiosignal technisch geprüft.

# Next Steps
Fertig. Nutzer kann Beispiel/Scannerexporte üben. Bei verfügbarer Hardware MIDI mit realem Digitalpiano und Klang subjektiv prüfen; bei konkreten problematischen Scannerexporten gezielt Importtests ergänzen. Keine fortlaufende Arbeit ohne neuen Anlass erforderlich.
