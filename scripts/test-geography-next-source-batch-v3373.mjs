#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-nasa-earth-energy-budget": {
    url: "https://earthobservatory.nasa.gov/features/EnergyBalance",
    accessedAt: "2026-08-22",
  },
  "web-world-bank-migration": {
    url: "https://www.worldbank.org/en/topic/migration",
    accessedAt: "2026-08-22",
  },
  "web-world-bank-transport": {
    url: "https://www.worldbank.org/en/topic/transport",
    accessedAt: "2026-08-22",
  },
  "web-owid-urbanization": {
    url: "https://ourworldindata.org/urbanization",
    accessedAt: "2026-08-22",
  },
  "github-cielo-geoscience-k12": {
    url: "https://github.com/CIELO-G/geoscience-lesson-plans-k12",
    commitSha: "a858f8bd212a588a624b9aaf2ce6202ae6a8250c",
    accessedAt: "2026-08-22",
  },
  "github-ghist-high-school-geology": {
    url: "https://github.com/astaghitsa/ghist",
    commitSha: "26c29961ef4cd3b2a4df05db5efe378a83ebb29e",
    accessedAt: "2026-08-22",
  },
  "github-transport-geography-resources": {
    url: "https://github.com/paezha/Transport-Geography-Teaching-Resources",
    commitSha: "bfb40297ec7e05a0c42fc0015b66a368761ab7d7",
    accessedAt: "2026-08-22",
  },
  "github-biogeo-secondary-education": {
    url: "https://github.com/magdasmat/biogeo-logia",
    commitSha: "5bb58fb51fbe2b0cdd8a276d3172272cb770dbec",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = {
  "geo-c1-earth-energy-budget-system": "compulsory-1",
  "geo-c1-eco-hydrology-soil-plant-atmosphere": "compulsory-1",
  "geo-c1-seismic-wave-and-earthquake-evidence": "compulsory-1",
  "geo-c2-migration-labor-mobility-and-region": "compulsory-2",
  "geo-c2-urbanization-rate-and-spatial-scale": "compulsory-2",
  "geo-c2-transport-infrastructure-and-regional-links": "compulsory-2",
  "geo-s1-earth-energy-budget-feedback-boundary": "selective-1",
  "geo-s1-eco-hydrology-evapotranspiration-evidence": "selective-1",
  "geo-s1-plate-tectonics-seismic-wave-interpretation": "selective-1",
  "geo-s2-transport-network-accessibility-indicator": "selective-2",
  "geo-s2-secondary-geography-course-problem-chain": "selective-2",
  "geo-s2-school-geology-map-and-field-evidence": "selective-2",
  "geo-s3-migration-development-resource-security": "selective-3",
  "geo-s3-urbanization-resource-environment-security": "selective-3",
  "geo-s3-geoscience-hazard-community-resilience": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.18");
assert.equal(payload.sources.length, 129);
assert.equal(payload.items.length, 290);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v15 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v15 item ${itemId}`);
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
