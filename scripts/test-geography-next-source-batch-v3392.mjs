#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/geography/knowledge.json"), "utf8"));

const expectedSources = {
  "web-nasa-sun": "https://science.nasa.gov/sun/",
  "web-nasa-solar-system": "https://science.nasa.gov/solar-system/",
  "web-usgs-geologic-time": "https://pubs.usgs.gov/gip/geotime/",
  "web-noaa-ocean-currents": "https://oceanservice.noaa.gov/education/tutorial_currents/01_intro.html",
  "web-unfpa-state-world-population": "https://www.unfpa.org/swp2023",
  "web-unesco-mab-programme": "https://www.unesco.org/en/mab",
};

const expectedItems = {
  "geo-c1-cosmic-environment-and-earth-habitability": "compulsory-1",
  "geo-c1-solar-activity-and-earth-systems": "compulsory-1",
  "geo-c1-geological-time-and-stratigraphic-evidence": "compulsory-1",
  "geo-c2-population-growth-capacity-and-scenario": "compulsory-2",
  "geo-c2-population-data-definition-and-scale": "compulsory-2",
  "geo-c2-cultural-landscape-and-human-environment": "compulsory-2",
  "geo-s1-solar-system-motion-and-observation-model": "selective-1",
  "geo-s1-ocean-current-density-and-climate": "selective-1",
  "geo-s1-geologic-time-sequence-and-landform": "selective-1",
  "geo-s2-cultural-landscape-and-regional-development": "selective-2",
  "geo-s2-population-scenario-and-regional-planning": "selective-2",
  "geo-s2-ocean-current-and-coastal-regional-evidence": "selective-2",
  "geo-s3-solar-activity-and-technology-resource-security": "selective-3",
  "geo-s3-geologic-time-and-resource-security": "selective-3",
  "geo-s3-ocean-current-and-marine-resource-safety": "selective-3",
};

assert.equal(payload.version, "geo-2026.08.24.39");
assert.equal(payload.sources.length, 271);
assert.equal(payload.items.length, 605);

const sources = new Map(payload.sources.map((source) => [source.id, source]));
for (const [sourceId, url] of Object.entries(expectedSources)) {
  const source = sources.get(sourceId);
  assert.ok(source, `missing v30 source ${sourceId}`);
  assert.equal(source.url, url);
  assert.equal(source.accessedAt, "2026-08-23");
  assert.match(source.licenseNote, /citation|原创|不复制|仅作|许可/i);
}

const items = new Map(payload.items.map((item) => [item.id, item]));
for (const [itemId, courseId] of Object.entries(expectedItems)) {
  const item = items.get(itemId);
  assert.ok(item, `missing v30 item ${itemId}`);
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
