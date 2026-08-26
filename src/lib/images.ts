/**
 * Image pipeline. Wix serves no on-the-fly transforms for arbitrary hosts, but
 * Wix Media URLs accept `/v1/fill/...` transforms and Wikimedia Commons thumbs
 * accept width swaps in the `/thumb/.../{w}px-` path — so srcset generation is
 * per-host. Anything else is returned untouched at a single size.
 *
 * Wix transform format (probed live 2026-08-26): `fill` requires BOTH w and h
 * and the trailing filename must carry a real extension —
 * `<base>/v1/fill/w_400,h_300,q_85,enc_auto/photo.jpg` works on every
 * static.wixstatic.com media URL (bare ~mv2 included); `w`-only returns 400
 * and a bare `/img` filename returns 403 (the old bug).
 */

export const SRCSET_WIDTHS = [400, 800, 1200, 1600] as const;
// Commons' thumb server only renders a fixed set of width buckets (probed live
// 2026-08-25); any other width returns HTTP 400.
const COMMONS_WIDTHS = [330, 500, 960, 1280, 1920] as const;
const COMMONS_LQIP = 120;

const isWixMedia = (url: string) =>
  /(^https?:)?\/\/static\.wixstatic\.com\/media\//.test(url);
const isCommonsThumb = (url: string) =>
  /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\//.test(url);

const DEFAULT_ASPECT = 4 / 3;

function wixTransform(url: string, w: number, h: number, q = 85): string {
  const base = url.split("/v1/")[0].split("?")[0];
  const ext = /\.(jpe?g|png|webp|gif)$/i.exec(base)?.[1]?.toLowerCase() ?? "jpg";
  return `${base}/v1/fill/w_${w},h_${h},q_${q},enc_auto/photo.${ext}`;
}

/** Rewrite a URL to a specific width (best effort per host). */
export function imageAt(url: string, w: number, h?: number): string {
  if (isWixMedia(url)) {
    return wixTransform(url, w, h ?? Math.round(w / DEFAULT_ASPECT));
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
    const a = aspect ?? DEFAULT_ASPECT;
    return SRCSET_WIDTHS.map((w) => `${imageAt(url, w, Math.round(w / a))} ${w}w`).join(", ");
  }
  return undefined;
}

/** Tiny blurred placeholder URL (used as CSS background under the real image). */
export function lqipFor(url: string): string | undefined {
  if (isCommonsThumb(url)) return imageAt(url, COMMONS_LQIP);
  if (isWixMedia(url)) return wixTransform(url, 24, 18, 50);
  return undefined;
}

/** Inline style that paints the LQIP as a blurred cover background. */
export function lqipStyle(url: string): string | undefined {
  const lqip = lqipFor(url);
  return lqip
    ? `background-image:url('${lqip}');background-size:cover;background-position:center;`
    : undefined;
}
