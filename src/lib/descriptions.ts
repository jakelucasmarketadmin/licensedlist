/**
 * Meta-description composition (Phase 4 §1.3).
 *
 * The old approach sliced a body paragraph at 155 characters and appended an
 * ellipsis, which shipped mid-sentence fragments on every town hub and every
 * business profile. A description is a written asset, not a substring: each
 * one here is a complete sentence carrying at least one fact specific to the
 * page — a count, a county, a registry name — and clauses are dropped whole
 * rather than sliced when the budget runs out.
 */
const MIN = 140;
const MAX = 160;

/**
 * Join clauses into the longest complete string that fits, dropping whole
 * trailing clauses rather than cutting mid-word. Never emits an ellipsis.
 */
export function compose(clauses: string[], max = MAX): string {
  const parts = clauses.map((c) => c.trim()).filter(Boolean);
  let out = "";
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (next.length > max) break;
    out = next;
  }
  // Nothing fit: fall back to the first clause, trimmed at a word boundary
  // with no ellipsis, so the tag is still a readable phrase.
  if (!out && parts.length) {
    const first = parts[0];
    out = first.length <= max ? first : first.slice(0, first.lastIndexOf(" ", max)).trimEnd();
  }
  return out;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "an electrician", "a roofer" — the article has to agree or the line reads wrong. */
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

export function businessDescription(opts: {
  name: string;
  categoryName?: string;
  townName?: string;
  stateAbbr?: string;
  licenseNumber?: string;
  licenseSource?: string;
  verifiedMonth?: string;
}): string {
  const where = [opts.townName, opts.stateAbbr].filter(Boolean).join(", ");
  const what = opts.categoryName ? opts.categoryName.toLowerCase().replace(/s$/, "") : "business";
  const lead = where ? `${opts.name} is ${article(what)} ${what} in ${where}.` : `${opts.name}.`;
  const licence =
    opts.licenseNumber && opts.licenseSource
      ? `License ${opts.licenseNumber} verified against ${opts.licenseSource}${opts.verifiedMonth ? ` in ${opts.verifiedMonth}` : ""}.`
      : "Identity, reviews and responsiveness checked before listing.";
  return compose([lead, licence, "See the full verification record."]);
}

export function townHubDescription(opts: {
  townName: string;
  countyName: string;
  stateAbbr: string;
  listingCount: number;
  verifiedCount: number;
  categoryCount: number;
}): string {
  const lead = `Licensed local businesses in ${opts.townName}, ${opts.stateAbbr}.`;
  const counts = opts.listingCount
    ? `${plural(opts.listingCount, "listing")}, ${opts.verifiedCount} license-verified against the official state registry.`
    : `Part of ${opts.countyName} — license records and permit details for every trade we cover.`;
  const cats = opts.categoryCount
    ? `Compare ${plural(opts.categoryCount, "category", "categories")} serving the town.`
    : `${opts.countyName}, ${opts.stateAbbr}.`;
  return compose([lead, counts, cats]);
}

export function countyHubDescription(opts: {
  countyName: string;
  stateAbbr: string;
  listingCount: number;
  verifiedCount: number;
  townCount: number;
}): string {
  return compose([
    `Licensed local businesses across ${opts.countyName}, ${opts.stateAbbr}.`,
    opts.listingCount
      ? `${plural(opts.listingCount, "verified listing")} in ${plural(opts.townCount, "town")}, each checked against its state registry.`
      : `${plural(opts.townCount, "town")} covered, with license and permit detail for each.`,
    "Browse by town or trade.",
  ]);
}

export function stateHubDescription(opts: {
  stateName: string;
  listingCount: number;
  verifiedCount: number;
  countyCount: number;
  registryCount: number;
}): string {
  return compose([
    `Licensed local businesses in ${opts.stateName}.`,
    opts.listingCount
      ? `${plural(opts.listingCount, "verified profile")} across ${plural(opts.countyCount, "county", "counties")}, every license checked against the state registry.`
      : `${plural(opts.countyCount, "county", "counties")} covered.`,
    opts.registryCount ? `${opts.registryCount.toLocaleString("en-US")} license records on file.` : "",
  ]);
}

export function moneyPageDescription(opts: {
  categoryName: string;
  placeName: string;
  listingCount: number;
  verifiedCount: number;
  licenseSource?: string;
  hasCostGuide: boolean;
}): string {
  const lead = `${opts.listingCount} ${opts.categoryName.toLowerCase()} in ${opts.placeName}, ranked by a public score.`;
  const licence = opts.licenseSource
    ? `${opts.verifiedCount} verified against ${opts.licenseSource}.`
    : `${opts.verifiedCount} license-verified.`;
  // Only claim what the page actually renders. Response time is deliberately
  // absent: it was advertised sitewide and displayed nowhere.
  const extra = opts.hasCostGuide ? "Local costs, permits and license numbers." : "License numbers and permit details.";
  return compose([lead, licence, extra]);
}

/** Guardrail used by the smoke test as well as at render time. */
export const descriptionIsValid = (d: string) =>
  Boolean(d) && d.length <= MAX && !d.endsWith("…") && !d.endsWith("...");
export const DESCRIPTION_MIN = MIN;
export const DESCRIPTION_MAX = MAX;
