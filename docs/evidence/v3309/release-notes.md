# v3.309 Evidence Release

This evidence package preserves 718 Qilu University of Technology official API responses plus the raw manifest, 2021-2025 structured major-admission rows, runtime manifests, coverage audit, all 31 province gzip shards, scoped importer and tests, and desktop/mobile public-site screenshots.

## Runtime

- Model: `local-deterministic-v3.309-national-school-official-qlu2021-2025-native-rank-859382records`
- Structured records: 859382
- Rank conversions: 116656
- Source notes: 5114
- New QLU records: 2157 across 28 provinces with non-empty official rows and five admission years
- School-recorded min-score ranks: 2074
- Rank unavailable: 83
- Ordinary `school-official-only`: 1849
- Isolated `special-path-only`: 308
- Official response files: 718 across 297 score queries and 2157 source rows, with zero skipped rows and zero duplicate IDs

## Acceptance

- Local release suite: 48 tests passed
- GitHub Pages deployment run: `29635315254`
- Independent public live verification run: `29636289879`
- Public workflow verified the homepage, core index, all 31 province shards, the Jiangxi QLU native-rank sample, the three source-empty provinces, special-path isolation, and prior official controls/sources
- Desktop 1440x1000 and mobile 390x844: recommendation rendered, QLU evidence visible, no horizontal overflow, no page-console errors
- Public-site QA added city-preference scoring to visible admission options and keeps both the single-school evidence warning and missing-elective warning on QLU cards

The official score interface has province entries but no 2021-2025 score rows for Xizang, Qinghai, or Ningxia; the import therefore has 28 non-empty provinces, not 31-province score coverage. The interface also does not publish elective requirements or admitted counts, and this release does not fabricate either field. School-official scores and ranks remain single-school evidence; they do not replace province examination-authority full filing/admission tables or independently establish admission probability.
