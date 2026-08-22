#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-noaa-climate-enso": {
    url: "https://www.climate.gov/enso",
    accessedAt: "2026-08-22",
  },
  "web-eia-energy-explained": {
    url: "https://www.eia.gov/energyexplained/",
    accessedAt: "2026-08-22",
  },
  "web-fao-soil-portal": {
    url: "https://www.fao.org/soils-portal/en/",
    accessedAt: "2026-08-22",
  },
  "web-unesco-ocean-literacy": {
    url: "https://oceanliteracy.unesco.org/",
    accessedAt: "2026-08-22",
  },
  "web-bgs-discovering-geology": {
    url: "https://www.bgs.ac.uk/discovering-geology/",
    accessedAt: "2026-08-22",
  },
  "web-world-bank-urban-development": {
    url: "https://www.worldbank.org/en/topic/urbandevelopment",
    accessedAt: "2026-08-22",
  },
  "web-world-bank-water": {
    url: "https://www.worldbank.org/en/topic/water",
    accessedAt: "2026-08-22",
  },
  "web-world-bank-disaster-risk": {
    url: "https://www.worldbank.org/en/topic/disasterriskmanagement",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = {
  "geo-c1-enso-ocean-atmosphere-observation": "compulsory-1",
  "geo-c1-soil-profile-carbon-and-water": "compulsory-1",
  "geo-c1-geological-map-hazard-evidence": "compulsory-1",
  "geo-c2-urban-development-and-service-equity": "compulsory-2",
  "geo-c2-water-security-and-city-growth": "compulsory-2",
  "geo-c2-energy-industry-spatial-chain": "compulsory-2",
  "geo-s1-enso-seasonal-evidence": "selective-1",
  "geo-s1-geology-process-and-hazard-scale": "selective-1",
  "geo-s1-ocean-literacy-system-boundaries": "selective-1",
  "geo-s2-urban-resilience-and-regional-planning": "selective-2",
  "geo-s2-water-governance-and-cross-scale-evidence": "selective-2",
  "geo-s2-disaster-risk-map-and-exposure": "selective-2",
  "geo-s3-energy-transition-security-tradeoff": "selective-3",
  "geo-s3-soil-carbon-and-land-security": "selective-3",
  "geo-s3-disaster-risk-adaptation-capacity": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.22");
assert.equal(payload.sources.length, 161);
assert.equal(payload.items.length, 350);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v13 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v13 item ${itemId}`);
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
assert.deepEqual(Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])), {
  "compulsory-1": 3,
  "compulsory-2": 3,
  "selective-1": 3,
  "selective-2": 3,
  "selective-3": 3,
});

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: Object.keys(expectedItems).length,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
