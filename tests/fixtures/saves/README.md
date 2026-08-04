# Frozen save fixtures

One file per save-schema version, captured at the moment that version shipped.

**Never edit a file in here.** They exist to prove that a save written by an old
build still loads in the current one (ADR-0004). Editing a fixture to make a test
pass defeats the entire mechanism — it would prove only that the current code can
read data the current code invented.

When the schema changes: bump `CURRENT_SAVE_VERSION`, add a migration keyed by
the version it upgrades _from_, add `v<N>.json` here, and leave every existing
file untouched.

`v3.json` was written to the v3 schema during Phase 5 rather than captured from a
running v3 build — Phase 4 shipped the v3 schema without freezing a fixture, and
the gap was found before anyone had a v3 save. Every other file here is a
verbatim capture. From v4 on, capture at ship time.
