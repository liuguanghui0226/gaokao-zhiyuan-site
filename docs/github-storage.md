# GitHub Storage Layout

The repository contains the site code, importer scripts, tests, documentation,
small import summaries, and data manifests. It deliberately excludes local
rollback copies, the 1GB-plus master knowledge JSON, and raw official evidence
packages. The current release's compressed browser core and province shards are
the exception: they are deployed inside `site/data/release-v3.275/` so GitHub
Pages reads them from the same origin without a cross-origin dependency.
The local static preview uses that same compressed runtime, so it does not need
an additional uncompressed 1GB-plus browser-data copy.

Each verified runtime version has a GitHub Release named
`data-v<version>`. The release stores:

- `knowledge-v<version>.json.gz`: canonical master knowledge data used to
  rebuild `site/data/knowledge-core.json` and every province shard.
- `official-provenance-v<version>.tar.gz`: raw official source evidence plus
  structured import payloads required for an offline audit.
- `runtime-release-manifest-v<version>.json`: SHA-256, sizes, model version,
  source counts, and restore instructions.

Use `node scripts/restore-runtime-from-github-release.mjs` after cloning to
download the master asset, verify its manifest byte count, SHA-256 and gzip
integrity, then atomically restore the hard-linked local master and rebuild
browser shards. `--verify path/to/asset.gz` performs the same check without
changing the local runtime. The release is the immutable data layer; it does
not turn a school-official source into a province-level formal admission table.

The default release repository is
`liuguanghui0226/gaokao-zhiyuan-site`. The immutable `data-v3.275` base assets
were migrated from the earlier account on 2026-07-16 and verified by size and
SHA-256 before the temporary transfer files were removed. Current incremental
runtime changes remain in the repository's compressed core and 31 province
shards, with a separate `evidence-v<version>` release for each verified wave.
The current incremental evidence release is `evidence-v3.296`; its Guizhou 2026
archive contains 22 files, is 6,479,872 bytes, and has SHA-256
`979e6857cce41953824a53231917a5681fbedbacd3351fdda7ab9c98f50079ea`.
The asset was downloaded again from GitHub after upload and matched byte for byte.

`scripts/serve.mjs` defaults to the internal APFS site root. Set
`GAOKAO_MIRROR_SITE_ROOT` only for an explicitly approved mirror read; this
keeps ordinary local previews off the external drive.
