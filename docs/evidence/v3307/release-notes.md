# v3.307 Evidence Release

This evidence package preserves the official Jiangxi University of Science and Technology source page, the extracted 2023-2025 major-admission rows, the structured import, runtime manifests, coverage audit, 31 province gzip shards, scoped importer and tests, and desktop/mobile public-site screenshots.

## Runtime

- Model: `local-deterministic-v3.307-national-school-official-jxust2023-2025-native-rank-855003records`
- Structured records: 855003
- Rank conversions: 116656
- Source notes: 5112
- New JXUST records: 2905 across all 31 mainland province scopes
- School-recorded min-score ranks: 2704
- Rank unavailable: 201
- Ordinary `school-official-only`: 2596
- Isolated `special-path-only`: 309

## Acceptance

- Local and clean-checkout release suite: 42 tests passed
- GitHub Pages deployment run: `29549188501`
- Public live verification run: `29549395436`
- Public readback: 36/36 files byte-identical to the published tree
- Desktop 1440x1000 and mobile 390x844: HTTP 200, recommendation rendered, no horizontal overflow, no console/page/request errors

School-official scores and ranks remain single-school evidence. They do not replace province examination-authority full filing/admission tables and do not independently establish admission probability.
