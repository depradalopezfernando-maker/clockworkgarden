import { SEASON_KEYS, SEASON_PALETTES, UI_PALETTE } from '@content/palette';

/**
 * Phase 0 placeholder. Renders the locked palette so the scaffold has something
 * to build and screenshot. Phase 2 replaces this with the real HUD.
 */
export function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: '3rem 1.5rem',
        background: UI_PALETTE.surface,
        color: UI_PALETTE.text,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Clockwork Garden</h1>
      <p style={{ color: UI_PALETTE.textMuted, marginTop: '0.5rem' }}>
        Phase 0 scaffold — palette locked, no game yet.
      </p>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem', maxWidth: '40rem' }}>
        {SEASON_KEYS.map((key) => {
          const palette = SEASON_PALETTES[key];
          return (
            <section key={key}>
              <h2
                style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: UI_PALETTE.textMuted,
                  margin: '0 0 0.4rem',
                }}
              >
                {key}
              </h2>
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
                {Object.entries(palette).map(([role, hex]) => (
                  <div
                    key={role}
                    title={`${role} ${hex}`}
                    style={{ background: hex, height: '3rem', flex: 1 }}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
