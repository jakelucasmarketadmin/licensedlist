/**
 * Owner-facing FAQ — single source of truth, rendered identically on
 * /for-businesses and /pricing.
 */
export interface OwnerFaqItem {
  q: string;
  a: string;
}

export const OWNER_FAQ: OwnerFaqItem[] = [
  {
    q: "Does paying improve my ranking or my reviews?",
    a: "No. Paid placement is always labeled and never changes rankings or reviews. The organic list is ordered by a public score: license verification, review count, rating, and freshness. That rule is permanent — it's what makes the badge worth having.",
  },
  {
    q: "What do I need to get the verified badge?",
    a: "Your license or registration number and the state it's issued in. We look it up in the official registry ourselves, record the source and date on your listing, and re-check it on a schedule.",
  },
  {
    q: "My trade doesn't require a license. Can I still be verified?",
    a: "Yes — your listing shows “license not required” for your category, and we still verify your identity, reviews, and responsiveness.",
  },
  {
    q: "Is claiming my listing really free?",
    a: "Free forever. No credit card. Claiming lets you fix your details, add photos and hours, and respond to reviews.",
  },
  {
    q: "What happens if my license lapses?",
    a: "The badge comes down until the registry shows you in good standing again. We'd rather have fewer badges than badges that mean nothing.",
  },
];
