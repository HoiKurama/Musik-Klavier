import { mkdir, writeFile } from 'node:fs/promises';
const melody = [
  [['C4',4],['D4',4],['E4',4],['G4',4]],
  [['E4',4],['D4',2],['E4',2],['F4',4],['D4',4]],
  [['E4',4],['G4',4],['A4',4],['G4',4]],
  [['F4',4],['E4',4],['D4',4],['R',4]],
  [['C4',4],['E4',4],['G4',4],['C5',4]],
  [['A4',4],['F4',4],['D4',4],['G4',4]],
  [['E4',4],['D4',4],['C4',8,'start']],
  [['C4',16,'stop']]
];
const bass = [['C3','G3'],['G2','D3'],['C3','G3'],['G2','G3'],['C3','G3'],['F2','G2'],['G2','G3'],['C3']];
const type = {2:'eighth',4:'quarter',8:'half',16:'whole'};
function note(pitch, duration, staff, tie, chord = false) {
  const p = pitch === 'R' ? '<rest/>' : `<pitch><step>${pitch[0]}</step><octave>${pitch.at(-1)}</octave></pitch>`;
  return `<note>${chord ? '<chord/>' : ''}${p}<duration>${duration}</duration>${tie ? `<tie type="${tie}"/>` : ''}<voice>${staff}</voice><type>${type[duration]}</type><staff>${staff}</staff>${tie ? `<notations><tied type="${tie}"/></notations>` : ''}</note>`;
}
const measures = melody.map((notes, i) => `<measure number="${i+1}">${i === 0 ? '<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>90</per-minute></metronome></direction-type><sound tempo="90"/></direction>' : ''}${notes.map(n => note(n[0],n[1],1,n[2])).join('')}<backup><duration>16</duration></backup>${bass[i].map(n => note(n,i === 7 ? 16 : 8,2)).join('')}${i === 7 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ''}</measure>`).join('\n');
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/example.musicxml', import.meta.url), `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0"><work><work-title>Kleine Klavierzeit</work-title></work><identification><creator type="composer">Beispielübung · Klavierzeit</creator></identification><part-list><score-part id="P1"><part-name>Klavier</part-name><part-abbreviation>Kl.</part-abbreviation><score-instrument id="I1"><instrument-name>Klavier</instrument-name></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument></score-part></part-list><part id="P1">${measures}</part></score-partwise>`);
console.log('Achtaktige Beispielübung geschrieben.');
