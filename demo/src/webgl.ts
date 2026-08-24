/**
 * Does this machine give up a WebGL context at all?
 *
 * A headless CI runner does not, and neither does a work laptop with hardware
 * acceleration switched off, or a browser with a privacy extension that blocks
 * the fingerprinting surface. Three.js answers that by throwing during render,
 * which on this page would replace the scene with an uncaught error and a
 * blank rectangle.
 *
 * React Three Fiber's own `fallback` prop does not help: it is canvas alt
 * content, rendered when the canvas cannot be rendered by the browser, not a
 * guard against a refused context. So the check happens here, before a Canvas
 * is mounted at all, and the page says what happened instead.
 */
function detect(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'))
  } catch {
    // Some privacy extensions throw from getContext rather than returning null.
    return false
  }
}

export const WEBGL_AVAILABLE = detect()
