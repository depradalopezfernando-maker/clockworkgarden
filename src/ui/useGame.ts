/**
 * useGame.ts — the React binding to the external store (ADR-0003).
 *
 * `useSyncExternalStore` is the React 18+ primitive built for exactly this: an
 * external mutable source rendered safely under concurrent mode. The store
 * returns a stable snapshot reference, so this does not loop.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { gameStore } from '@game/store';
import type { GameState } from '@sim/state';

export function useGameState(): GameState {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, gameStore.getSnapshot);
}

export function useGameStatus() {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getStatus, gameStore.getStatus);
}

/**
 * Boot the game once: load the save (applying offline progress), start the loop,
 * and wire the events that must not lose progress - tab hidden and page unload.
 */
export function useGameRuntime(): void {
  useEffect(() => {
    gameStore.load();
    gameStore.start();

    const saveNow = () => {
      gameStore.save();
    };

    // `visibilitychange` is the reliable one on mobile, where `beforeunload`
    // frequently never fires because the OS kills the tab outright.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', saveNow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', saveNow);
      gameStore.save();
      gameStore.stop();
    };
  }, []);
}
