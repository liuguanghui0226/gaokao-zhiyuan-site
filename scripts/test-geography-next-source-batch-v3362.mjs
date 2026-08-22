#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-sun-motion-visualization": {
    url: "https://github.com/ErnestThePoet/SunMotionVisualization",
    commitSha: "4081f94e260cfcb562bc014d44bd09b425919cb1",
    accessedAt: "2026-08-22",
  },
  "github-geowiki-high-school-geography": {
    url: "https://github.com/aeilot/GeoWiki",
    commitSha: "b89306acda2c70743434af61ecf1afae895bef0d",
    accessedAt: "2026-08-22",
  },
  "github-k12-gis-resources": {
    url: "https://github.com/kevinbhaynes/K-12_GIS_Resources",
    commitSha: "9e3eea5060ec04fb96af2aa807577fd6583d6cc2",
    accessedAt: "2026-08-22",
  },
  "web-noaa-jetstream-weather-school": {
    url: "https://www.noaa.gov/jetstream",
    accessedAt: "2026-08-22",
  },
  "web-national-geographic-water-cycle": {
    url: "https://education.nationalgeographic.org/resource/water-cycle/",
    accessedAt: "2026-08-22",
  },
  "web-nasa-world-of-change": {
    url: "https://science.nasa.gov/earth/earth-observatory/world-of-change/",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = new Set([
  "geo-c1-weather-radar-precipitation",
  "geo-c1-groundwater-recharge-discharge",
  "geo-c1-solar-surface-heating-and-energy",
  "geo-c1-land-cover-surface-feedback",
  "geo-c2-urban-expansion-and-land-use",
  "geo-c2-digital-map-evidence-for-community",
  "geo-c2-geography-wiki-knowledge-navigation",
  "geo-s1-sun-path-latitude-season",
  "geo-s1-air-mass-front-weather-map",
  "geo-s1-weather-radar-and-convective-risk",
  "geo-s2-land-cover-change-and-regional-planning",
  "geo-s2-k12-gis-layer-and-scale",
  "geo-s2-k12-gis-source-attribution",
  "geo-s2-geowiki-cross-course-concept-map",
  "geo-s3-water-cycle-and-resource-security",
  "geo-s3-remote-sensing-environmental-change",
  "geo-s3-extreme-weather-adaptation-chain",
  "geo-s3-resource-environment-map-attribution",
]);

assert.equal(payload.version, "geo-2026.08.22.8");
assert.equal(payload.sources.length, 46);
assert.equal(payload.items.length, 143);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v5 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const itemId of expectedItems) {
  const item = items.get(itemId);
  assert.ok(item, `missing v5 item ${itemId}`);
  assert.equal(item.licenseStatus, "citation-only");
  assert.equal(item.reviewStatus, "reviewed");
  assert.ok(item.summary.length >= 40 && item.summary.length <= 500);
  assert.ok(item.keywords.length >= 2);
  assert.ok(item.evidence.length >= 2);
  assert.ok(item.evidence.some((evidence) => Object.hasOwn(expectedSources, evidence.sourceId)));
}

const courseCounts = Object.groupBy([...expectedItems].map((id) => items.get(id)), (item) => item.courseId);
assert.deepEqual(Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])), {
  "compulsory-1": 4,
  "compulsory-2": 3,
  "selective-1": 3,
  "selective-2": 4,
  "selective-3": 4,
});

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: expectedItems.size,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
