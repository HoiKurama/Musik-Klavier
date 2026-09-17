# Goal
2026-09-17: Lokale Browser-App zum interaktiven Klavierüben. Erfolg: MusicXML importieren, synchron anzeigen/abspielen, Takte wiederholen und Schritte per Bildschirm/Computertastatur lösen; danach Handwahl, MIDI und Fortschritt.

# Current State
Erste Version lokal als Git-Commit 31044a8 gesichert. Bedienung/Import verbessert (Drag-and-drop, Tastaturbereich, überlappende Ladeversuche); Handwahl mit einstellbarer Notensystemzuordnung ergänzt. Neun Logiktests und Chrome-Integration bestanden; zusätzlich Auftakt, mehrere Stimmen, Vorzeichen, Punktierung, Triolen, Takt-/divisions-Wechsel und Handfilter im Browser geprüft. Desktop und Mobilansicht visuell angesehen. Typprüfung und Build erfolgreich.

# Important Decisions
TypeScript/Vite ohne UI-Framework; OSMD für Notenmodell und Darstellung; Tone.js mit lokalen Salamander-Samples. Kein Backend, keine KI-API, keine Veröffentlichung und keine Unteragenten. Takte in notierter Reihenfolge; Schrittmodus bewertet Tonhöhen.

# Relevant Facts
Windows; Node 24.19.0, npm 11.17.0. Start auf 127.0.0.1:5173. Regeln aus dem Nutzerauftrag; zuvor keine AGENTS.md oder PROJECT_STATE.md vorhanden.

# Open Questions
Keine Produktentscheidungen offen. Kein physisches MIDI-Gerät verfügbar; bisher kein subjektiver Hörtest.

# Next Steps
Handwahl-Meilenstein sichern. MIDI und IndexedDB-Fortschritt als vorbereitete Module anbinden, simulierte MIDI-Nachrichten und Speicherung/Neuladen prüfen; abschließende Prüfung und Dokumentation.
