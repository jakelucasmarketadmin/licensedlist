/**
 * Registry name hygiene (R-fix 1) — shared by scripts/seed-registry.ts (at
 * import time) and the one-off cleanup migration over existing rows. Public
 * rosters carry junk: names like ".", "1999", "FOO INC..", ALL-CAPS strings.
 */

/** Tokens kept fully uppercase when title-casing ALL-CAPS names. */
const ACRONYMS = new Set([
  "LLC", "LLP", "INC", "CORP", "CO", "USA", "NY", "NYC", "NJ", "PA", "HVAC",
  "AC", "A/C", "II", "III", "IV", "JV", "GC", "NYS", "US", "DBA", "PC",
]);

/** Reject reason, or null when the name is usable. */
export function rejectReason(rawName: unknown): string | null {
  const stripped = String(rawName ?? "").replace(/[^a-zA-Z0-9]+/g, "");
  if (stripped.length < 3) return "under 3 characters after stripping punctuation";
  if (/^[0-9]+$/.test(stripped)) return "all digits";
  if (!/[a-zA-Z]/.test(stripped)) return "contains no letters";
  return null;
}

/** Cleaned display name (assumes rejectReason() returned null). */
export function normalizeName(rawName: unknown): string {
  let s = String(rawName ?? "").trim();
  // Collapse repeated punctuation: "Inc.." → "Inc.", "--" → "-", ",," → ","
  s = s.replace(/([.\-,&'/])\1+/g, "$1");
  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();
  // Strip leading/trailing stray punctuation (keep a single trailing period
  // only after a corporate suffix).
  s = s.replace(/^[\s.,\-#*]+/, "").replace(/[\s,\-#*]+$/, "");
  // Title-case when the name is ALL CAPS (no lowercase letters at all).
  if (/[A-Z]/.test(s) && !/[a-z]/.test(s)) {
    s = s
      .split(" ")
      .map((word) => {
        const core = word.replace(/[^A-Za-z0-9/&]/g, "");
        if (ACRONYMS.has(core)) return word; // keep known acronyms
        if (/^[A-Z](\.[A-Z])+\.?$/.test(word)) return word; // J.R. style initials
        // Cap the first letter of the word and any letter following -, &, /
        // or a digit boundary ("3-R'S" → "3-R's", "M&M" → "M&M", "\"ALB" → "\"Alb").
        let out = "";
        let capNext = true;
        for (const ch of word) {
          if (/[a-zA-Z]/.test(ch)) {
            out += capNext ? ch.toUpperCase() : ch.toLowerCase();
            capNext = false;
          } else {
            out += ch;
            capNext = /[-&/.]/.test(ch) || capNext;
          }
        }
        return out;
      })
      .join(" ");
  }
  // Corporate suffixes get a canonical form: "Inc" / "Inc.." → "Inc."
  s = s.replace(/\b(Inc|Corp|Ltd)\.*$/i, (m, base) => `${base.charAt(0).toUpperCase()}${base.slice(1).toLowerCase()}.`);
  s = s.replace(/\bLlc\.*$/i, "LLC").replace(/\bLlp\.*$/i, "LLP");
  return s.trim();
}
