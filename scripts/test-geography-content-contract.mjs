#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const filePath = path.join(projectRoot, "data", "geography", "knowledge.json");
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));

const REQUIRED_COURSES = new Set([
  "compulsory-1",
  "compulsory-2",
  "selective-1",
  "selective-2",
  "selective-3",
]);
const REQUIRED_ANCHORS = new Set([
  "geo-c1-atmospheric-heating",
  "geo-c2-agricultural-location",
  "geo-s1-climate-system",
  "geo-s2-regional-coordination",
  "geo-s3-food-security",
]);
const ALLOWED_LICENSE_STATES = new Set(["authored-summary", "citation-only"]);

assert.equal(typeof payload.version, "string");
assert.ok(payload.version.length > 0);
assert.ok(Array.isArray(payload.courses));
assert.ok(Array.isArray(payload.sources));
assert.ok(Array.isArray(payload.items));
assert.equal(payload.courses.length, REQUIRED_COURSES.size);
assert.deepEqual(new Set(payload.courses.map((course) => course.id)), REQUIRED_COURSES);

const sourceIds = new Set();
for (const source of payload.sources) {
  assert.equal(typeof source.id, "string");
  assert.ok(source.id.length > 0);
  assert.equal(sourceIds.has(source.id), false, `duplicate geography source ${source.id}`);
  sourceIds.add(source.id);
  assert.equal(typeof source.title, "string");
  assert.ok(source.title.length > 0);
  assert.equal(typeof source.publisher, "string");
  assert.ok(source.publisher.length > 0);
  assert.equal(typeof source.licenseNote, "string");
  assert.ok(source.licenseNote.length > 0);
}

const courseIds = new Set(payload.courses.map((course) => course.id));
const itemIds = new Set();
for (const item of payload.items) {
  assert.equal(typeof item.id, "string");
  assert.equal(itemIds.has(item.id), false, `duplicate geography item ${item.id}`);
  itemIds.add(item.id);
  assert.equal(courseIds.has(item.courseId), true, `unknown course ${item.courseId}`);
  assert.equal(typeof item.title, "string");
  assert.ok(item.title.length > 0);
  assert.equal(typeof item.summary, "string");
  assert.ok(item.summary.length >= 40);
  assert.ok(item.summary.length <= 500, `${item.id} summary is too long to be an authored summary`);
  assert.ok(Array.isArray(item.keywords) && item.keywords.length >= 2);
  assert.ok(Array.isArray(item.sourceIds) && item.sourceIds.length > 0);
  assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0);
  assert.ok(ALLOWED_LICENSE_STATES.has(item.licenseStatus));
  for (const sourceId of item.sourceIds) {
    assert.equal(sourceIds.has(sourceId), true, `${item.id} references unknown source ${sourceId}`);
  }
  for (const evidence of item.evidence) {
    assert.equal(sourceIds.has(evidence.sourceId), true, `${item.id} evidence references unknown source`);
    assert.match(String(evidence.locator), /第?\s*\d+\s*页/);
    assert.equal(typeof evidence.note, "string");
    assert.ok(evidence.note.length > 0);
  }
}

assert.ok(payload.items.length >= 25, "the initial curriculum slice must cover at least five items per course");
for (const anchor of REQUIRED_ANCHORS) {
  assert.equal(itemIds.has(anchor), true, `missing curriculum anchor ${anchor}`);
}

console.log(JSON.stringify({
  status: "ok",
  courses: payload.courses.length,
  sources: payload.sources.length,
  items: payload.items.length,
}, null, 2));
