#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-secondary-geography-course": {
    url: "https://github.com/OCTRYA/course_geography",
    commitSha: "29b6670da7dfc3d3df87d553bc4b0ca70387258a",
    accessedAt: "2026-08-22",
  },
  "github-opengis-curriculum": {
    url: "https://github.com/opengisci/opengisci.github.io",
    commitSha: "701bf47428310323fc3b851c837049e91abba6c2",
    accessedAt: "2026-08-22",
  },
  "github-school-geography-maps": {
    url: "https://github.com/wlbirula/szkolnemapy",
    commitSha: "98624095fe75ca617f5ce071460b2a9c2b2618bd",
    accessedAt: "2026-08-22",
  },
  "web-unccd-desertification": {
    url: "https://www.unccd.int/land-and-life/desertification",
    accessedAt: "2026-08-22",
  },
  "web-nsidc-glaciers": {
    url: "https://nsidc.org/learn/parts-cryosphere/glaciers",
    accessedAt: "2026-08-22",
  },
  "web-fao-aquastat": {
    url: "https://www.fao.org/aquastat/en/",
    accessedAt: "2026-08-22",
  },
  "web-un-climate-science": {
    url: "https://www.un.org/en/climatechange/science/climate-issues",
    accessedAt: "2026-08-22",
  },
  "web-owid-population-growth": {
    url: "https://ourworldindata.org/population-growth",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = {
  "geo-c1-groundwater-overdraft-subsidence": "compulsory-1",
  "geo-c1-glacier-runoff-seasonality": "compulsory-1",
  "geo-c1-desertification-wind-water-erosion": "compulsory-1",
  "geo-c2-population-growth-age-demand": "compulsory-2",
  "geo-c2-rural-urban-service-access": "compulsory-2",
  "geo-c2-map-atlas-scale-distortion": "compulsory-2",
  "geo-s1-greenhouse-radiative-balance": "selective-1",
  "geo-s1-glacier-mass-balance-climate-evidence": "selective-1",
  "geo-s1-aquastat-water-balance-indicators": "selective-1",
  "geo-s2-desertification-monitoring-restoration": "selective-2",
  "geo-s2-open-gis-curriculum-evidence-chain": "selective-2",
  "geo-s2-school-map-comparative-reading": "selective-2",
  "geo-s3-water-withdrawal-accounting-security": "selective-3",
  "geo-s3-climate-action-mitigation-adaptation": "selective-3",
  "geo-s3-population-resource-pressure": "selective-3",
};

assert.match(payload.version, /^geo-2026\.08\.22\.\d+$/);
assert.ok(payload.sources.length >= 80);
assert.ok(payload.items.length >= 200);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v12 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.equal(source.accessedAt, expected.accessedAt);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v12 item ${itemId}`);
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
