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

/** Directionals and grid tokens kept uppercase in street addresses. */
const ADDRESS_CAPS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "US", "NY", "NJ", "PA"]);

/**
 * Display formatting for ALL-CAPS registry street addresses (D-fix 1):
 * "2005 W 8TH ST" → "2005 W 8th St". Ordinals stay lowercase after the digit;
 * directionals stay uppercase. Render-time only — stored rows are untouched.
 */
export function formatAddress(raw: unknown): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (/[a-z]/.test(s)) return s; // already mixed-case — leave it alone
  return s
    .split(" ")
    .map((word) => {
      const core = word.replace(/[^A-Za-z0-9]/g, "");
      if (ADDRESS_CAPS.has(core)) return word;
      if (/^\d+(ST|ND|RD|TH)$/i.test(core)) return word.toLowerCase().replace(/^(\d+)/, "$1"); // 8TH → 8th
      if (/^\d/.test(word)) return word; // house numbers, unit numbers
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
