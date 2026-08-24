/**
 * Auto-generated entity types
 * Contains all CMS collection interfaces in a single file 
 */

/**
 * Collection ID: businesses
 * Interface for Businesses
 */
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
