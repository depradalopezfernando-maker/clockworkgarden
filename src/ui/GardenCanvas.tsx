import { useEffect, useRef, useState } from 'react';
import { createGardenView, type GardenSnapshot, type GardenView } from '@render/index';
import type { GameState } from '@sim/state';
import { isFrenzyActive } from '@sim/frenzy';

/**
 * The 3D garden.
 *
 * Owns the view's whole lifecycle and hands it a narrow snapshot on every
 * render. The view itself decides whether anything is drawn — on a browser
 * without WebGL this mounts a `NullGardenView` and the panel simply stays
 * empty, which is the documented 2D fallback rather than a broken canvas.
 *
 * React never touches the scene graph. `useSyncExternalStore` already
 * re-renders this component whenever the store publishes, so `update` is the
 * only bridge and three.js keeps its own animation loop (ADR-0003).
 */
export function GardenCanvas({ state }: { state: GameState }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<GardenView | null>(null);
  const [missing, setMissing] = useState(0);

  useEffect(() => {
    let disposed = false;
    let view: GardenView | null = null;

    void (async () => {
      const created = await createGardenView();
      // The effect can be torn down mid-await in StrictMode's double-mount, and
      // a view mounted after that would leak a canvas and an rAF loop forever.
      if (disposed || !hostRef.current) {
        created.dispose();
        return;
      }
      await created.mount(hostRef.current);
      if (disposed) {
        created.dispose();
        return;
      }
      view = created;
      viewRef.current = created;
      // Debug handle. Deliberate and tiny: it is how `npm run smoke` MEASURES
      // the draw-call budget instead of trusting a count of what the code meant
      // to create. Reading it changes nothing.
      (window as unknown as { __garden?: GardenView }).__garden = created;

      // Models load asynchronously and failures arrive over the following
      // frames, so this is polled briefly rather than read once. Stops as soon
      // as it finds anything, and gives up after a few seconds either way — a
      // healthy garden must not keep a timer alive for the whole session.
      let checks = 0;
      const poll = setInterval(() => {
        if (disposed) return clearInterval(poll);
        const count = created.missingModels().length;
        if (count > 0 || ++checks > 12) {
          setMissing(count);
          clearInterval(poll);
        }
      }, 400);
    })();

    return () => {
      disposed = true;
      view?.dispose();
      viewRef.current = null;
    };
  }, []);

  const snapshot: GardenSnapshot = {
    season: state.season,
    owned: state.owned,
    plotStages: state.kitchenGarden.plots.map((plot) => plot.stage),
    frenzied: isFrenzyActive(state.frenzy),
  };
  viewRef.current?.update(snapshot);

  return (
    <div className="garden-canvas" ref={hostRef} data-testid="garden-canvas">
      {missing > 0 && (
        <p className="garden-canvas__notice" data-testid="garden-missing-models">
          The garden’s models are not staged, so nothing is drawn here. Run{' '}
          <code>npm run assets</code> and reload. Nothing else in the game is affected.
        </p>
      )}
    </div>
  );
}
