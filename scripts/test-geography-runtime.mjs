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
assert.equal(site.version, "geo-2026.08.22.14");
assert.equal(site.sources.length, 96);
assert.equal(site.items.length, 230);
assert.equal(site.sources.filter((sourceRecord) => /^https:\/\//.test(String(sourceRecord.url))).length, 75);
assert.equal(site.sources.filter((sourceRecord) => !/^https:\/\//.test(String(sourceRecord.url))).length, 21);
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
for (const itemId of [
  "geo-c1-groundwater-overdraft-subsidence",
  "geo-c1-glacier-runoff-seasonality",
  "geo-c1-desertification-wind-water-erosion",
  "geo-c2-population-growth-age-demand",
  "geo-c2-rural-urban-service-access",
  "geo-c2-map-atlas-scale-distortion",
  "geo-s1-greenhouse-radiative-balance",
  "geo-s1-glacier-mass-balance-climate-evidence",
  "geo-s1-aquastat-water-balance-indicators",
  "geo-s2-desertification-monitoring-restoration",
  "geo-s2-open-gis-curriculum-evidence-chain",
  "geo-s2-school-map-comparative-reading",
  "geo-s3-water-withdrawal-accounting-security",
  "geo-s3-climate-action-mitigation-adaptation",
  "geo-s3-population-resource-pressure",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v12 runtime item ${itemId}`);
}
for (const itemId of [
  "geo-c1-enso-ocean-atmosphere-observation",
  "geo-c1-soil-profile-carbon-and-water",
  "geo-c1-geological-map-hazard-evidence",
  "geo-c2-urban-development-and-service-equity",
  "geo-c2-water-security-and-city-growth",
  "geo-c2-energy-industry-spatial-chain",
  "geo-s1-enso-seasonal-evidence",
  "geo-s1-geology-process-and-hazard-scale",
  "geo-s1-ocean-literacy-system-boundaries",
  "geo-s2-urban-resilience-and-regional-planning",
  "geo-s2-water-governance-and-cross-scale-evidence",
  "geo-s2-disaster-risk-map-and-exposure",
  "geo-s3-energy-transition-security-tradeoff",
  "geo-s3-soil-carbon-and-land-security",
  "geo-s3-disaster-risk-adaptation-capacity",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v13 runtime item ${itemId}`);
}
for (const itemId of [
  "geo-c1-climate-observation-scale",
  "geo-c1-global-temperature-process-chain",
  "geo-c1-food-system-natural-base",
  "geo-c2-food-system-value-chain",
  "geo-c2-faostat-indicator-comparison",
  "geo-c2-open-geospatial-map-workflow",
  "geo-s1-climate-time-series-variability",
  "geo-s1-temperature-anomaly-energy-balance",
  "geo-s1-geocomputation-raster-vector-evidence",
  "geo-s2-geopython-reproducible-analysis",
  "geo-s2-geemap-remote-sensing-workflow",
  "geo-s2-leafmap-interactive-layer-scale",
  "geo-s3-food-systems-resource-resilience",
  "geo-s3-faostat-definition-time-series",
  "geo-s3-geospatial-reproducibility-attribution",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v14 runtime item ${itemId}`);
}
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
for (const sourceId of [
  "github-secondary-geography-course",
  "github-opengis-curriculum",
  "github-school-geography-maps",
  "web-unccd-desertification",
  "web-nsidc-glaciers",
  "web-fao-aquastat",
  "web-un-climate-science",
  "web-owid-population-growth",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v12 runtime source ${sourceId}`);
}
for (const sourceId of [
  "web-noaa-climate-enso",
  "web-eia-energy-explained",
  "web-fao-soil-portal",
  "web-unesco-ocean-literacy",
  "web-bgs-discovering-geology",
  "web-world-bank-urban-development",
  "web-world-bank-water",
  "web-world-bank-disaster-risk",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v13 runtime source ${sourceId}`);
}
for (const sourceId of [
  "web-noaa-climate-at-a-glance",
  "web-nasa-climate-global-temperature",
  "web-fao-food-systems",
  "web-fao-faostat",
  "github-geocompr",
  "github-geo-python-course",
  "github-geemap",
  "github-leafmap",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v14 runtime source ${sourceId}`);
}
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
