#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourcePath = path.join(projectRoot, "data", "geography", "knowledge.json");
const sitePath = path.join(projectRoot, "site", "data", "geography", "knowledge.json");
const indexPath = path.join(projectRoot, "site", "index.html");
const appPath = path.join(projectRoot, "site", "assets", "app.js");

assert.equal(fs.existsSync(sitePath), true, "the published site must contain geography data");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
assert.deepEqual(
  site,
  source,
  "site geography data must match the canonical source data",
);
assert.equal(site.version, "geo-2026.08.22.11");
assert.ok(site.items.some((item) => item.id === "geo-s3-marine-pollution-governance"));
assert.ok(site.items.some((item) => item.id === "geo-c2-city-radiation-and-economic-hinterland"));
assert.ok(site.items.some((item) => item.id === "geo-s2-gis-remote-sensing-evidence"));
assert.ok(site.items.some((item) => item.id === "geo-s3-ocean-acidification-carbon-cycle"));
assert.ok(site.items.some((item) => item.id === "geo-s1-tidal-current-estuary-dynamics"));
assert.ok(site.items.some((item) => item.id === "geo-s2-remote-sensing-spectral-resolution"));
assert.ok(site.items.some((item) => item.id === "geo-s3-ocean-acidification-food-security"));
assert.ok(site.items.some((item) => item.id === "geo-s1-enso-wind-current-upwelling"));
assert.ok(site.items.some((item) => item.id === "geo-s2-copernicus-multisource-monitoring"));
assert.ok(site.items.some((item) => item.id === "geo-s3-soil-carbon-and-food-security"));
assert.ok(site.items.some((item) => item.id === "geo-s3-carbon-cycle-reservoir-feedback"));
assert.ok(site.items.some((item) => item.id === "geo-s3-water-allocation-competing-uses"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "marine-disaster-reference-2017"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "marine-survey-reference-2017"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "web-noaa-tides-education"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "web-nasa-remote-sensing-earth-observatory"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "web-nasa-el-nino"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "web-esa-copernicus-earth-observation"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "github-atlasgpt-secondary-geography"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "github-open-geo-data-education"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "github-geog-510"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "github-openguessr-education"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "github-shanghai-high-school-lab"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "github-high-school-geography-notes"));
assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === "web-wmo-climate"));
assert.ok(site.items.filter((item) => item.licenseStatus === "citation-only").length >= 25);

const index = fs.readFileSync(indexPath, "utf8");
assert.match(index, /data-view="geography"/);
assert.match(index, /id="view-geography"/);

const app = fs.readFileSync(appPath, "utf8");
assert.match(app, /geography\/knowledge\.json/);
assert.match(app, /renderGeography/);
assert.match(app, /data-geography-course/);
assert.match(app, /sourceIds/);

console.log(JSON.stringify({ status: "ok", checked: ["data", "navigation", "renderer"] }, null, 2));
