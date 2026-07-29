#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const release = path.join(root, "site/data/release-v3.275");
const read = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(release, name))));
const core = read("knowledge-core.json.gz");
const manifest = read("manifest.json.gz");
const shard = read("shaanxi.json.gz");
const version = "local-deterministic-v3.337-admission-provenance-relative-rank-dedup-868426records";
assert.equal(core.modelVersion, version);
assert.equal(manifest.modelVersion, version);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(manifest.rankConversionCount, 133640);
assert.equal(manifest.shards["陕西"].rankConversions, 2306);
assert.equal(shard.rankConversions.length, 2306);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === "official-shaanxi-rank-2025-v3332").length, 1143);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.deepEqual(
  [core.admissionScoreLayer.rankSourceCoverage.sources, core.admissionScoreLayer.rankSourceCoverage.parsedSources],
  [221, 155],
);
assert.deepEqual(
  [core.admissionScoreLayer.rankSourceCoverage.queuedSources, core.admissionScoreLayer.rankSourceCoverage.supersededSources],
  [62, 4],
);
const coverage2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.deepEqual(
  [coverage2025.sources, coverage2025.parsedSources, coverage2025.queuedSources, coverage2025.supersededSources, coverage2025.parsedRecords],
  [87, 63, 20, 4, 29987],
);
for (const id of ["dxsbb-rank-39f42ed1c2", "dxsbb-rank-8bb3730424"]) {
  const note = core.admissionScoreLayer.sourceNotes.find((row) => row.id === id);
  assert.equal(note.status, "superseded");
  assert.equal(note.supersededBy, "official-shaanxi-rank-2025-v3332");
}
const note2026 = core.admissionScoreLayer.sourceNotes.find((row) => row.id === "official-shaanxi-rank-2026");
assert.equal(note2026.lowerAggregateEstimateGuard, true);
assert.equal(note2026.lowerAggregateGuardedRecords, 2);
console.log(JSON.stringify({ status: "ok", modelVersion: version, ranks: 133640, sourceNotes: 5136 }, null, 2));
