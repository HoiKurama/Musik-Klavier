// Exit code 0 when dist/index.html is missing or older than the app sources, otherwise 1.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const newest = path => statSync(path).isDirectory() ? Math.max(0, ...readdirSync(path).map(name => newest(join(path, name)))) : statSync(path).mtimeMs;
const built = existsSync('dist/index.html') ? statSync('dist/index.html').mtimeMs : 0;
process.exit(['src', 'public', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json'].some(path => existsSync(path) && newest(path) > built) ? 0 : 1);
