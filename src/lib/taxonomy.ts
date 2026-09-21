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
