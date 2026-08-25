import { useEffect, useMemo, useState } from "react";
import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import styleLight from "../../map/style-light.json";
import styleDark from "../../map/style-dark.json";

/**
 * Small non-navigating map for profiles (business + service-area towns) and
 * geo hubs (towns in a county). Interaction is limited to pan/zoom buttonless
 * gestures being off — it's a picture with dots, keyboard users get the text
 * list beside it.
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
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const initial = useMemo(() => {
    const lats = valid.map((p) => p.lat);
    const lngs = valid.map((p) => p.lng);
    return {
      bounds: [
        [Math.min(...lngs) - 0.04, Math.min(...lats) - 0.04],
        [Math.max(...lngs) + 0.04, Math.max(...lats) + 0.04],
      ] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 30, maxZoom: 12 },
    };
  }, [points]);

  if (valid.length === 0) return null;
  return (
    <div className={`overflow-hidden rounded-card border border-line ${className ?? "h-56"}`} aria-hidden="true">
      <Map
        initialViewState={initial}
        mapStyle={(dark ? styleDark : styleLight) as any}
        attributionControl={{ compact: true }}
        scrollZoom={false}
        dragRotate={false}
        style={{ width: "100%", height: "100%" }}
      >
        {valid.map((p) => (
          <Marker key={`${p.label}-${p.lat}`} longitude={p.lng} latitude={p.lat} anchor="center">
            {p.href ? (
              <a
                href={p.href}
                title={p.label}
                tabIndex={-1}
                className="block h-3 w-3 rounded-chip border-2 border-surface bg-brand shadow-sm"
              />
            ) : (
              <span
                title={p.label}
                className={
                  p.primary
                    ? "block h-4 w-4 rounded-chip border-2 border-surface bg-accent shadow-md"
                    : "block h-2.5 w-2.5 rounded-chip border border-surface bg-brand/70 shadow-sm"
                }
              />
            )}
          </Marker>
        ))}
      </Map>
    </div>
  );
}
