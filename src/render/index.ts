/**
 * index.ts — the one place that decides whether the garden is drawn in 3D.
 *
 * Everything else holds a `GardenView` and does not care. Keeping the choice
 * here is what lets the 2D build stay a real, runnable target rather than a
 * claim in a document.
 */

import { NullGardenView, type GardenView } from './GardenView';

export type { GardenSnapshot, GardenView } from './GardenView';
export { NullGardenView } from './GardenView';

/**
 * Whether this browser can actually draw the diorama.
 *
 * Asked by creating a context and throwing it away, not by sniffing the user
 * agent: WebGL is disabled by policy, by extensions, by driver blocklists and
 * by headless flags far more often than it is genuinely absent, and none of
 * those show up in a UA string.
 */
export function supportsWebGl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * A view for this environment.
 *
 * The three.js module is imported dynamically so a browser that cannot use it
 * never downloads it — roughly 700KB that a fallback player would pay for and
 * never run.
 */
export async function createGardenView(): Promise<GardenView> {
  if (!supportsWebGl()) return new NullGardenView();
  try {
    const { ThreeGardenView } = await import('./ThreeGardenView');
    return new ThreeGardenView();
  } catch {
    return new NullGardenView();
  }
}
