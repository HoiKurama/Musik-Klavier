# Goal
2026-09-17: Lokale Browser-App zum interaktiven Klavierüben. Erfolg: MusicXML importieren, synchron anzeigen/abspielen, Takte wiederholen und Schritte per Bildschirm/Computertastatur lösen; danach Handwahl, MIDI und Fortschritt.

# Current State
Erste Version nutzbar: Beispiel mit acht Takten; XML/MXL-Import, OSMD-Noten und Cursor, lokale Klaviersamples, Tempo/Lautstärke/Pause, Taktloops und Schrittmodus mit Maus/Touch/Computertastatur. Neun Logiktests und Chrome-Integration bestanden; Desktop visuell geprüft. Typprüfung und Build erfolgreich, abschließender Build nach Cursor-Korrektur läuft.

# Important Decisions
TypeScript/Vite ohne UI-Framework; OSMD für Notenmodell und Darstellung; Tone.js mit lokalen Salamander-Samples. Kein Backend, keine KI-API, keine Veröffentlichung und keine Unteragenten. Takte in notierter Reihenfolge; Schrittmodus bewertet Tonhöhen.

# Relevant Facts
Windows; Node 24.19.0, npm 11.17.0. Start auf 127.0.0.1:5173. Regeln aus dem Nutzerauftrag; zuvor keine AGENTS.md oder PROJECT_STATE.md vorhanden.

# Open Questions
Keine Produktentscheidungen offen. Kein physisches MIDI-Gerät verfügbar; bisher kein subjektiver Hörtest.

# Next Steps
Geprüfte erste Version lokal versionieren. Danach Import/Bedienung verbessern und repräsentative MusicXML-Fälle testen; anschließend Handwahl, MIDI und IndexedDB-Fortschritt implementieren und prüfen.
