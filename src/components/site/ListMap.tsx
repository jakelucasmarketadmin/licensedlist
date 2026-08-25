import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import styleLight from "../../map/style-light.json";
import styleDark from "../../map/style-dark.json";

/**
 * List-page map (MapLibre GL + OpenFreeMap tiles, no key). Pins are rating
 * chips; hover syncs both ways with the server-rendered result cards via
 * [data-biz-card] DOM hooks; "Search this area" filters the visible list to
 * the current bounds. Desktop shows it sticky beside the list; mobile gets a
 * toggle button opening a full-height sheet. DOM markers, no clustering yet —
 * page sets are small; switch to a clustered GeoJSON source when counts grow.
 */

export interface MapBiz {
  slug: string;
  name: string;
  rating: number | null;
  lat: number;
  lng: number;
}

interface Props {
  markers: MapBiz[];
  /** "split" renders inline (desktop rail); "sheet" renders the mobile toggle. */
  variant?: "split" | "sheet";
}

function bboxOf(markers: MapBiz[]) {
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  return {
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
    minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
  };
}

function MapInner({ markers }: { markers: MapBiz[] }) {
  const mapRef = useRef<MapRef>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // List → map hover sync via the server-rendered cards' data attributes.
  useEffect(() => {
    const over = (e: Event) => {
      const card = (e.target as HTMLElement).closest?.("[data-biz-card]");
      if (card) setHovered(card.getAttribute("data-biz-card"));
    };
    const out = (e: Event) => {
      if ((e.target as HTMLElement).closest?.("[data-biz-card]")) setHovered(null);
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
    };
  }, []);

  // Map → list: highlight the matching card.
  const highlightCard = useCallback((slug: string | null) => {
    document.querySelectorAll<HTMLElement>("[data-biz-card]").forEach((el) => {
      el.classList.toggle("ring-2", el.getAttribute("data-biz-card") === slug);
      el.classList.toggle("ring-accent", el.getAttribute("data-biz-card") === slug);
    });
  }, []);

  const searchThisArea = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const b = map.getBounds();
    document.querySelectorAll<HTMLElement>("[data-biz-card]").forEach((el) => {
      const lat = Number(el.getAttribute("data-lat"));
      const lng = Number(el.getAttribute("data-lng"));
      const inside =
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= b.getSouth() && lat <= b.getNorth() && lng >= b.getWest() && lng <= b.getEast();
      el.classList.toggle("hidden", !inside);
    });
    setMoved(false);
  }, []);

  const resetArea = useCallback(() => {
    document.querySelectorAll<HTMLElement>("[data-biz-card]").forEach((el) => el.classList.remove("hidden"));
    const box = bboxOf(markers);
    mapRef.current?.fitBounds(
      [[box.minLng, box.minLat], [box.maxLng, box.maxLat]],
      { padding: 60, duration: 400, maxZoom: 13 },
    );
  }, [markers]);

  const initial = useMemo(() => {
    const box = bboxOf(markers);
    return {
      bounds: [[box.minLng - 0.03, box.minLat - 0.03], [box.maxLng + 0.03, box.maxLat + 0.03]] as [
        [number, number], [number, number],
      ],
      fitBoundsOptions: { padding: 60, maxZoom: 13 },
    };
  }, [markers]);

  if (markers.length === 0) return null;
  return (
    <div className="relative h-full w-full overflow-hidden rounded-card border border-line">
      <Map
        ref={mapRef}
        initialViewState={initial}
        mapStyle={(dark ? styleDark : styleLight) as any}
        attributionControl={{ compact: true }}
        onDragEnd={() => setMoved(true)}
        onZoomEnd={() => setMoved(true)}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {markers.map((m) => (
          <Marker key={m.slug} longitude={m.lng} latitude={m.lat} anchor="bottom">
            <a
              href={`/business/${m.slug}`}
              aria-label={`${m.name}${m.rating ? `, rated ${m.rating}` : ""}`}
              onMouseEnter={() => highlightCard(m.slug)}
              onMouseLeave={() => highlightCard(null)}
              className={`block rounded-chip border px-2 py-0.5 font-mono text-xs font-semibold shadow-sm transition-transform ${
                hovered === m.slug
                  ? "z-10 scale-125 border-transparent bg-accent text-accent-ink"
                  : "border-line-strong bg-surface text-ink"
              }`}
            >
              {m.rating ?? "•"}
            </a>
          </Marker>
        ))}
      </Map>
      {moved && (
        <button
          type="button"
          onClick={searchThisArea}
          className="absolute left-1/2 top-3 -translate-x-1/2 rounded-chip bg-accent px-4 py-2 text-sm font-semibold text-accent-ink shadow-md"
        >
          Search this area
        </button>
      )}
      <button
        type="button"
        onClick={resetArea}
        className="absolute bottom-6 left-3 rounded-chip border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-sm"
      >
        Reset
      </button>
    </div>
  );
}

export default function ListMap({ markers, variant = "split" }: Props) {
  const [open, setOpen] = useState(false);
  const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  if (valid.length === 0) return null;

  if (variant === "sheet") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-chip bg-brand-deep px-5 py-2.5 text-sm font-semibold text-white shadow-lg lg:hidden"
          aria-haspopup="dialog"
        >
          Map
        </button>
        {open && (
          <div role="dialog" aria-label="Map of results" className="fixed inset-0 z-50 flex flex-col bg-paper lg:hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-display text-lg font-semibold text-ink">Map</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-chip border border-line-strong px-4 py-1.5 text-sm font-medium text-ink"
              >
                Close
              </button>
            </div>
            <div className="flex-1 p-3">
              <MapInner markers={valid} />
            </div>
          </div>
        )}
      </>
    );
  }
  return <MapInner markers={valid} />;
}
