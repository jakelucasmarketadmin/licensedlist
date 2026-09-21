import {
  CATEGORY_SEED,
  CATEGORY_GROUP_SEED,
  type CategorySeed,
  type CategoryGroupSeed,
} from "@/data/taxonomy.generated";

export type { CategorySeed, CategoryGroupSeed };

const bySort = <T extends { sortOrder?: number }>(a: T, b: T) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export function getCategories(): CategorySeed[] {
  return [...CATEGORY_SEED].sort(bySort);
}

export function getCategory(slug: string): CategorySeed | undefined {
  return CATEGORY_SEED.find((c) => c.slug === slug);
}

export function getCategoryGroups(): CategoryGroupSeed[] {
  return [...CATEGORY_GROUP_SEED].sort(bySort);
}

export function getCategoriesByGroup(groupSlug: string): CategorySeed[] {
  return CATEGORY_SEED.filter((c) => c.groupSlug === groupSlug).sort(bySort);
}

/** Singular-ish display for headings like "{Category} in {Town}". */
export function categoryDisplayName(category: CategorySeed): string {
  return category.name;
}

/**
 * Section set and heading vocabulary per category kind (Phase 4 §1.6).
 *
 * The trade template asked "Hiring spas in Blue Bell: what to know" and "What
 * Blue Bell housing means for spas" — nobody hires a spa, and housing stock is
 * irrelevant to one. A category with no kind set renders no kind-specific
 * sections and its money pages stay out of the index until one is assigned.
 */
export type CategoryKind = "trade" | "practice" | "venue" | "retail";

export interface KindVocabulary {
  /** "Hiring roofers in X: what to know" vs "Visiting spas in X: what to know" */
  guideHeading: (category: string, place: string) => string;
  costHeading: (category: string, place: string) => string;
  /** Housing/Census context only makes sense where the building is the job. */
  showHousingContext: boolean;
  /** Municipal construction permits only apply to trades. */
  showPermits: boolean;
  /** Licensing copy: business registration vs individual credential. */
  licensingAngle: "business" | "individual" | "venue";
}

const TRADE: KindVocabulary = {
  guideHeading: (c, p) => `Hiring ${c} in ${p}: what to know`,
  costHeading: (c, p) => `What ${c} cost in ${p}`,
  showHousingContext: true,
  showPermits: true,
  licensingAngle: "business",
};

export const KIND_VOCAB: Record<CategoryKind, KindVocabulary> = {
  trade: TRADE,
  practice: {
    guideHeading: (c, p) => `Choosing ${c} in ${p}: what to know`,
    costHeading: (c, p) => `What a visit to ${c} in ${p} costs`,
    showHousingContext: false,
    showPermits: false,
    licensingAngle: "individual",
  },
  venue: {
    guideHeading: (c, p) => `${c.charAt(0).toUpperCase()}${c.slice(1)} in ${p}: what to know before you go`,
    costHeading: (c, p) => `What ${c} in ${p} cost`,
    showHousingContext: false,
    showPermits: false,
    licensingAngle: "venue",
  },
  retail: {
    guideHeading: (c, p) => `Shopping for ${c} in ${p}: what to know`,
    costHeading: (c, p) => `What ${c} in ${p} charge`,
    showHousingContext: false,
    showPermits: false,
    licensingAngle: "venue",
  },
};

export const kindOf = (c: { categoryKind?: string } | undefined): CategoryKind | null => {
  const k = c?.categoryKind;
  return k === "trade" || k === "practice" || k === "venue" || k === "retail" ? k : null;
};

export const vocabFor = (c: { categoryKind?: string } | undefined): KindVocabulary | null => {
  const k = kindOf(c);
  return k ? KIND_VOCAB[k] : null;
};
