import { mkdir, writeFile, access } from 'node:fs/promises';
const directory = new URL('../public/piano/', import.meta.url);
await mkdir(directory, { recursive: true });
const names = ['A0', ...Array.from({ length: 7 }, (_, i) => ['C', 'Ds', 'Fs', 'A'].map(n => n + (i + 1))).flat(), 'C8'];
let downloaded = 0;
for (const name of names) {
  const destination = new URL(`${name}.mp3`, directory);
  try { await access(destination); continue; } catch {}
  const response = await fetch(`https://tonejs.github.io/audio/salamander/${name}.mp3`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
  downloaded++;
}
console.log(`${names.length} lokale Klaviersamples bereit (${downloaded} heruntergeladen).`);
