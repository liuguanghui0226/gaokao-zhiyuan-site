#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-noaa-climate-at-a-glance": {
    url: "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series",
    accessedAt: "2026-08-22",
  },
  "web-nasa-climate-global-temperature": {
    url: "https://climate.nasa.gov/vital-signs/global-temperature/",
    accessedAt: "2026-08-22",
  },
  "web-fao-food-systems": {
    url: "https://www.fao.org/food-systems/en/",
    accessedAt: "2026-08-22",
  },
  "web-fao-faostat": {
    url: "https://www.fao.org/faostat/en/#data",
    accessedAt: "2026-08-22",
  },
  "github-geocompr": {
    url: "https://github.com/geocompx/geocompr",
    commitSha: "8af05b03088b99c9415ae61b1c46be2b0915a03a",
    accessedAt: "2026-08-22",
  },
  "github-geo-python-course": {
    url: "https://github.com/geo-python/site",
    commitSha: "760ec36314cbaf5f7257feee23281b2eece261e7",
    accessedAt: "2026-08-22",
  },
  "github-geemap": {
    url: "https://github.com/giswqs/geemap",
    commitSha: "32cd563d38089d344d91accc4273900d02777ac6",
    accessedAt: "2026-08-22",
  },
  "github-leafmap": {
    url: "https://github.com/giswqs/leafmap",
    commitSha: "18df7ee48cb27a194d89568c389a3f98443b8e8b",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = {
  "geo-c1-climate-observation-scale": "compulsory-1",
  "geo-c1-global-temperature-process-chain": "compulsory-1",
  "geo-c1-food-system-natural-base": "compulsory-1",
  "geo-c2-food-system-value-chain": "compulsory-2",
  "geo-c2-faostat-indicator-comparison": "compulsory-2",
  "geo-c2-open-geospatial-map-workflow": "compulsory-2",
  "geo-s1-climate-time-series-variability": "selective-1",
  "geo-s1-temperature-anomaly-energy-balance": "selective-1",
  "geo-s1-geocomputation-raster-vector-evidence": "selective-1",
  "geo-s2-geopython-reproducible-analysis": "selective-2",
  "geo-s2-geemap-remote-sensing-workflow": "selective-2",
  "geo-s2-leafmap-interactive-layer-scale": "selective-2",
  "geo-s3-food-systems-resource-resilience": "selective-3",
  "geo-s3-faostat-definition-time-series": "selective-3",
  "geo-s3-geospatial-reproducibility-attribution": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.23");
assert.equal(payload.sources.length, 166);
assert.equal(payload.items.length, 365);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v14 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v14 item ${itemId}`);
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
