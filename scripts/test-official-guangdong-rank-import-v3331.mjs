#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/official-guangdong-rank-conversion-2025-v3331-import.json")));
assert.equal(payload.dataset, "official-guangdong-rank-conversion-2025-v3331-import");
assert.equal(payload.rankConversions.length, 2342);
assert.deepEqual(payload.audit.usageRecords, { undergraduate: 1171, vocational: 1171 });
assert.deepEqual(payload.audit.pdfPages, { "历史类": 9, "物理类": 12 });
assert.deepEqual(payload.audit.rankUsageBucketDifferences, { "历史类": 399, "物理类": 422 });
assert.equal(payload.audit.mirrorZipByteIdentical, true);
assert.equal(payload.sourceNotes[0].provenance.officialZipSha256, "4ea71224f86c9843c60ce4f666762dcc1bb90ae48451db702bd8f434b2c9015a");
assert.equal(payload.sourceNotes[0].provenance.officialZipSha256, payload.sourceNotes[0].provenance.mirrorZipSha256);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 2342);
assert.ok(payload.rankConversions.every((row) => ["undergraduate", "vocational"].includes(row.rankUsage)));
console.log(JSON.stringify({ status: "ok", records: 2342, mirrorZipByteIdentical: true }, null, 2));
