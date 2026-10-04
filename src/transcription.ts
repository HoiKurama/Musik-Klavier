// Structured transcription returned by the photo recognition, and its conversion to MusicXML.
// The model fills a small JSON schema; building valid MusicXML (divisions, backups, ties) stays in code.
export type Duration = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';
export interface NoteEvent { pitches: string[]; duration: Duration; dots: number; triplet: boolean; tie: boolean }
export interface RecognizedMeasure { fifths: number; beats: number; beatType: number; upper: NoteEvent[][]; lower: NoteEvent[][] }
export interface RecognizedScore { readable: boolean; problem: string; title: string; composer: string; tempo: number; upperClef: 'G' | 'F'; lowerClef: 'G' | 'F'; measures: RecognizedMeasure[] }

const DURATIONS: Duration[] = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd'];
const event = {
  type: 'object', additionalProperties: false, required: ['pitches', 'duration', 'dots', 'triplet', 'tie'],
  properties: {
    pitches: { type: 'array', items: { type: 'string' }, description: 'Sounding pitches in scientific pitch notation, e.g. "C4" (middle C), "F#3", "Bb5". Several pitches form a chord. Empty array = rest.' },
    duration: { type: 'string', enum: DURATIONS },
    dots: { type: 'integer', enum: [0, 1, 2] },
    triplet: { type: 'boolean', description: 'true if the note belongs to a triplet (3 in the time of 2).' },
    tie: { type: 'boolean', description: 'true if these pitches are tied to the same pitches in the next event of this voice.' },
  },
};
const voices = { type: 'array', items: { type: 'array', items: event }, description: 'Voices of this staff in this measure (usually one). Each voice is a list of events in time order.' };
export const SCORE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['readable', 'problem', 'title', 'composer', 'tempo', 'upperClef', 'lowerClef', 'measures'],
  properties: {
    readable: { type: 'boolean', description: 'false if the input contains no readable sheet music.' },
    problem: { type: 'string', description: 'Short German note about unreadable or uncertain parts, otherwise empty.' },
    title: { type: 'string' }, composer: { type: 'string' },
    tempo: { type: 'integer', description: 'Quarter notes per minute if a metronome mark is printed, otherwise 0.' },
    upperClef: { type: 'string', enum: ['G', 'F'] }, lowerClef: { type: 'string', enum: ['G', 'F'] },
    measures: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['fifths', 'beats', 'beatType', 'upper', 'lower'],
      properties: {
        fifths: { type: 'integer', description: 'Key signature in effect: sharps positive, flats negative (-7 to 7).' },
        beats: { type: 'integer', description: 'Time signature numerator in effect.' }, beatType: { type: 'integer', description: 'Time signature denominator in effect.' },
        upper: voices, lower: voices,
      },
    } },
  },
};

export const TRANSCRIPTION_PROMPT = `You are an expert music engraver. You transcribe piano sheet music from photos, scans and PDFs into the given JSON structure. Transcribe exactly what is printed; never invent, simplify or "improve" the music.

Reading order: all systems from top to bottom, all pages in the given order. Every printed measure exactly once, starting with the first (possibly incomplete pickup) measure. Do not expand repeat signs or jumps.

Staves: "upper" is the upper staff of each piano system (usually treble clef, right hand), "lower" the lower staff (usually bass clef, left hand). For music with a single staff put everything in "upper" and leave "lower" empty in every measure. upperClef/lowerClef: clef at the beginning. Watch for clef changes inside a staff and for 8va/8vb lines; always write the sounding pitch.

Pitch: scientific pitch notation, C4 is middle C (one ledger line below the treble staff, one above the bass staff). Treble clef lines from bottom to top: E4 G4 B4 D5 F5. Bass clef lines: G2 B2 D3 F3 A3. Apply the key signature and accidentals (an accidental lasts until the barline for that pitch) and write the resulting pitch, e.g. F#4 in G major or Bb3 in F major. Use only # and b.

Rhythm: notes in one staff that start together with the same duration form one event with several pitches (a chord). If one staff has independent rhythms at the same time (for example a held note under moving notes, stems in opposite directions), use separate voices and fill every voice with rests. In each complete measure the durations of every voice must add up exactly to the time signature; the pickup measure contains only its actual length. A whole-measure rest is one rest event that fills the measure (whole rest in 4/4, dotted half in 3/4).

Ties: set tie to true when a curved line connects a note to the SAME pitch in the next event of the voice, also across barlines. Slurs between different pitches are not ties.

fifths, beats and beatType: key and time signature in effect, repeated in every measure. tempo: quarter notes per minute from a printed metronome mark (convert e.g. half = 60 to 120), otherwise 0. Ignore dynamics, fingering, pedal marks, lyrics and chord symbols. title and composer as printed, otherwise empty strings.

If the input contains no readable sheet music, set readable to false, measures to an empty list and explain the reason in German in "problem". Otherwise set readable to true and use "problem" for a short German note about anything you could not read reliably (for example "Takt 7 ist unscharf"), or leave it empty.`;

