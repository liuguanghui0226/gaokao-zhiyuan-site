#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-deephydro-gisrs": {
    url: "https://github.com/DeepHydro/GISRS",
    commitSha: "e5d6fa243a91c7d8e17dbf3b85615ed2d97ad88e",
    accessedAt: "2026-08-24",
  },
  "github-cumt-gis": {
    url: "https://github.com/lovelydayss/CUMT-GIS",
    commitSha: "76a57dd8c308a1d0668602074d22898a241361eb",
    accessedAt: "2026-08-24",
  },
  "github-geovisualization-tutorial": {
    url: "https://github.com/sshuair/Geovisualization-Tutorial",
    commitSha: "576762f83f1edb26a786f315b41f8a0e31e7cc3e",
    accessedAt: "2026-08-24",
  },
  "github-spatialdb-nnu": {
    url: "https://github.com/solidjerryc/SpatialDB_NNU",
    commitSha: "d5379cc4f8434a9528bb4ceafe2720845fbebf83",
    accessedAt: "2026-08-24",
  },
  "github-gis-rs-2024fall": {
    url: "https://github.com/es-palloc/GIS-RS-2024Fall",
    commitSha: "ce360267826bdf8e9037ac0a4db5a4df1eb91374",
    accessedAt: "2026-08-24",
  },
  "web-openstreetmap-map-features": {
    url: "https://wiki.openstreetmap.org/wiki/Map_features",
    accessedAt: "2026-08-24",
  },
  "web-us-census-geographic-areas": {
    url: "https://www.census.gov/programs-surveys/geography/guidance/geo-areas.html",
    accessedAt: "2026-08-24",
  },
  "web-usgs-national-map": {
    url: "https://www.usgs.gov/programs/national-geospatial-program/national-map",
    accessedAt: "2026-08-24",
  },
};

const expectedItems = {
  "geo-c1-thematic-map-variable-and-symbol": "compulsory-1",
  "geo-c1-spatial-unit-and-scale-effect": "compulsory-1",
  "geo-c1-gis-rs-observation-workflow": "compulsory-1",
  "geo-c2-industrial-transport-network-location": "compulsory-2",
  "geo-c2-spatial-database-query-and-service-area": "compulsory-2",
  "geo-c2-geographic-unit-definition-and-comparison": "compulsory-2",
  "geo-s1-map-projection-symbolization-and-purpose": "selective-1",
  "geo-s1-spatial-database-layer-and-attribute-evidence": "selective-1",
  "geo-s1-gis-rs-preprocess-classify-and-verify": "selective-1",
  "geo-s2-visualization-choice-and-regional-narrative": "selective-2",
  "geo-s2-network-accessibility-and-spatial-query": "selective-2",
  "geo-s2-geographic-unit-scale-and-policy-comparison": "selective-2",
  "geo-s3-geospatial-data-governance-and-resource-security": "selective-3",
  "geo-s3-industrial-network-resilience-and-regional-equity": "selective-3",
  "geo-s3-map-evidence-uncertainty-and-decision-boundary": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.39");
assert.equal(payload.sources.length, 271);
assert.equal(payload.items.length, 605);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v38 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.equal(source.commitSha, expected.commitSha ?? undefined);
  if (expected.commitSha) {
    assert.ok(source.editionNote.includes(expected.commitSha), `${sourceId} edition note must repeat its commit SHA`);
  }
  assert.match(source.licenseNote, /citation|原创|不复制|仅作|未声明|公开|license|许可/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v38 item ${itemId}`);
  assert.equal(item.courseId, courseId);
  assert.equal(item.licenseStatus, "citation-only");
  assert.equal(item.reviewStatus, "reviewed");
  assert.ok(item.summary.length >= 60 && item.summary.length <= 500);
  assert.ok(item.keywords.length >= 4);
  assert.ok(item.evidence.length >= 2);
  assert.ok(item.evidence.some((evidence) => Object.hasOwn(expectedSources, evidence.sourceId)));
  assert.ok(item.evidence.some((evidence) => evidence.sourceId.startsWith("pep-geography-")));
}

const courseCounts = Object.groupBy(Object.values(expectedItems), (courseId) => courseId);
assert.deepEqual(
  Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
  {
    "compulsory-1": 3,
    "compulsory-2": 3,
    "selective-1": 3,
    "selective-2": 3,
    "selective-3": 3,
  },
);

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: Object.keys(expectedItems).length,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
