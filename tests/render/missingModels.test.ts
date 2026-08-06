import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearModelCache, loadTemplate, missingModels } from '@render/models';
import { NullGardenView } from '@render/GardenView';

/**
 * The empty-diorama bug, pinned.
 *
 * `public/models/` is gitignored (rule 8), so anyone who clones the repo and
 * runs `npm run dev` without `npm run assets` gets a garden panel that draws a
 * sky and nothing else. That is expected. What was NOT expected — and what
 * actually cost a play session — is that it happened with a completely clean
 * console: `ThreeGardenView` catches every load failure so a missing prop cannot
 * take the game down, and the catch swallowed the diagnosis with it.
 *
 * These tests are about the diagnosis, not the rendering. They run under jsdom
 * with no WebGL, which is exactly the environment where a fetch for a `.glb`
 * fails, so the failure path is the one being exercised.
 */

describe('a model that cannot be loaded is RECORDED, not just thrown', () => {
  beforeEach(() => {
    clearModelCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearModelCache();
  });

  it('starts with nothing missing', () => {
    expect(missingModels()).toEqual([]);
  });

  it('records the name of a model that fails to load', async () => {
    await expect(loadTemplate('definitely-not-a-real-model')).rejects.toThrow();
    expect(missingModels()).toContain('definitely-not-a-real-model');
  });

  it('says what to do about it, exactly once however many models are missing', async () => {
    const error = console.error as unknown as ReturnType<typeof vi.fn>;

    await expect(loadTemplate('missing-one')).rejects.toThrow();
    await expect(loadTemplate('missing-two')).rejects.toThrow();
    await expect(loadTemplate('missing-three')).rejects.toThrow();

    // All three recorded...
    expect(missingModels()).toHaveLength(3);
    // ...but the console is not buried. Thirty-seven identical errors would hide
    // the one sentence that names the remedy.
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain('npm run assets');
  });

  it('is cleared by clearModelCache, so tests cannot leak into each other', async () => {
    await expect(loadTemplate('missing-again')).rejects.toThrow();
    expect(missingModels()).not.toEqual([]);
    clearModelCache();
    expect(missingModels()).toEqual([]);
  });
});

describe('the null view reports nothing missing', () => {
  it('does not tell a WebGL-less browser to go and stage assets', () => {
    // Two different problems with two different remedies. A browser that cannot
    // draw at all has no use for staged models, and telling its user to fetch
    // 0.42MB of glTF would be a wrong answer confidently given.
    const view = new NullGardenView();
    expect(view.active).toBe(false);
    expect(view.missingModels()).toEqual([]);
  });
});
