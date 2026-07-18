# v3.310 Evidence Release

This evidence package preserves 373 Hangzhou Dianzi University official responses, the raw manifest, 2014-2025 structured major-admission rows, runtime manifests, the 31-province coverage audit, all 31 runtime gzip shards, scoped importer and tests, and desktop/mobile public-site screenshots.

## Runtime

- Model: `local-deterministic-v3.310-national-school-official-hdu2014-2025-admitted-count-866845records`
- Structured records: 866845
- Rank conversions: 116656
- Source notes: 5115
- New HDU records: 7463 across all 31 mainland province-level scopes and 12 admission years
- Official admitted-count records: 7463
- Rank unavailable: 7463; native and score-derived ranks: 0
- Ordinary `school-official-only`: 6059
- Isolated `special-path-only`: 1404
- Official response files: 373 across 372 province/year queries and 7463 source rows, with zero skipped rows and zero duplicate IDs

## Acceptance

- Local release suite: 51 tests passed
- GitHub Pages deployment run: `29639013920`
- Independent public live verification run: `29639159438`
- Public workflow verified the homepage, UI bundle, core index, all 31 province shards, HDU source metadata, Jiangxi/Xizang/Zhejiang HDU samples, rank-unavailable semantics, and special-path isolation
- Public Chrome QA at desktop 1440x1000 and mobile 390x844: HDU computer-science recommendation visible, official admitted count visible, horizontal overflow 0, console/page errors 0, failed requests 0, numeric admission-probability claims absent
- The admission overview now renders 24 representative school names plus the remaining count instead of inserting all 10538 names into the page; complete data remains available in province shards

The official HDU interface publishes subject label, batch, major, admitted count, minimum score, average score, and maximum score. It does not publish minimum admitted rank or major elective requirements. This release therefore keeps all 7463 HDU records rank-unavailable, does not derive ranks from scores, and does not treat source subject labels as elective requirements. School-official scores remain single-school evidence; they do not replace province examination-authority full filing/admission tables or independently establish admission probability.
