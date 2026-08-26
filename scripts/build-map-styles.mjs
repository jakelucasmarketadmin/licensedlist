/**
 * Fork OpenFreeMap "Positron" into brand-recolored light + dark map styles.
 *
 *   node scripts/build-map-styles.mjs           (fetches the upstream style)
 *
 * Writes src/map/style-light.json and src/map/style-dark.json. Role-based
 * recoloring keyed on Positron's layer ids — land goes warm paper, water goes
 * soft navy, labels go ink/muted; dark mirrors the site dark tokens. Tiles,
 * glyphs, and sprites stay on tiles.openfreemap.org (attribution preserved).
 */
import { writeFileSync, mkdirSync } from "node:fs";

const UPSTREAM = "https://tiles.openfreemap.org/styles/positron";
const res = await fetch(UPSTREAM);
if (!res.ok) throw new Error(`upstream style: HTTP ${res.status}`);
const base = await res.json();

const PALETTES = {
  light: {
    background: "#f4f0e8",      // warm paper land
    residential: "#efeadf",
    park: "#e3e6d3",
    wood: "#dde1cd",
    water: "#b9cedd",           // clearly-blue water
    waterway: "#adc5d6",
    building: "#e9e3d5",
    buildingOutline: "#ddd5c3",
    roadCasing: "#d8d1c0",
    roadInner: "#fffdf8",
    roadSubtle: "#e6e0d2",
    rail: "#d5cdbc",
    railDash: "#f7f3ea",
    boundary: "#b3a88f",
    labelPrimary: "#102438",    // ink
    labelSecondary: "#4c6172",  // muted
    labelWater: "#3f5a86",
    halo: "#f8f5ef",
  },
  dark: {
    // Lifted fills: roads/water/labels must read clearly against the pins.
    background: "#182634",
    residential: "#1d2d3d",
    park: "#1b3a2e",
    wood: "#173226",
    water: "#0e3a5c",
    waterway: "#11405f",
    building: "#243748",
    buildingOutline: "#2e455a",
    roadCasing: "#31465c",
    roadInner: "#54718c",
    roadSubtle: "#3c556e",
    rail: "#41586f",
    railDash: "#1a2836",
    boundary: "#7d97b3",
    labelPrimary: "#eef4fa",
    labelSecondary: "#b6c7d8",
    labelWater: "#8fc1e8",
    halo: "#12202e",
  },
};

/** Map Positron layer-id patterns to palette roles per paint key. */
function recolor(layer, c) {
  const id = layer.id;
  const set = (key, val) => {
    if (layer.paint && layer.paint[key] !== undefined) layer.paint[key] = val;
  };
  if (id === "background" || id.includes("pier")) set("background-color", c.background) || set("fill-color", c.background) || set("line-color", c.background);
  if (id === "park") set("fill-color", c.park);
  if (id === "water") set("fill-color", c.water);
  if (id.startsWith("landcover_wood")) set("fill-color", c.wood);
  if (id.startsWith("landcover")) set("fill-color", c.background);
  if (id === "landuse_residential") set("fill-color", c.residential);
  if (id === "waterway") set("line-color", c.waterway);
  if (id === "building") { set("fill-color", c.building); set("fill-outline-color", c.buildingOutline); }
  if (/casing/.test(id)) set("line-color", c.roadCasing);
  if (/_inner$/.test(id) || id.startsWith("aeroway")) { set("line-color", c.roadInner); set("fill-color", c.roadInner); }
  if (/subtle|highway_path|highway_minor/.test(id)) set("line-color", c.roadSubtle);
  if (/^railway(_|$)/.test(id)) set("line-color", /dashline/.test(id) ? c.railDash : c.rail);
  if (id.startsWith("boundary")) set("line-color", c.boundary);
  if (layer.type === "symbol" && layer.paint) {
    if (/water/.test(id)) { set("text-color", c.labelWater); }
    else if (/label_(city|town|village|country|capital)/.test(id)) set("text-color", c.labelPrimary);
    else set("text-color", c.labelSecondary);
    set("text-halo-color", c.halo);
  }
  return layer;
}

mkdirSync("src/map", { recursive: true });
for (const [mode, palette] of Object.entries(PALETTES)) {
  const style = JSON.parse(JSON.stringify(base));
  style.name = `TriVetted ${mode}`;
  style.layers = style.layers.map((l) => recolor(l, palette));
  writeFileSync(`src/map/style-${mode}.json`, JSON.stringify(style));
  console.log(`src/map/style-${mode}.json (${style.layers.length} layers)`);
}
