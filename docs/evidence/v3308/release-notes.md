# v3.308 Evidence Release

This evidence package preserves 155 Wuhan Textile University official province-year query pages, the official raw manifest, 2021-2025 structured major-admission rows, source-summary reconciliation, runtime manifests, coverage audit, 31 province gzip shards, scoped importer and tests, and desktop/mobile public-site screenshots.

## Runtime

- Model: `local-deterministic-v3.308-national-school-official-wtu2021-2025-native-rank-857225records`
- Structured records: 857225
- Rank conversions: 116656
- Source notes: 5113
- New WTU records: 2222 across all 31 mainland province scopes and five admission years
- School-recorded min-score ranks: 1921
- Rank unavailable: 301
- Ordinary `school-official-only`: 1633
- Isolated `special-path-only`: 589

## Acceptance

- Local release suite: 45 tests passed
- GitHub Pages deployment run: `29631373359`
- Independent public live verification run: `29631522058`
- Public workflow verified the homepage, core index, all 31 province shards, the Jiangxi WTU native-rank sample, Xizang rank-unavailable boundaries, and prior official control lines
- Desktop 1440x1000 and mobile 390x844: recommendation rendered, WTU evidence visible, no horizontal overflow, no page-console errors

School-official scores and ranks remain single-school evidence. They do not replace province examination-authority full filing/admission tables and do not independently establish admission probability. The 17 Xizang WTU records have no A/B category or published rank and do not close the province-wide evidence gap.
