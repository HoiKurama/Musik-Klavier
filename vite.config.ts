import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const OFFLINE_ASSETS = 'virtual:offline-assets';
const publicFile = (path: string) => new URL(`./public/${path}`, import.meta.url);

// Example score is always bundled. Piano samples are embedded only in the production build,
// so dist/index.html works without a server (double-click opens it via file://).
function offlineAssets(): Plugin {
  let embedSamples = false;
  return {
    name: 'klavierzeit-offline-assets',
    configResolved(config) { embedSamples = config.command === 'build'; },
    resolveId(id) { return id === OFFLINE_ASSETS ? `\0${OFFLINE_ASSETS}` : undefined; },
    load(id) {
      if (id !== `\0${OFFLINE_ASSETS}`) return;
      const example = readFileSync(publicFile('example.musicxml'), 'utf8');
      const samples: Record<string, string> = {};
      if (embedSamples) for (const file of readdirSync(publicFile('piano/')).filter(name => name.endsWith('.mp3'))) {
        samples[file.slice(0, -4)] = `data:audio/mpeg;base64,${readFileSync(publicFile(`piano/${file}`)).toString('base64')}`;
      }
      return `export const exampleScore = ${JSON.stringify(example)};\nexport const pianoSamples = ${JSON.stringify(samples)};`;
    },
  };
}

// Browsers block external module scripts on file:// pages, so JS and CSS are inlined into index.html.
function standaloneHtml(): Plugin {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    name: 'klavierzeit-standalone-html',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const page = bundle['index.html'];
        if (page?.type !== 'asset') return;
        let html = String(page.source);
        for (const [name, file] of Object.entries(bundle)) {
          if (file.type === 'chunk' && file.isEntry) {
            const code = file.code.replace(/<\/script/gi, '<\\/script');
            html = html.replace(new RegExp(`<script[^>]*src="[^"]*${escape(name)}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
            delete bundle[name];
          } else if (file.type === 'asset' && name.endsWith('.css')) {
            html = html.replace(new RegExp(`<link[^>]*href="[^"]*${escape(name)}"[^>]*>`), () => `<style>${String(file.source)}</style>`);
            delete bundle[name];
          }
        }
        page.source = html;
      },
    },
  };
}

// Relative base so the build also works under https://<user>.github.io/<repo>/ and from disk.
export default defineConfig({
  base: './',
  plugins: [offlineAssets(), standaloneHtml()],
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 8000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
