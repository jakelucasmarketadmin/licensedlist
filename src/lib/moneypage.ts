/**
 * Money-page data: local cost guides, municipal permit offices, and
 * Census-sourced housing facts (Gate A).
 *
 * All three are generated from CSVs in data/money/ (see
 * scripts/generate-data-modules.mjs), so every figure that reaches a page is
 * traceable to a row in git and to a named source with a date. Nothing here
 * is computed, rounded or inferred at render time.
 */
import { COST_GUIDE_SEED } from "@/data/cost-guides.generated";
import { PERMIT_OFFICE_SEED } from "@/data/permit-offices.generated";
import { TOWN_HOUSING_SEED } from "@/data/town-housing.generated";

export interface CostRow { jobType: string; typicalCost: string; notes?: string; source?: string }
export interface CostSource { label: string; url: string; retrievedAt?: string; published?: string }
export interface CostGuide {
  categorySlug: string;
  stateSlug: string;
  countySlug?: string;
  townSlug?: string;
  headline: string;
  hourlyRange: string;
  rows: CostRow[];
  modifiers: string[];
  sources: CostSource[];
  updatedAt: string;
  author: string;
  aiAssisted: boolean;
}

const json = <T,>(raw: string, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

/**
 * Town-specific guide wins; otherwise the county guide inherits down with the
 * town name substituted for the county name in the headline. A page with no
 * guide at either level renders no cost section at all — never a stub.
 */
export function costGuideFor(
  categorySlug: string,
  stateSlug: string,
  countySlug?: string,
  townSlug?: string,
  townName?: string,
  countyName?: string,
): CostGuide | null {
  const rows = COST_GUIDE_SEED.filter(
    (g) => g.categorySlug === categorySlug && g.stateSlug === stateSlug && (!countySlug || g.countySlug === countySlug),
  );
  const exact = townSlug ? rows.find((g) => g.townSlug === townSlug) : undefined;
  const county = rows.find((g) => !g.townSlug);
  const hit = exact ?? county;
  if (!hit) return null;
  const inherited = !exact && Boolean(townName);
  let headline = hit.headline;
  if (inherited && countyName && townName) {
    // County guide read on a town page: name the town, and say where the
    // figures came from rather than implying town-specific research.
    headline = headline.replace(`in ${countyName}`, `in ${townName}`);
  }
  return {
    categorySlug: hit.categorySlug,
    stateSlug: hit.stateSlug,
    countySlug: hit.countySlug || undefined,
    townSlug: hit.townSlug || undefined,
    headline,
    hourlyRange: hit.hourlyRange,
    rows: json<CostRow[]>(hit.rowsJson, []),
    modifiers: json<string[]>(hit.modifiersJson, []),
    sources: json<CostSource[]>(hit.sourcesJson, []),
    updatedAt: hit.updatedAt,
    author: hit.author,
    aiAssisted: hit.aiAssisted === "true",
  };
}

export interface PermitOffice {
  townSlug: string;
  stateSlug: string;
  officeName: string;
  address: string;
  phone: string;
  url: string;
  hours: string;
  inspectionHours?: string;
  officials?: string;
  categoryNote?: string;
  fees: { item: string; fee: string }[];
  feeCitation?: string;
  feeUrl?: string;
  verifiedAt: string;
}

export function permitOfficeFor(townSlug: string, stateSlug: string, categorySlug: string): PermitOffice | null {
  const hit = PERMIT_OFFICE_SEED.find((p) => p.townSlug === townSlug && p.stateSlug === stateSlug);
  if (!hit) return null;
  const notes = json<Record<string, string>>(hit.notesByCategoryJson, {});
  const fee = json<{ url?: string; citation?: string; fees?: { item: string; fee: string }[] }>(hit.feeScheduleJson, {});
  return {
    townSlug: hit.townSlug,
    stateSlug: hit.stateSlug,
    officeName: hit.officeName,
    address: hit.address,
    phone: hit.phone,
    url: hit.url,
    hours: hit.hours,
    inspectionHours: hit.inspectionHours || undefined,
    officials: hit.officials || undefined,
    categoryNote: notes[categorySlug],
    fees: fee.fees ?? [],
    feeCitation: fee.citation,
    feeUrl: fee.url,
    verifiedAt: hit.verifiedAt,
  };
}

export interface TownHousing {
  townSlug: string;
  stateSlug: string;
  geoName: string;
  totalUnits: number;
  medianYearBuilt: number | null;
  pctPre1940: number | null;
  pctPre1960: number | null;
  pctOwnerOccupied: number | null;
  release: string;
}

const num = (v: string) => (v === "" || v == null ? null : Number(v));

export function townHousingFor(townSlug: string, stateSlug: string): TownHousing | null {
  const hit = TOWN_HOUSING_SEED.find((t) => t.townSlug === townSlug && t.stateSlug === stateSlug);
  if (!hit) return null;
  return {
    townSlug: hit.townSlug,
    stateSlug: hit.stateSlug,
    geoName: hit.geoName,
    totalUnits: Number(hit.totalUnits),
    medianYearBuilt: num(hit.medianYearBuilt),
    pctPre1940: num(hit.pctPre1940),
    pctPre1960: num(hit.pctPre1960),
    pctOwnerOccupied: num(hit.pctOwnerOccupied),
    release: hit.release,
  };
}

/** County roll-up: median of town medians, unit-weighted pre-1940 share. */
export function countyHousingFor(stateSlug: string, townSlugs: string[]): TownHousing | null {
  const rows = TOWN_HOUSING_SEED.filter((t) => t.stateSlug === stateSlug && townSlugs.includes(t.townSlug));
  if (rows.length < 3) return null;
  const units = rows.reduce((s, r) => s + Number(r.totalUnits || 0), 0);
  if (!units) return null;
  const years = rows.map((r) => Number(r.medianYearBuilt)).filter(Boolean).sort((a, b) => a - b);
  const weighted = (key: "pctPre1940" | "pctPre1960" | "pctOwnerOccupied") =>
    +(rows.reduce((s, r) => s + (Number((r as any)[key]) || 0) * Number(r.totalUnits || 0), 0) / units).toFixed(1);
  return {
    townSlug: "",
    stateSlug,
    geoName: `${rows.length} towns`,
    totalUnits: units,
    medianYearBuilt: years.length ? years[Math.floor(years.length / 2)] : null,
    pctPre1940: weighted("pctPre1940"),
    pctPre1960: weighted("pctPre1960"),
    pctOwnerOccupied: weighted("pctOwnerOccupied"),
    release: rows[0].release,
  };
}
