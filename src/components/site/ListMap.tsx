import { useEffect, useRef, useState } from "react";
import { loadMaplibre } from "../../lib/maplibre-loader";
import styleLight from "../../map/style-light.json";
import styleDark from "../../map/style-dark.json";

/**
 * List-page map (MapLibre GL + OpenFreeMap tiles, no key), driven imperatively
 * — no react wrapper, so it's immune to duplicate-React interop issues. Pins
 * are rating chips; hover syncs both ways with the server-rendered result
 * cards via [data-biz-card] DOM hooks; "Search this area" filters the visible
 * list to the current bounds. DOM markers, no clustering yet — page sets are
 * small; switch to a clustered GeoJSON source when counts grow.
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

function boundsOf(markers: MapBiz[]): [[number, number], [number, number]] {
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  return [
    [Math.min(...lngs) - 0.02, Math.min(...lats) - 0.02],
    [Math.max(...lngs) + 0.02, Math.max(...lats) + 0.02],
  ];
}

function highlightCard(slug: string | null) {
  document.querySelectorAll<HTMLElement>("[data-biz-card]").forEach((el) => {
    const on = el.getAttribute("data-biz-card") === slug;
    el.classList.toggle("ring-2", on);
    el.classList.toggle("ring-accent", on);
  });
}

/** WebGL context check — MapLibre needs GL; some Chrome setups (hardware
 * acceleration off, GPU blocklist) can't create one. DOM pins would still
 * render over an empty canvas, so detect up front and fall back. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

function MapInner({ markers }: { markers: MapBiz[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const chipsRef = useRef(new Map<string, HTMLElement>());
  const [moved, setMoved] = useState(false);
  const [glFailed, setGlFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!webglAvailable()) {
      console.error("ListMap: WebGL unavailable — showing static area map");
      setGlFailed(true);
      return;
    }
    let disposed = false;
    let cleanup: (() => void) | undefined;
    (async () => {
    const mod: any = await loadMaplibre();
    const maplibregl = mod.default ?? mod;
    if (disposed || !containerRef.current) return;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    let map: any;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: (dark ? styleDark : styleLight) as any,
        bounds: boundsOf(markers),
        fitBoundsOptions: { padding: 60, maxZoom: 13 },
        attributionControl: {
          compact: true,
          customAttribution: "Map data © OpenStreetMap contributors · OpenFreeMap",
        },
      });
    } catch (err) {
      console.error("ListMap: map init failed", err);
      setGlFailed(true);
      return;
    }
    map.on("error", (e: any) => console.error("ListMap maplibre error:", e?.error ?? e));
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("dragend", () => setMoved(true));
    map.on("zoomend", () => setMoved(true));

    for (const m of markers) {
      const el = document.createElement("a");
      el.href = `/business/${m.slug}`;
      el.setAttribute("aria-label", `${m.name}${m.rating ? `, rated ${m.rating}` : ""}`);
      el.className =
        "block cursor-pointer rounded-chip border border-line-strong bg-surface px-2 py-0.5 font-mono text-xs font-semibold text-ink shadow-sm transition-transform";
      el.textContent = m.rating != null ? String(m.rating) : "•";
      el.addEventListener("mouseenter", () => highlightCard(m.slug));
      el.addEventListener("mouseleave", () => highlightCard(null));
      chipsRef.current.set(m.slug, el);
      new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([m.lng, m.lat]).addTo(map);
    }

    // List → map hover sync.
    const over = (e: Event) => {
      const card = (e.target as HTMLElement).closest?.("[data-biz-card]");
      if (!card) return;
      const chip = chipsRef.current.get(card.getAttribute("data-biz-card") ?? "");
      if (chip) {
        chip.classList.add("pin-bounce", "!bg-accent", "!text-accent-ink", "z-10");
      }
    };
    const out = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.("[data-biz-card]")) return;
      chipsRef.current.forEach((chip) =>
        chip.classList.remove("pin-bounce", "!bg-accent", "!text-accent-ink", "z-10"),
      );
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    cleanup = () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
      map.remove();
      mapRef.current = null;
    };
    })();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  const searchThisArea = () => {
    const map = mapRef.current;
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
  };

  const resetArea = () => {
    document.querySelectorAll<HTMLElement>("[data-biz-card]").forEach((el) => el.classList.remove("hidden"));
    mapRef.current?.fitBounds(boundsOf(markers), { padding: 60, duration: 400, maxZoom: 13 });
    setMoved(false);
  };

  if (markers.length === 0) return null;
  return (
    <div className="relative h-full w-full overflow-hidden rounded-card border border-line">
      {/* Static area map sits UNDER the GL canvas: if WebGL/tiles ever fail,
          the panel shows geography instead of an empty box. */}
      <img
        src="/assets/tri-state-map.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <div ref={containerRef} className="relative h-full w-full" />
      {glFailed && (
        <p className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-chip bg-brand-deep/85 px-3 py-1.5 text-xs font-medium text-white shadow-md">
          Interactive map unavailable in this browser — showing the area map
        </p>
      )}
      {moved && (
        <button
          type="button"
          onClick={searchThisArea}
          className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-chip bg-accent px-4 py-2 text-sm font-semibold text-accent-ink shadow-md"
        >
          Search this area
        </button>
      )}
      <button
        type="button"
        onClick={resetArea}
        className="absolute bottom-6 left-3 z-10 rounded-chip border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-sm"
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
