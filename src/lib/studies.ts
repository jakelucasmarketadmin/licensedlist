/**
 * Data studies (§7.4) — the page type behind original research like the NJ
 * licence-lapse report.
 *
 * Built as a recurring asset, not a one-off: each study carries a `period`, and
 * regenerating it next year means adding a row with a new period rather than
 * rewriting the page. That is what makes it a press asset a newsroom can come
 * back to.
 *
 * Rows live in data/studies/studies.csv (source of truth, in git) and are
 * generated into src/data/studies.generated.ts.
 */
import { STUDY_SEED } from "@/data/studies.generated";

export interface StudyRow { [column: string]: string | number }

export interface Study {
  slug: string;
  title: string;
  /** One-line finding — the thing a journalist would put in a headline. */
  summary: string;
  /** The period the data covers, e.g. "2026" or "2020–2026". */
  period: string;
  /** Prose: how the data was obtained and what it can and cannot support. */
  methodology: string;
  /** Named limitations. A study without these is advocacy, not research. */
  limitations: string;
  /** Source datasets: {label, url, retrievedAt}. */
  sources: { label: string; url: string; retrievedAt?: string }[];
  /** Column headers, in display order. */
  columns: string[];
  /** The table itself. */
  rows: StudyRow[];
  /** Relative path to the downloadable CSV, served from /public. */
  csvPath?: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  aiAssisted: boolean;
}

const json = <T,>(raw: string, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

export function allStudies(): Study[] {
  return STUDY_SEED.map((s) => ({
    slug: s.slug,
    title: s.title,
    summary: s.summary,
    period: s.period,
    methodology: s.methodology,
    limitations: s.limitations,
    sources: json<Study["sources"]>(s.sourcesJson, []),
    columns: json<string[]>(s.columnsJson, []),
    rows: json<StudyRow[]>(s.rowsJson, []),
    csvPath: s.csvPath || undefined,
    author: s.author,
    publishedAt: s.publishedAt,
    updatedAt: s.updatedAt,
    aiAssisted: s.aiAssisted === "true",
  }));
}

export const getStudy = (slug: string): Study | undefined =>
  allStudies().find((s) => s.slug === slug);

/**
 * schema.org/Dataset. This is the one place structured data genuinely earns
 * its keep for us: Dataset is used by Google Dataset Search and by AI systems
 * looking for primary sources, which is exactly the audience for a study.
 */
export function datasetJsonLd(origin: string, study: Study) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${origin}/studies/${study.slug}`,
    url: `${origin}/studies/${study.slug}`,
    name: study.title,
    description: study.summary,
    temporalCoverage: study.period,
    datePublished: study.publishedAt,
    dateModified: study.updatedAt,
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: study.author, url: origin },
    ...(study.csvPath
      ? {
          distribution: [{
            "@type": "DataDownload",
            encodingFormat: "text/csv",
            contentUrl: `${origin}${study.csvPath}`,
          }],
        }
      : {}),
    ...(study.sources.length
      ? { isBasedOn: study.sources.map((s) => s.url) }
      : {}),
  };
}
