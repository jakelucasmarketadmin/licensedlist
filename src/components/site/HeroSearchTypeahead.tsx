import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Hero search: two accessible typeahead comboboxes (ARIA 1.2 pattern) backed
 * by /api/suggest. Replaces the old native <datalist> (which dumped all 62
 * categories unsorted on click).
 *
 * Empty "What" shows only the 8 popular categories + a browse-all link; typing
 * shows ≤6 ranked category matches and ≤3 published businesses. "Where" shows
 * ≤6 town/county rows plus "Use my location". Selecting a category/place fills
 * the field; business rows navigate straight to the profile.
 */

interface Row {
  key: string;
  label: string;
  sublabel?: string;
  group: string;
  /** When set, selecting navigates instead of filling the field. */
  href?: string;
  /** When set, selecting runs this instead (Use my location). */
  action?: "locate";
}

interface FieldProps {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rows: Row[];
  onOpen: () => void;
  onQuery: (q: string) => void;
  onLocate?: () => void;
  className?: string;
}

function TypeaheadField({
  id, name, label, placeholder, value, onChange, rows, onOpen, onQuery, onLocate, className,
}: FieldProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = `${id}-listbox`;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => setActive(-1), [rows]);

  const select = (row: Row) => {
    if (row.action === "locate") {
      onLocate?.();
      return;
    }
    if (row.href) {
      window.location.assign(row.href);
      return;
    }
    onChange(row.label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); onOpen(); return; }
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
      if (open && active >= 0 && rows[active]) {
        e.preventDefault();
        select(rows[active]);
      }
      // else: fall through — the form submits the free text.
    }
  };

  let lastGroup = "";
  return (
    <div ref={wrapRef} className={className}>
      <label htmlFor={id} className="block px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-faint">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={open && rows.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { setOpen(true); onOpen(); }}
        onKeyDown={onKeyDown}
        className="w-full bg-transparent px-3 pb-2 pt-1 text-base text-ink placeholder:text-faint focus:outline-none"
      />
      {open && rows.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain rounded-card border border-line-strong bg-surface py-1 shadow-lg"
        >
          {rows.map((row, i) => {
            const header = row.group !== lastGroup ? row.group : null;
            lastGroup = row.group;
            return (
              <li key={row.key}>
                {header && (
                  <div aria-hidden="true" className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
                    {header}
                  </div>
                )}
                <div
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={active === i}
                  onMouseDown={(e) => { e.preventDefault(); select(row); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                    active === i ? "bg-brand-wash text-ink" : "text-ink"
                  }`}
                >
                  <span className="font-medium">{row.label}</span>
                  {row.sublabel && <span className="shrink-0 text-xs text-faint">{row.sublabel}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface Props {
  popular: { name: string; slug: string }[];
}

export default function HeroSearchTypeahead({ popular }: Props) {
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [whatResults, setWhatResults] = useState<Row[]>([]);
  const [whereResults, setWhereResults] = useState<Row[]>([]);
  const [canLocate, setCanLocate] = useState(false);
  const timers = useRef<{ what?: number; where?: number }>({});
  const cache = useRef(new Map<string, any>());

  useEffect(() => {
    setCanLocate(typeof navigator !== "undefined" && "geolocation" in navigator);
  }, []);

  const popularRows: Row[] = useMemo(
    () => [
      ...popular.slice(0, 8).map((c) => ({ key: c.slug, label: c.name, group: "Popular" })),
      { key: "browse-all", label: "Browse all categories →", group: "Popular", href: "/categories" },
    ],
    [popular],
  );

  const fetchSuggest = useCallback(async (scope: string, q: string) => {
    const key = `${scope}:${q}`;
    if (cache.current.has(key)) return cache.current.get(key);
    const res = await fetch(`/api/suggest?scope=${scope}&q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = await res.json();
    cache.current.set(key, data);
    return data;
  }, []);

  const queryWhat = useCallback((q: string) => {
    window.clearTimeout(timers.current.what);
    const trimmed = q.trim();
    if (!trimmed) { setWhatResults(popularRows); return; }
    timers.current.what = window.setTimeout(async () => {
      const data = await fetchSuggest("what", trimmed);
      if (!data) return;
      setWhatResults([
        ...data.categories.map((c: any) => ({ key: `c-${c.slug}`, label: c.name, group: "Categories" })),
        ...data.businesses.map((b: any) => ({
          key: `b-${b.slug}`, label: b.name, sublabel: b.town, group: "Businesses", href: `/business/${b.slug}`,
        })),
      ]);
    }, 120);
  }, [fetchSuggest, popularRows]);

  const locateRow: Row = { key: "locate", label: "Use my location", group: "Places", action: "locate" };
  const queryWhere = useCallback((q: string) => {
    window.clearTimeout(timers.current.where);
    const trimmed = q.trim();
    if (!trimmed) { setWhereResults(canLocate ? [locateRow] : []); return; }
    timers.current.where = window.setTimeout(async () => {
      const data = await fetchSuggest("where", trimmed);
      if (!data) return;
      setWhereResults(
        data.places.map((p: any) => ({
          key: p.label, label: p.label, sublabel: p.sublabel, group: "Places",
        })),
      );
    }, 120);
  }, [fetchSuggest, canLocate]);

  const locate = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch(`/api/suggest?scope=near&lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.place) setWhere(data.place);
      },
      () => { /* denied — leave the field as typed */ },
    );
  }, []);

  return (
    <form action="/search" method="get" className="w-full" role="search" aria-label="Find a local business">
      <div className="relative flex flex-col gap-2 rounded-card border border-line-strong bg-surface p-2 shadow-sm sm:flex-row sm:items-stretch">
        <TypeaheadField
          id="search-what"
          name="what"
          label="What"
          placeholder="Roofer, dentist, attorney…"
          value={what}
          onChange={setWhat}
          rows={whatResults}
          onOpen={() => queryWhat(what)}
          onQuery={queryWhat}
          className="flex-1 border-line sm:border-r sm:pr-2"
        />
        <TypeaheadField
          id="search-where"
          name="where"
          label="Where"
          placeholder="Town or county"
          value={where}
          onChange={setWhere}
          rows={whereResults}
          onOpen={() => queryWhere(where)}
          onQuery={queryWhere}
          onLocate={locate}
          className="flex-1 border-t border-line pt-2 sm:border-t-0 sm:pt-0"
        />
        <button
          type="submit"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] bg-accent px-6 text-base font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Search
        </button>
      </div>
    </form>
  );
}
