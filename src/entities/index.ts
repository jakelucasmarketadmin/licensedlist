/**
 * Entity types for the Wix CMS collections.
 * Field keys must match the collection field keys exactly (see docs/ARCHITECTURE.md).
 */

/** Collection ID: businesses (Vibe-generated demo collection; superseded in M3). */
export interface Businesses {
  _id: string;
  _createdDate?: Date;
  _updatedDate?: Date;
  /** @wixFieldType text */
  businessName?: string;
  /** @wixFieldType text */
  category?: string;
  /** @wixFieldType text */
  address?: string;
  /** @wixFieldType text */
  city?: string;
  /** @wixFieldType text */
  state?: string;
  /** @wixFieldType text */
  zipCode?: string;
  /** @wixFieldType text */
  phoneNumber?: string;
  /** @wixFieldType text */
  email?: string;
  /** @wixFieldType url */
  website?: string;
  /** @wixFieldType text */
  description?: string;
  /** @wixFieldType image - Contains image URL, render with <Image> component, NOT as text */
  logo?: string;
}

/** Collection ID: states */
export interface States {
  _id: string;
  name?: string;
  slug?: string;
  abbr?: string;
  intro?: string;
  licensingNotes?: string;
  sortOrder?: number;
}

/** Collection ID: counties */
export interface Counties {
  _id: string;
  name?: string;
  slug?: string;
  stateSlug?: string;
  /** "{stateSlug}/{countySlug}" — unique */
  pathKey?: string;
  population?: number;
  intro?: string;
  permitNotes?: string;
  lat?: number;
  lng?: number;
  isLaunch?: boolean;
}

/** Collection ID: towns */
export interface Towns {
  _id: string;
  name?: string;
  slug?: string;
  countySlug?: string;
  stateSlug?: string;
  /** "{stateSlug}/{countySlug}/{townSlug}" — unique */
  pathKey?: string;
  population?: number;
  intro?: string;
  /** JSON array of short strings */
  localFacts?: string;
  /** comma list */
  zips?: string;
  lat?: number;
  lng?: number;
  /** comma list of town slugs */
  nearbySlugs?: string;
  isLaunch?: boolean;
}

/** Collection ID: categorygroups */
export interface CategoryGroups {
  _id: string;
  name?: string;
  slug?: string;
  sortOrder?: number;
  icon?: string;
}

/** Collection ID: categories */
export interface Categories {
  _id: string;
  name?: string;
  slug?: string;
  groupSlug?: string;
  /** schema.org type, default LocalBusiness */
  schemaType?: string;
  licenseRequired?: boolean;
  /** JSON object: {"NJ": "...", "NY": "...", "PA": "..."} */
  licenseSourcesByState?: string;
  hiringGuide?: string;
  costNotes?: string;
  /** comma list */
  synonyms?: string;
  sortOrder?: number;
}

/** Collection ID: claims */
export interface Claims {
  _id: string;
  _createdDate?: Date;
  businessSlug?: string;
  businessName?: string;
  claimantName?: string;
  claimantEmail?: string;
  claimantPhone?: string;
  town?: string;
  category?: string;
  website?: string;
  licenseNumber?: string;
  /** phone | email | document | form */
  method?: string;
  /** get-listed | claim */
  source?: string;
  /** new | pending | approved | rejected */
  status?: string;
  memberId?: string;
  createdAt?: Date;
}

/** Collection ID: leads */
export interface Leads {
  _id: string;
  _createdDate?: Date;
  /** comma list of business slugs the lead was shared with */
  businessSlugs?: string;
  categorySlug?: string;
  townSlug?: string;
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  photosJson?: string;
  urgency?: string;
  consentText?: string;
  consentAt?: Date;
  consentUserAgent?: string;
  consentIp?: string;
  source?: string;
  status?: string;
  ghlSynced?: boolean;
}
