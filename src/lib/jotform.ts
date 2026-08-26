/**
 * Business-intake Jotform ("Add or Update Your Business Listing").
 *
 * Prefill works by field *unique name* (the part of the input name after the
 * qN_ prefix — inspected on the live form, documented in docs/RUNBOOK.md):
 *   q3_textbox1  → Business Name
 *   q2_radio0    → "Add a new business listing" / "Update an existing listing"
 * The form has no profile-URL field yet; `profileUrl` is passed anyway so the
 * prefill lights up if a field with that unique name is added in Jotform.
 */
export const JOTFORM_FORM_ID = "262358080828059";
export const JOTFORM_FORM_URL = `https://form.jotform.com/${JOTFORM_FORM_ID}`;

export function jotformUpdateUrl(businessName?: string, profileUrl?: string): string {
  const params = new URLSearchParams({ q2_radio0: "Update an existing listing" });
  if (businessName) params.set("q3_textbox1", businessName);
  if (profileUrl) params.set("profileUrl", profileUrl);
  return `${JOTFORM_FORM_URL}?${params.toString()}`;
}

/**
 * Registry claim prefill: name + license number (C0). `licenseNumber` lights
 * up once a field with that unique name exists on the form (RUNBOOK §5).
 */
export function jotformClaimRegistryUrl(businessName: string, licenseNumber?: string): string {
  const params = new URLSearchParams({ q2_radio0: "Update an existing listing" });
  params.set("q3_textbox1", businessName);
  if (licenseNumber) params.set("licenseNumber", licenseNumber);
  return `${JOTFORM_FORM_URL}?${params.toString()}`;
}
