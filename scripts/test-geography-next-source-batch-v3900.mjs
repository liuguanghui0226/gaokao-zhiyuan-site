#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-isr-field-app": {
    url: "https://github.com/isr-oeaw/isr-field-app",
    commitSha: "95ffd7095883ba851ceb4c5a80390b171b1645ce",
    accessedAt: "2026-08-24",
  },
  "github-family-history-migration-map": {
    url: "https://github.com/gamzeulu/family-history-migration-map",
    commitSha: "1ac747b74af36c146d77111e28b9b2be7f6724e9",
    accessedAt: "2026-08-24",
  },
  "github-wettstein-schulatlas-zurich": {
    url: "https://github.com/d33pk3rn3l/1887-wettstein-schulatlas-zurich",
    commitSha: "4b310545ad7eeb4de4fedd8e24b2dcd9b58a798c",
    accessedAt: "2026-08-24",
  },
  "github-everest-maps": {
    url: "https://github.com/amahjo/Everest-maps",
    commitSha: "70f7ce0de7d5e41c14e5a4f45e157b222ec06a22",
    accessedAt: "2026-08-24",
  },
  "github-geospatial-school-mapping": {
    url: "https://github.com/alphacrypto246/Geospatial-School-Mapping",
    commitSha: "fdb20ee2624487abe613c2b6beccaca19eac6f6c",
    accessedAt: "2026-08-24",
  },
  "web-national-archives-education": {
    url: "https://www.nationalarchives.gov.uk/education/",
    accessedAt: "2026-08-24",
  },
  "web-owid-population-density": {
    url: "https://ourworldindata.org/grapher/population-density",
    accessedAt: "2026-08-24",
  },
  "web-un-geospatial": {
    url: "https://www.un.org/geospatial/",
    accessedAt: "2026-08-24",
  },
};

const expectedItems = {
  "geo-c1-fieldwork-sampling-coordinate-uncertainty": "compulsory-1",
  "geo-c1-historical-atlas-landscape-change": "compulsory-1",
  "geo-c1-geospatial-layer-and-natural-process-evidence": "compulsory-1",
  "geo-c2-student-migration-atlas-and-place-identity": "compulsory-2",
  "geo-c2-population-density-denominator-and-comparison": "compulsory-2",
  "geo-c2-school-accessibility-and-public-service-gap": "compulsory-2",
  "geo-s1-fieldwork-coordinate-system-and-error": "selective-1",
  "geo-s1-historical-map-projection-and-generalization": "selective-1",
  "geo-s1-density-log-scale-and-visualization": "selective-1",
  "geo-s2-community-migration-mapping-and-ethics": "selective-2",
  "geo-s2-education-accessibility-network-and-service-area": "selective-2",
  "geo-s2-national-geospatial-layer-and-regional-planning": "selective-2",
  "geo-s3-aggregated-fieldwork-data-and-privacy": "selective-3",
  "geo-s3-historical-map-resource-environment-change": "selective-3",
  "geo-s3-population-density-and-urban-rural-equity": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.39");
assert.equal(payload.sources.length, 271);
assert.equal(payload.items.length, 605);

for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = payload.sources.find((candidate) => candidate.id === sourceId);
  assert.ok(source, `missing v39 source ${sourceId}`);
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
  assert.ok(item, `missing v39 item ${itemId}`);
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
