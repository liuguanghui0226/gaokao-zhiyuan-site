#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-omu-musubouar-disaster-education": {
    url: "https://github.com/omu-geolab/musubouAR",
    commitSha: "d4528c459bf03fcbf19e14e1c08eda788ecc9332",
    accessedAt: "2026-08-23",
  },
  "github-earthai-earth-science-platform": {
    url: "https://github.com/Ethos2022/EarthAi",
    commitSha: "c312be45dd728aec0c6b77b2f461c19ba811fccd",
    accessedAt: "2026-08-23",
  },
  "github-foss-geospatial-science-education": {
    url: "https://github.com/wenzeslaus/foss-in-geospatial-science-education",
    commitSha: "5d5a0faaa2ab1e8b1f18885f46c701dfa2036989",
    accessedAt: "2026-08-23",
  },
  "github-gitenberg-commercial-geography-high-school": {
    url: "https://github.com/GITenberg/Commercial-GeographyA-Book-for-High-Schools-Commercial-Courses-and-Business-Colleges_24884",
    commitSha: "43bf9b196fbf5b81f646114b823293f0d24026ec",
    accessedAt: "2026-08-23",
  },
  "web-iom-world-migration-report": {
    url: "https://worldmigrationreport.iom.int/",
    accessedAt: "2026-08-23",
  },
  "web-unhabitat-urban-data": {
    url: "https://data.unhabitat.org/",
    accessedAt: "2026-08-23",
  },
  "web-census-statistics-in-schools": {
    url: "https://www.census.gov/programs-surveys/sis.html",
    accessedAt: "2026-08-23",
  },
  "web-noaa-coastal-issues": {
    url: "https://oceanservice.noaa.gov/education/tutorial_coastal_issues/welcome.html",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-coastal-processes-and-risk-chain": "compulsory-1",
  "geo-c1-disaster-walk-and-layered-map": "compulsory-1",
  "geo-c1-earth-system-model-evidence": "compulsory-1",
  "geo-c2-migration-stock-flow-and-scale": "compulsory-2",
  "geo-c2-urban-indicator-and-spatial-equity": "compulsory-2",
  "geo-c2-census-data-and-population-structure": "compulsory-2",
  "geo-s1-coastal-observation-and-process-scale": "selective-1",
  "geo-s1-open-geospatial-education-workflow": "selective-1",
  "geo-s1-earth-science-model-and-uncertainty": "selective-1",
  "geo-s2-migration-network-and-regional-comparison": "selective-2",
  "geo-s2-urban-data-comparison-and-governance": "selective-2",
  "geo-s2-commercial-geography-and-supply-chain": "selective-2",
  "geo-s3-climate-migration-and-security": "selective-3",
  "geo-s3-coastal-ecosystem-resilience": "selective-3",
  "geo-s3-disaster-scenario-and-field-verification": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.39");
assert.equal(payload.sources.length, 271);
assert.equal(payload.items.length, 605);

const sources = new Map(payload.sources.map((source) => [source.id, source]));
for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = sources.get(sourceId);
  assert.ok(source, `missing v34 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|未声明|无统一|公开|许可|public domain/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v34 item ${itemId}`);
  assert.equal(item.courseId, courseId);
  assert.equal(item.licenseStatus, "citation-only");
  assert.equal(item.reviewStatus, "reviewed");
  assert.ok(item.summary.length >= 60 && item.summary.length <= 500);
  assert.ok(item.keywords.length >= 4);
  assert.ok(item.evidence.length >= 2);
  assert.ok(item.evidence.some((evidence) => Object.hasOwn(expectedSources, evidence.sourceId)));
  assert.ok(item.evidence.some((evidence) => evidence.sourceId.startsWith("pep-geography-")));
  assert.ok(item.sourceIds.some((sourceId) => sourceId.startsWith("pep-geography-")));
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
