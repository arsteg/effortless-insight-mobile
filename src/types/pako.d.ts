/**
 * Minimal declaration for pako.
 *
 * pako ships no bundled types and @types/pako is not installed. Only `inflate`
 * is used (see utils/imageBrightness), so the surface is declared narrowly
 * rather than pulling in a dependency for one function.
 */
declare module 'pako' {
  export function inflate(data: Uint8Array): Uint8Array;
  /** Only used by tests, to build real PNG fixtures. */
  export function deflate(data: Uint8Array): Uint8Array;
  const pako: { inflate: typeof inflate; deflate: typeof deflate };
  export default pako;
}
