#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-open-geo-data-education": {
    url: "https://github.com/andrea-ballatore/open-geo-data-education",
    commitSha: "a9f68c60b0088e1b34cfc35b985513cfdcaba05e",
    accessedAt: "2026-08-22",
  },
  "github-geog-510": {
    url: "https://github.com/giswqs/geog-510",
    commitSha: "c2d2d4948129684fb62fcea540f22b44f067b843",
    accessedAt: "2026-08-22",
  },
  "github-adaptive-geography": {
    url: "https://github.com/adaptive-learning/geography",
    commitSha: "b057df1b1bda02c8034167eceafb1cb176ed9165",
    accessedAt: "2026-08-22",
  },
  "github-openguessr-education": {
    url: "https://github.com/therealPaulPlay/OpenGuessrEducation",
    commitSha: "90bdfe814b49d01446eaa9be437275067a2da4ab",
    accessedAt: "2026-08-22",
  },
  "github-multitouch-geography-game": {
    url: "https://github.com/RobertoDebarba/multitouch-collaborative-educational-geography-game",
    commitSha: "805005660f485b188cfacfdd467ea432f1d94940",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = new Set([
  "geo-c1-dem-relief-and-drainage",
  "geo-c1-gridded-climate-surface",
  "geo-c2-population-grid-and-scale",
  "geo-c2-network-accessibility-and-hinterland",
  "geo-c2-map-reading-place-clues",
  "geo-s1-raster-resolution-and-natural-process",
  "geo-s1-elevation-profile-and-contour",
  "geo-s2-vector-raster-overlay-analysis",
  "geo-s2-reproducible-map-workflow",
  "geo-s2-map-scale-generalization",
  "geo-s3-environmental-indicator-crosscheck",
  "geo-s3-resource-security-data-freshness",
]);

assert.equal(payload.version, "geo-2026.08.22.8");
assert.equal(payload.sources.length, 46);
assert.equal(payload.items.length, 143);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v4 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.commitSha, expected.commitSha);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const itemId of expectedItems) {
  const item = items.get(itemId);
  assert.ok(item, `missing v4 item ${itemId}`);
  assert.equal(item.licenseStatus, "citation-only");
  assert.equal(item.reviewStatus, "reviewed");
  assert.ok(item.summary.length >= 40 && item.summary.length <= 500);
  assert.ok(item.keywords.length >= 2);
  assert.ok(item.evidence.length >= 2);
  assert.ok(item.evidence.some((evidence) => Object.hasOwn(expectedSources, evidence.sourceId)));
}

const courseCounts = Object.groupBy([...expectedItems].map((id) => items.get(id)), (item) => item.courseId);
assert.deepEqual(Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])), {
  "compulsory-1": 2,
  "compulsory-2": 3,
  "selective-1": 2,
  "selective-2": 3,
  "selective-3": 2,
});

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: expectedItems.size,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
