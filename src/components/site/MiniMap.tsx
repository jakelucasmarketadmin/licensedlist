import { useEffect, useRef } from "react";
import { loadMaplibre } from "../../lib/maplibre-loader";
import styleLight from "../../map/style-light.json";
import styleDark from "../../map/style-dark.json";

/**
 * Small map for profiles (home base + service-area towns) and geo hubs (towns
 * in a county). Imperative MapLibre — no react wrapper. Scroll zoom off; it's
 * a picture with dots, keyboard users get the adjacent text list.
 */

export interface MiniPoint {
  label: string;
  lat: number;
  lng: number;
  /** true = the primary point (accent dot, larger) */
  primary?: boolean;
  href?: string;
}

interface Props {
  points: MiniPoint[];
  className?: string;
}

export default function MiniMap({ points, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  useEffect(() => {
    if (!containerRef.current || valid.length === 0) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    (async () => {
    const mod: any = await loadMaplibre();
    const maplibregl = mod.default ?? mod;
    if (disposed || !containerRef.current) return;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const lats = valid.map((p) => p.lat);
    const lngs = valid.map((p) => p.lng);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: (dark ? styleDark : styleLight) as any,
      bounds: [
        [Math.min(...lngs) - 0.03, Math.min(...lats) - 0.03],
        [Math.max(...lngs) + 0.03, Math.max(...lats) + 0.03],
      ],
      fitBoundsOptions: { padding: 30, maxZoom: 12 },
      attributionControl: { compact: true },
      scrollZoom: false,
      dragRotate: false,
    });
    for (const p of valid) {
      const el = document.createElement(p.href ? "a" : "span");
      if (p.href) (el as HTMLAnchorElement).href = p.href;
      el.title = p.label;
      el.setAttribute("tabindex", "-1");
      el.className = p.primary
        ? "block h-4 w-4 rounded-chip border-2 border-surface bg-accent shadow-md"
        : p.href
          ? "block h-3 w-3 rounded-chip border-2 border-surface bg-brand shadow-sm"
          : "block h-2.5 w-2.5 rounded-chip border border-surface bg-brand shadow-sm";
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(map);
    }
    cleanup = () => map.remove();
    })();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  if (valid.length === 0) return null;
  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-card border border-line ${className ?? "h-56"}`}
      aria-hidden="true"
    />
  );
}
