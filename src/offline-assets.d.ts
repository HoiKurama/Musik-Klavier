declare module 'virtual:offline-assets' {
  /** Bundled example score (public/example.musicxml). */
  export const exampleScore: string;
  /** Embedded piano samples as data URLs in the production build; empty during development. */
  export const pianoSamples: Record<string, string>;
}
