import { GUIDE_SEED, type GuideSeed } from "@/data/guides.generated";

export type { GuideSeed };

export function getGuide(scope: string, scopeKey: string, slugPrefix?: string): GuideSeed | undefined {
  return GUIDE_SEED.find(
    (g) => g.scope === scope && g.scopeKey === scopeKey && (!slugPrefix || g.slug.startsWith(slugPrefix)),
  );
}

export function getGuidesFor(scope: string, scopeKey: string): GuideSeed[] {
  return GUIDE_SEED.filter((g) => g.scope === scope && g.scopeKey === scopeKey);
}
