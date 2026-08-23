#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-usgs-water-cycle": {
    url: "https://www.usgs.gov/special-topics/water-science-school/science/water-cycle",
    accessedAt: "2026-08-22",
  },
  "web-usgs-groundwater": {
    url: "https://www.usgs.gov/special-topics/water-science-school/science/groundwater",
    accessedAt: "2026-08-22",
  },
  "web-usgs-earthquake-hazards": {
    url: "https://www.usgs.gov/programs/earthquake-hazards",
    accessedAt: "2026-08-22",
  },
  "web-unhabitat-world-cities-report": {
    url: "https://unhabitat.org/wcr/",
    accessedAt: "2026-08-22",
  },
  "web-unep-global-resources-outlook": {
    url: "https://www.unep.org/resources/Global-Resources-Outlook-2024",
    accessedAt: "2026-08-22",
  },
  "web-fao-biodiversity": {
    url: "https://www.fao.org/biodiversity/en/",
    accessedAt: "2026-08-22",
  },
  "github-gis-oer-works": {
    url: "https://github.com/gis-oer/works",
    commitSha: "db253fe9cece5fe4ba0570c6d901468911f0adac",
    accessedAt: "2026-08-22",
  },
  "github-apa-urban-planning-resources": {
    url: "https://github.com/APA-Technology-Division/urban-and-regional-planning-resources",
    commitSha: "b9234b6708ceb64511b63d3b14de2dacd7443d19",
    accessedAt: "2026-08-22",
  },
};

const expectedItems = {
  "geo-c1-water-cycle-pathway-and-runoff": "compulsory-1",
  "geo-c1-groundwater-recharge-and-landform": "compulsory-1",
  "geo-c1-earthquake-hazard-exposure-and-intensity": "compulsory-1",
  "geo-c2-urban-network-and-urban-rural-flow": "compulsory-2",
  "geo-c2-regional-industry-and-logistics-choice": "compulsory-2",
  "geo-c2-agricultural-landscape-and-biodiversity": "compulsory-2",
  "geo-s1-global-circulation-and-seasonal-precipitation": "selective-1",
  "geo-s1-karst-landscape-water-rock-interaction": "selective-1",
  "geo-s1-ecosystem-services-and-natural-geography-integrity": "selective-1",
  "geo-s2-urban-land-use-conflict-and-planning-scale": "selective-2",
  "geo-s2-gis-hazard-map-and-community-evidence": "selective-2",
  "geo-s2-regional-data-catalog-and-scale-traceability": "selective-2",
  "geo-s3-circular-resource-use-and-material-security": "selective-3",
  "geo-s3-biodiversity-ecosystem-services-and-food-security": "selective-3",
  "geo-s3-urban-resilience-and-equity-governance": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.23.31");
assert.equal(payload.sources.length, 213);
assert.equal(payload.items.length, 485);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v16 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|仅作/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v16 item ${itemId}`);
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
