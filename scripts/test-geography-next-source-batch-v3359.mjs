#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-nasa-el-nino": {
    url: "https://science.nasa.gov/earth/explore/el-nino/",
    accessedAt: "2026-08-22",
  },
  "web-nasa-gpm-water-cycle": {
    url: "https://gpm.nasa.gov/education/water-cycle",
    accessedAt: "2026-08-22",
  },
  "web-esa-copernicus-earth-observation": {
    url: "https://www.esa.int/Applications/Observing_the_Earth/Copernicus",
    accessedAt: "2026-08-22",
  },
  "web-fao-global-soil-partnership": {
    url: "https://www.fao.org/global-soil-partnership/en/",
    accessedAt: "2026-08-22",
  },
  "github-atlasgpt-secondary-geography": {
    url: "https://github.com/dayangac/AtlasGPT",
    commitSha: "6f01f956ba5e803f29c32e2ec9e2ff8638bc9745",
    accessedAt: "2026-08-22",
  },
  "github-terrain-explorer-africa": {
    url: "https://github.com/educatres/terrain-explorer-africa",
    commitSha: "129064bc3c73d30c94f0b3fb1374fe87ca1f7f08",
    accessedAt: "2026-08-22",
  },
  "github-intro-gispro": {
    url: "https://github.com/giswqs/intro-gispro",
    commitSha: "d4de649fefff14046a818aa3a7a05623015de9ed",
    accessedAt: "2026-08-22",
  },
};
const expectedItems = new Set([
  "geo-c1-water-cycle-observation",
  "geo-c1-soil-health-and-erosion",
  "geo-c1-africa-relief-river-ecology",
  "geo-c2-map-based-regional-evidence",
  "geo-c2-landscape-and-human-environment",
  "geo-s1-enso-wind-current-upwelling",
  "geo-s1-enso-teleconnection-precipitation",
  "geo-s1-water-cycle-evaporation-runoff",
  "geo-s2-copernicus-multisource-monitoring",
  "geo-s2-vector-raster-scale",
  "geo-s2-map-workflow-and-reproducibility",
  "geo-s2-protected-area-spatial-evidence",
  "geo-s2-sentinel-emergency-response",
  "geo-s3-soil-carbon-and-food-security",
  "geo-s3-soil-salinity-and-land-restoration",
  "geo-s3-enso-climate-risk-and-resources",
]);

assert.equal(payload.version, "geo-2026.08.22.9");
assert.equal(payload.sources.length, 54);
assert.equal(payload.items.length, 159);
for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v3 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const itemId of expectedItems) {
  const item = items.get(itemId);
  assert.ok(item, `missing v3 item ${itemId}`);
  assert.equal(item.licenseStatus, "citation-only");
  assert.equal(item.reviewStatus, "reviewed");
  assert.ok(item.summary.length >= 40 && item.summary.length <= 500);
  assert.ok(item.keywords.length >= 2);
  assert.ok(item.sourceIds.some((sourceId) => Object.hasOwn(expectedSources, sourceId)));
  assert.ok(item.evidence.length >= 2);
  assert.ok(item.evidence.some((evidence) => Object.hasOwn(expectedSources, evidence.sourceId)));
}

const courseCounts = Object.groupBy([...expectedItems].map((id) => items.get(id)), (item) => item.courseId);
assert.deepEqual(Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])), {
  "compulsory-1": 3,
  "compulsory-2": 2,
  "selective-1": 3,
  "selective-2": 5,
  "selective-3": 3,
});

console.log(JSON.stringify({
  ok: true,
  version: payload.version,
  addedSources: Object.keys(expectedSources).length,
  addedItems: expectedItems.size,
  courseCounts: Object.fromEntries(Object.entries(courseCounts).map(([courseId, entries]) => [courseId, entries.length])),
}, null, 2));
