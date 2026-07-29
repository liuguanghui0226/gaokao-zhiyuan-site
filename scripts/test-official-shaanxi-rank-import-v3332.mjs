#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/official-shaanxi-rank-conversion-2025-v3332-import.json")));
assert.equal(payload.dataset, "official-shaanxi-rank-conversion-2025-v3332-import");
assert.equal(payload.rankConversions.length, 1143);
assert.equal(payload.audit.usableRankRecords, 1141);
assert.equal(payload.audit.lowerAbsentAggregateRecords, 2);
assert.equal(payload.audit.comparedDualDomainCells, 3429);
assert.equal(payload.audit.dualDomainDifferences, 0);
assert.equal(payload.audit.cumulativeArithmeticErrors, 0);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 1143);
assert.equal(payload.rankConversions.filter((row) => row.rankEstimateUsable === false).length, 2);
assert.ok(payload.rankConversions.filter((row) => row.rankEstimateUsable === false).every((row) => row.containsAbsentCandidates === true));
assert.equal(payload.sourceNotes[0].policyBonusStatus, "authority-page-not-explicit");
assert.equal(payload.sourceNotes[0].provenance["shaanxi-rank-history-2025-official.html"].sha256, "b8ba4c8e0d3f5fb847421af782564573cf7125d8d767731c2fede7853da32f80");
assert.equal(payload.sourceNotes[0].provenance["shaanxi-rank-physics-2025-official.html"].sha256, "b7856db31c036f4c5f004c247c27a0d62613f26c13eac4657b15c6786fa2f6b0");
console.log(JSON.stringify({ status: "ok", records: 1143, usable: 1141, guarded: 2 }, null, 2));
