/**
 * Synonyms improvement report (D2).
 *
 *   npx tsx scripts/intent-synonyms-report.ts [--logs data/exports/intentLogs.csv]
 *
 * Input: a dashboard CSV export of the `intentLogs` collection (admin-read).
 * Aggregates the PII-stripped unmatched terms and no-match categories from
 * parsed intents into data/intent-synonyms-report.csv — terms users typed
 * that our taxonomy didn't recognize, ranked by frequency, with the category
 * the parser eventually guessed (if any). Review it, then add winners to
 * data/taxonomy/*.csv synonyms and regenerate.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const i = args.indexOf("--logs");
const logsPath = i >= 0 ? args[i + 1] : join(root, "data/exports/intentLogs.csv");

if (!existsSync(logsPath)) {
  console.error(`no export at ${logsPath} — CMS dashboard → intentLogs → Export CSV first.`);
  process.exit(1);
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let j = 0; j < text.length; j++) {
    const c = text[j];
    if (inQ) { if (c === '"') { if (text[j + 1] === '"') { field += '"'; j++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[j + 1] === "\n") j++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, k) => [h, (r[k] ?? "").trim()])));
}

const logs = parseCsv(readFileSync(logsPath, "utf8"));
const termStats = new Map<string, { count: number; categories: Map<string, number>; noMatch: number }>();
let total = 0;
let noCategory = 0;

for (const log of logs) {
  let parsed: any = {};
  try { parsed = JSON.parse(log.parsedJson || "{}"); } catch { continue; }
  total++;
  if (!parsed.categorySlug) noCategory++;
  for (const term of parsed.unmatchedTerms ?? []) {
    const t = String(term).toLowerCase();
    const s = termStats.get(t) ?? { count: 0, categories: new Map(), noMatch: 0 };
    s.count++;
    if (parsed.categorySlug) s.categories.set(parsed.categorySlug, (s.categories.get(parsed.categorySlug) ?? 0) + 1);
    else s.noMatch++;
    termStats.set(t, s);
  }
}

const rows = [...termStats.entries()]
  .sort((a, b) => b[1].count - a[1].count)
  .map(([term, s]) => {
    const top = [...s.categories.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      term,
      occurrences: s.count,
      timesWithNoCategoryMatch: s.noMatch,
      likelyCategory: top ? top[0] : "",
      suggestion: s.noMatch > 0 ? "candidate synonym — user language we don't recognize" : "co-occurs with a match; lower priority",
    };
  });

const out = join(root, "data/intent-synonyms-report.csv");
const header = ["term", "occurrences", "timesWithNoCategoryMatch", "likelyCategory", "suggestion"];
writeFileSync(out, [header.join(","), ...rows.map((r) => header.map((h) => String((r as any)[h]).replace(/,/g, ";")).join(","))].join("\n") + "\n");
console.log(`${total} intents (${noCategory} with no category match) → ${rows.length} unmatched terms → ${out}`);
