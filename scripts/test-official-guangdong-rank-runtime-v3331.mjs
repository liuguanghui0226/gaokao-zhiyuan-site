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
const shard = read("guangdong.json.gz");
const version = "local-deterministic-v3.331-guangdong-official-rank2025-dual-level-bonus-full-table-aligned-868426records";
assert.equal(core.modelVersion, version);
assert.equal(manifest.modelVersion, version);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 132497);
assert.equal(manifest.rankConversionCount, 132497);
assert.equal(manifest.shards["广东"].rankConversions, 11158);
assert.equal(shard.rankConversions.length, 11158);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === "official-guangdong-rank-2025-v3331").length, 2342);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5135);
assert.deepEqual(
  [core.admissionScoreLayer.rankSourceCoverage.sources, core.admissionScoreLayer.rankSourceCoverage.parsedSources],
  [220, 154],
);
assert.deepEqual(
  [core.admissionScoreLayer.rankSourceCoverage.queuedSources, core.admissionScoreLayer.rankSourceCoverage.supersededSources],
  [64, 2],
);
const coverage2025 = core.admissionScoreLayer.rankSourceCoverage.byYear.find((row) => row.year === 2025);
assert.deepEqual(
  [coverage2025.sources, coverage2025.parsedSources, coverage2025.queuedSources, coverage2025.parsedRecords],
  [86, 62, 22, 28844],
);
for (const id of ["dxsbb-rank-4aadc8d7d9", "dxsbb-rank-311e47f782"]) {
  const note = core.admissionScoreLayer.sourceNotes.find((row) => row.id === id);
  assert.equal(note.status, "superseded");
  assert.equal(note.supersededBy, "official-guangdong-rank-2025-v3331");
}
console.log(JSON.stringify({ status: "ok", modelVersion: version, ranks: 132497, sourceNotes: 5135 }, null, 2));
