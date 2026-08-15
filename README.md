# Fade Signal — Draft-Day Kit

An offline-capable PWA for running live fantasy football snake drafts on iPad. Prep online, draft offline.

See [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) for the full specification and [`docs/FEATURE_SUMMARY.md`](docs/FEATURE_SUMMARY.md) for the one-page feature checklist.

## Development

```bash
npm install
npm run dev
```

## Build order

Following the spec's milestones (§8): M1 skeleton/design-system/storage → M2 data pipeline → M3 live draft board → M4 decision aids → M5 player context → M6 personal board → M7 post-draft.