const DIVISIONS = 48; // per quarter note: fits 32nd notes, dots and triplets
const QUARTERS: Record<Duration, number> = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125 };
const ALTER: Record<string, number> = { '': 0, '#': 1, '##': 2, x: 2, b: -1, bb: -2 };
const escape = (text: string) => text.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
const clamp = (value: number, low: number, high: number, fallback: number) => Number.isFinite(value) ? Math.max(low, Math.min(high, Math.round(value))) : fallback;

interface Pitch { step: string; alter: number; octave: number; key: string }
export function parsePitch(text: string): Pitch | undefined {
  const match = /^([A-Ga-g])(##|#|x|bb|b)?(\d)$/.exec(text.trim().replace('♯', '#').replace('♭', 'b'));
  if (!match) return;
  const step = match[1].toUpperCase(), alter = ALTER[match[2] ?? ''], octave = Number(match[3]);
  return { step, alter, octave, key: `${step}${alter}${octave}` };
}
const kind = (e: NoteEvent): Duration => DURATIONS.includes(e.duration) ? e.duration : 'quarter';
export function eventTicks(e: NoteEvent): number {
  const dots = [1, 1.5, 1.75][clamp(e.dots, 0, 2, 0)];
  return Math.round(QUARTERS[kind(e)] * DIVISIONS * dots * (e.triplet ? 2 / 3 : 1));
}

// Returns MusicXML plus the measure numbers whose voices do not match the time signature.
export function toMusicXML(score: RecognizedScore): { xml: string; measures: number; irregular: number[] } {
  const measures = score.measures ?? [];
  if (!score.readable || !measures.some(m => [...m.upper, ...m.lower].some(v => v.length))) throw new Error(score.problem?.trim() || 'Auf dem Bild wurden keine Klaviernoten erkannt.');
  const staves = measures.some(m => m.lower.some(v => v.length)) ? 2 : 1;
  const ties = new Map<string, Set<string>>();
  const irregular: number[] = [];
  const offset = isPickup(measures[0]) ? 0 : 1;
  let fifths = NaN, beats = NaN, beatType = NaN;
  const body = measures.map((m, index) => {
    const nextFifths = clamp(m.fifths, -7, 7, 0), nextBeats = clamp(m.beats, 1, 32, 4);
    const nextType = [1, 2, 4, 8, 16, 32].includes(m.beatType) ? m.beatType : 4;
    const expected = nextBeats * 4 / nextType * DIVISIONS;
    const staffVoices = [m.upper, m.lower].slice(0, staves).map(list => list.filter(v => v.length).slice(0, 4));
    const pickup = index === 0 && offset === 0;
    const length = pickup ? longestVoice(m) : expected;
    const number = index + offset;
    let xml = '';
    if (nextFifths !== fifths || nextBeats !== beats || nextType !== beatType) {
      xml += '<attributes>';
      if (index === 0) xml += `<divisions>${DIVISIONS}</divisions>`;
      if (nextFifths !== fifths) xml += `<key><fifths>${nextFifths}</fifths></key>`;
      if (nextBeats !== beats || nextType !== beatType) xml += `<time><beats>${nextBeats}</beats><beat-type>${nextType}</beat-type></time>`;
      if (index === 0) {
        if (staves === 2) xml += '<staves>2</staves>';
        for (const [i, sign] of [score.upperClef, score.lowerClef].slice(0, staves).entries()) xml += `<clef number="${i + 1}"><sign>${sign === 'F' ? 'F' : 'G'}</sign><line>${sign === 'F' ? 4 : 2}</line></clef>`;
      }
      xml += '</attributes>';
      fifths = nextFifths; beats = nextBeats; beatType = nextType;
    }
    const tempo = clamp(score.tempo, 0, 300, 0);
    if (index === 0 && tempo >= 20) xml += `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type><sound tempo="${tempo}"/></direction>`;
    const parts: { notes: string; total: number }[] = [];
    for (const [s, list] of staffVoices.entries()) {
      const staff = s + 1;
      if (!list.length) { parts.push({ notes: `<note><rest measure="yes"/><duration>${length}</duration><voice>${s * 4 + 1}</voice><staff>${staff}</staff></note>`, total: length }); continue; }
      for (const [v, voice] of list.entries()) {
        const id = `${staff}:${v}`;
        let notes = '', total = 0;
        for (const e of voice) {
          const ticks = eventTicks(e);
          const pitches = [...new Map(e.pitches.map(parsePitch).filter((p): p is Pitch => !!p).map(p => [p.key, p])).values()];
          const pending = ties.get(id) ?? new Set<string>();
          const tail = `<voice>${s * 4 + v + 1}</voice><type>${kind(e)}</type>${'<dot/>'.repeat(clamp(e.dots, 0, 2, 0))}${e.triplet ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>' : ''}<staff>${staff}</staff>`;
          if (!pitches.length) notes += `<note><rest/><duration>${ticks}</duration>${tail}</note>`;
          for (const [i, p] of pitches.entries()) {
            const stop = pending.has(p.key), start = e.tie;
            const tie = `${stop ? '<tie type="stop"/>' : ''}${start ? '<tie type="start"/>' : ''}`;
            const tied = stop || start ? `<notations>${stop ? '<tied type="stop"/>' : ''}${start ? '<tied type="start"/>' : ''}</notations>` : '';
            notes += `<note>${i ? '<chord/>' : ''}<pitch><step>${p.step}</step>${p.alter ? `<alter>${p.alter}</alter>` : ''}<octave>${p.octave}</octave></pitch><duration>${ticks}</duration>${tie}${tail}${tied}</note>`;
          }
          ties.set(id, new Set(e.tie ? pitches.map(p => p.key) : []));
          total += ticks;
        }
        if (Math.abs(total - length) > 1) irregular.push(number);
        parts.push({ notes, total });
      }
    }
    xml += parts.map((part, i) => i < parts.length - 1 ? `${part.notes}<backup><duration>${part.total}</duration></backup>` : part.notes).join('');
    return `<measure number="${number}"${pickup ? ' implicit="yes"' : ''}>${xml}</measure>`;
  });
  const title = score.title?.trim();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">${title ? `<work><work-title>${escape(title)}</work-title></work>` : ''}<identification>${score.composer?.trim() ? `<creator type="composer">${escape(score.composer.trim())}</creator>` : ''}<encoding><software>Klavierzeit Fotoerkennung</software></encoding><miscellaneous><miscellaneous-field name="klavierzeit-erkannt">ja</miscellaneous-field></miscellaneous></identification><part-list><score-part id="P1"><part-name>Klavier</part-name></score-part></part-list><part id="P1">${body.join('')}</part></score-partwise>`;
  return { xml, measures: measures.length, irregular: [...new Set(irregular)] };
}
const longestVoice = (m: RecognizedMeasure) => Math.max(0, ...[...m.upper, ...m.lower].map(v => v.reduce((sum, e) => sum + eventTicks(e), 0)));
function isPickup(m: RecognizedMeasure): boolean {
  const expected = clamp(m.beats, 1, 32, 4) * 4 / ([1, 2, 4, 8, 16, 32].includes(m.beatType) ? m.beatType : 4) * DIVISIONS;
  const longest = longestVoice(m);
  return longest > 0 && longest < expected;
}
