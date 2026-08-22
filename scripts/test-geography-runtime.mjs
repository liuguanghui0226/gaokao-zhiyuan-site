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
assert.equal(site.version, "geo-2026.08.23.23");
assert.equal(site.sources.length, 166);
assert.equal(site.items.length, 365);
assert.equal(site.sources.filter((sourceRecord) => /^https:\/\//.test(String(sourceRecord.url))).length, 144);
assert.equal(site.sources.filter((sourceRecord) => !/^https:\/\//.test(String(sourceRecord.url))).length, 22);
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
  "geo-c1-ecological-quality-indicator-reading",
  "geo-c1-meteorological-observation-and-weather-process",
  "geo-c1-high-school-natural-geography-knowledge-map",
  "geo-c2-natural-resources-statistical-comparison",
  "geo-c2-world-region-human-geography-knowledge-map",
  "geo-c2-textbook-outline-and-regional-case",
  "geo-s1-marine-ecosystem-and-sea-air-process",
  "geo-s1-satellite-observation-and-atmospheric-process",
  "geo-s1-natural-geography-knowledge-index",
  "geo-s2-island-ecosystem-monitoring-and-spatial-protection",
  "geo-s2-map-quest-and-spatial-reasoning",
  "geo-s2-regional-development-textbook-comparison",
  "geo-s3-ecological-quality-and-environmental-security",
  "geo-s3-marine-ecosystem-status-and-governance",
  "geo-s3-natural-resource-bulletin-and-security-indicators",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v18 runtime item ${itemId}`);
}
for (const itemId of [
  "geo-c1-national-geospatial-platform-map-scale",
  "geo-c1-earthquake-catalogue-risk-evidence",
  "geo-c1-forest-ecosystem-water-regulation",
  "geo-c2-population-census-structure-and-demand",
  "geo-c2-urbanization-statistical-indicator-chain",
  "geo-c2-transport-and-regional-connectivity-indicators",
  "geo-s1-global-circulation-seasonal-shift-model",
  "geo-s1-solar-altitude-time-zone-cross-check",
  "geo-s1-earthquake-plate-boundary-process",
  "geo-s2-tianditu-layer-scale-and-regional-planning",
  "geo-s2-forest-restoration-spatial-evidence",
  "geo-s2-circulation-model-and-monsoon-regional-case",
  "geo-s3-forest-resource-security-and-ecosystem-services",
  "geo-s3-statistical-bulletin-resource-environment-indicators",
  "geo-s3-earthquake-disaster-risk-and-resilience",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v19 runtime item ${itemId}`);
}
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
for (const itemId of [
  "geo-c1-earth-energy-budget-system",
  "geo-c1-eco-hydrology-soil-plant-atmosphere",
  "geo-c1-seismic-wave-and-earthquake-evidence",
  "geo-c2-migration-labor-mobility-and-region",
  "geo-c2-urbanization-rate-and-spatial-scale",
  "geo-c2-transport-infrastructure-and-regional-links",
  "geo-s1-earth-energy-budget-feedback-boundary",
  "geo-s1-eco-hydrology-evapotranspiration-evidence",
  "geo-s1-plate-tectonics-seismic-wave-interpretation",
  "geo-s2-transport-network-accessibility-indicator",
  "geo-s2-secondary-geography-course-problem-chain",
  "geo-s2-school-geology-map-and-field-evidence",
  "geo-s3-migration-development-resource-security",
  "geo-s3-urbanization-resource-environment-security",
  "geo-s3-geoscience-hazard-community-resilience",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v15 runtime item ${itemId}`);
}
for (const itemId of [
  "geo-c1-permafrost-activity-layer-water-cycle",
  "geo-c1-pm10-sand-dust-and-cold-air-observation",
  "geo-c1-geopark-fieldwork-and-geological-process",
  "geo-c2-mining-town-industrial-heritage-transition",
  "geo-c2-agricultural-rural-resource-base",
  "geo-c2-rural-revitalization-and-land-use-evidence",
  "geo-s1-upwelling-seasonality-and-walker-circulation",
  "geo-s1-sun-earth-moon-observation-model",
  "geo-s1-weather-climate-observation-source-selection",
  "geo-s2-geopark-conservation-and-regional-tourism",
  "geo-s2-environmental-monitoring-indicator-chain",
  "geo-s2-natural-resources-data-and-land-use-planning",
  "geo-s3-agricultural-resource-security-and-food-system",
  "geo-s3-environmental-monitoring-and-pollution-risk",
  "geo-s3-weather-warning-and-climate-risk-governance",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v20 runtime item ${itemId}`);
}
for (const itemId of [
  "geo-c1-river-basin-water-resource-observation",
  "geo-c1-geological-survey-map-and-landform-evidence",
  "geo-c1-tactile-map-scale-and-spatial-orientation",
  "geo-c2-transport-corridor-and-accessibility",
  "geo-c2-energy-industry-location-and-transition",
  "geo-c2-historical-map-and-regional-change",
  "geo-s1-river-basin-process-and-runoff-seasonality",
  "geo-s1-geological-map-and-plate-process-evidence",
  "geo-s1-marine-observation-and-coastal-change",
  "geo-s2-national-geospatial-data-and-regional-planning",
  "geo-s2-qgis-layer-overlay-and-field-verification",
  "geo-s2-map-education-collection-and-scale-comparison",
  "geo-s3-energy-security-and-low-carbon-transition",
  "geo-s3-marine-data-and-coastal-resource-governance",
  "geo-s3-accessible-mapping-and-spatial-inclusion",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v21 runtime item ${itemId}`);
}
for (const itemId of [
  "geo-c1-qgis-training-data-and-relief-reading",
  "geo-c1-satellite-time-series-land-cover-observation",
  "geo-c1-atmospheric-circulation-interactive-model",
  "geo-c2-open-map-place-and-service-accessibility",
  "geo-c2-spatial-visualization-and-regional-comparison",
  "geo-c2-teacher-dataset-and-local-field-evidence",
  "geo-s1-raster-vector-and-natural-process-scale",
  "geo-s1-protected-area-ecosystem-and-natural-integrity",
  "geo-s1-satellite-weather-and-hazard-timeline",
  "geo-s2-qgis-coordinate-reference-and-overlay",
  "geo-s2-spatial-analysis-and-regional-planning",
  "geo-s2-open-courseware-data-workflow",
  "geo-s3-protected-area-governance-and-connectivity",
  "geo-s3-geography-teaching-tools-and-resource-security",
  "geo-s3-disaster-risk-map-and-inclusive-decision",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v22 runtime item ${itemId}`);
}
for (const itemId of [
  "geo-c1-absolute-distance-direction-map-reading",
  "geo-c1-elevation-isoline-evidence",
  "geo-c1-revision-process-chain-and-scale",
  "geo-c2-cartogram-statistical-space",
  "geo-c2-europe-north-america-regional-comparison",
  "geo-c2-case-study-evidence-chain",
  "geo-s1-map-projection-distortion-purpose",
  "geo-s1-physical-region-map-compare",
  "geo-s1-climate-case-evidence-and-uncertainty",
  "geo-s2-thematic-map-symbol-selection",
  "geo-s2-qgis-tutorial-task-sequence",
  "geo-s2-geospatial-environment-reproducibility",
  "geo-s3-map-design-and-environmental-equity",
  "geo-s3-resource-environment-case-review",
  "geo-s3-data-license-and-provenance-boundary",
]) {
  assert.ok(site.items.some((item) => item.id === itemId), `missing v23 runtime item ${itemId}`);
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
  "web-mee-2025-ecological-environment-bulletin",
  "web-mee-2023-marine-ecological-environment-bulletin",
  "web-mnr-natural-resources-bulletins",
  "web-mnr-south-china-sea-island-ecosystem",
  "web-cma-meteorological-data",
  "web-cma-satellite-remote-sensing",
  "github-felix-high-school-geography",
  "github-clck-shanghai-high-school-knowledge",
  "github-zero2geoquest",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v18 runtime source ${sourceId}`);
}
for (const sourceId of [
  "web-tianditu-national-geospatial-platform",
  "web-nbs-national-statistical-yearbook",
  "web-nbs-2022-statistical-bulletin",
  "web-china-earthquake-data-center",
  "web-national-forestry-grassland-administration",
  "github-global-circulation-simulator",
  "github-satv-geography-tool",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v19 runtime source ${sourceId}`);
}
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
for (const sourceId of [
  "web-nasa-earth-energy-budget",
  "web-world-bank-migration",
  "web-world-bank-transport",
  "web-owid-urbanization",
  "github-cielo-geoscience-k12",
  "github-ghist-high-school-geology",
  "github-transport-geography-resources",
  "github-biogeo-secondary-education",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v15 runtime source ${sourceId}`);
}
for (const sourceId of [
  "web-moa-agriculture-rural-development",
  "web-mee-environmental-monitoring",
  "web-mnr-natural-resources-data",
  "web-unesco-global-geoparks",
  "web-wmo-weather",
  "web-cma-weather-climate-observation",
  "github-sems-sun-earth-moon-geography",
  "exam-guigang-2026-02-geography",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v20 runtime source ${sourceId}`);
}
for (const sourceId of [
  "web-cgs-geological-survey",
  "web-mot-transport-geography-data",
  "web-nea-energy-security-information",
  "web-nmdis-marine-information",
  "web-geodata-earth-system-data",
  "github-lmec-map-education-collections",
  "github-qgis-lesson-geography",
  "github-tactile-map-generator",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v21 runtime source ${sourceId}`);
}
for (const sourceId of [
  "web-qgis-training-manual",
  "web-arcgis-learn-geography",
  "web-nasa-worldview-earth-observation",
  "web-protected-planet-conservation-data",
  "github-qgis-training-data",
  "github-qgis-documentation",
  "github-spatialthoughts-open-courseware",
  "github-geography-teaching-tools",
  "github-geography-teaching-plugin",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v22 runtime source ${sourceId}`);
}
for (const sourceId of [
  "github-onicio-geodeck",
  "github-nocci-high-school-geography",
  "github-alexjohnj-geographyas",
  "github-spatialthoughts-qgis-tutorials",
  "github-opengeos-pygis",
]) {
  assert.ok(site.sources.some((sourceRecord) => sourceRecord.id === sourceId), `missing v23 runtime source ${sourceId}`);
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
