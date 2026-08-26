/**
 * Image pipeline. Wix serves no on-the-fly transforms for arbitrary hosts, but
 * Wix Media URLs accept `/v1/fill/w_{w},h_{h},q_{q},al_c/` transforms and
 * Wikimedia Commons thumbs accept width swaps in the `/thumb/.../{w}px-` path —
 * so srcset generation is per-host. Anything else is returned untouched at a
 * single size.
 */

export const SRCSET_WIDTHS = [400, 800, 1200, 1600] as const;
// Commons' thumb server only renders a fixed set of width buckets (probed live
// 2026-08-25); any other width returns HTTP 400.
const COMMONS_WIDTHS = [330, 500, 960, 1280, 1920] as const;
const COMMONS_LQIP = 120;

// Only Wix Media URLs that ALREADY carry a /v1/ transform segment accept
// rewritten transforms — hand-building /v1/fill/ onto a bare ~mv2 URL 403s.
const isWixMedia = (url: string) =>
  /(^https?:)?\/\/static\.wixstatic\.com\/media\/.*\/v1\//.test(url);
const isCommonsThumb = (url: string) =>
  /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\//.test(url);

/** Rewrite a URL to a specific width (best effort per host). */
export function imageAt(url: string, w: number, h?: number): string {
  if (isWixMedia(url)) {
    const base = url.split("/v1/")[0];
    const dims = h ? `w_${w},h_${h}` : `w_${w}`;
    return `${base}/v1/fill/${dims},q_85,al_c,enc_auto/img`;
  }
  if (isCommonsThumb(url)) {
    // Strip tracking params; swap the /###px- width segment.
    return url.split("?")[0].replace(/\/(\d+)px-([^/]+)$/, `/${w}px-$2`);
  }
  return url;
}

/** srcset string across the host's supported widths (undefined = can't resize). */
export function srcsetFor(url: string, aspect?: number): string | undefined {
  if (isCommonsThumb(url)) {
    return COMMONS_WIDTHS.map((w) => `${imageAt(url, w)} ${w}w`).join(", ");
  }
  if (isWixMedia(url)) {
    return SRCSET_WIDTHS.map(
      (w) => `${imageAt(url, w, aspect ? Math.round(w / aspect) : undefined)} ${w}w`,
    ).join(", ");
  }
  return undefined;
}

/** Tiny blurred placeholder URL (used as CSS background under the real image). */
export function lqipFor(url: string): string | undefined {
  if (isCommonsThumb(url)) return imageAt(url, COMMONS_LQIP);
  if (isWixMedia(url)) return imageAt(url, 24);
  return undefined;
}
