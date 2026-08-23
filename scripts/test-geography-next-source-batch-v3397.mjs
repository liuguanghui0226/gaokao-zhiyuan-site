#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "github-ap-human-geography-textbook": {
    url: "https://github.com/dmccreary/ap-human-geography",
    commitSha: "7652907ea71eeba431cb966082adaa3b4c91c33e",
    accessedAt: "2026-08-23",
  },
  "github-world-regional-geography-textbook": {
    url: "https://github.com/sounny/worldregionalgeography",
    commitSha: "67aefeb291ad8dacf40c223e02f674d771b101e0",
    accessedAt: "2026-08-23",
  },
  "github-python-gis-book": {
    url: "https://github.com/Python-GIS-book/site",
    commitSha: "ed1b78f7d9172c7cc647e67e8f95737faf89539c",
    accessedAt: "2026-08-23",
  },
  "web-un-world-population-prospects": {
    url: "https://population.un.org/wpp/",
    accessedAt: "2026-08-23",
  },
  "web-copernicus-data-space": {
    url: "https://dataspace.copernicus.eu/",
    accessedAt: "2026-08-23",
  },
  "web-mem-emergency-science": {
    url: "https://www.mem.gov.cn/kp/",
    accessedAt: "2026-08-23",
  },
  "web-mohurd-urban-rural-development": {
    url: "https://www.mohurd.gov.cn/gongkai/",
    accessedAt: "2026-08-23",
  },
  "web-cma-public-science": {
    url: "https://www.cma.gov.cn/kp/",
    accessedAt: "2026-08-23",
  },
};

const expectedItems = {
  "geo-c1-satellite-land-cover-change-evidence": "compulsory-1",
  "geo-c1-hazard-chain-and-emergency-response": "compulsory-1",
  "geo-c1-meteorological-observation-scale": "compulsory-1",
  "geo-c2-population-prospects-and-service-pressure": "compulsory-2",
  "geo-c2-world-regional-comparison-and-scale": "compulsory-2",
  "geo-c2-urban-rural-function-and-infrastructure": "compulsory-2",
  "geo-s1-remote-sensing-spectral-evidence-chain": "selective-1",
  "geo-s1-topographic-data-and-relief-profile": "selective-1",
  "geo-s1-atmospheric-observation-and-climate-normal": "selective-1",
  "geo-s2-demographic-scenario-and-regional-planning": "selective-2",
  "geo-s2-open-geospatial-data-reproducibility": "selective-2",
  "geo-s2-world-regional-case-comparison": "selective-2",
  "geo-s3-population-security-and-aging-response": "selective-3",
  "geo-s3-disaster-risk-governance-and-resilience": "selective-3",
  "geo-s3-satellite-monitoring-and-ecological-security": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.38");
assert.equal(payload.sources.length, 263);
assert.equal(payload.items.length, 590);

const sources = new Map(payload.sources.map((source) => [source.id, source]));
for (const [sourceId, expected] of Object.entries(expectedSources)) {
  const source = sources.get(sourceId);
  assert.ok(source, `missing v33 source ${sourceId}`);
  assert.equal(source.url, expected.url);
  assert.equal(source.accessedAt, expected.accessedAt);
  if (expected.commitSha) assert.equal(source.commitSha, expected.commitSha);
  assert.match(source.licenseNote, /citation|原创|不复制|未声明|无统一|公开|许可/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v33 item ${itemId}`);
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
