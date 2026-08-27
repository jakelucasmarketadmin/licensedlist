import { useEffect, useState } from 'react';
import { MemberProvider, useMember } from '@/integrations';

/**
 * /saved (D1): saved businesses with recent activity (new reviews, deals).
 * Guests: localStorage list only. Signed-in members: named lists synced to
 * the `savedLists` collection; the local list merges into "My saved pros" on
 * first sign-in so nothing is lost.
 */
interface SavedBiz {
  slug: string;
  name: string;
  city: string;
  state: string;
  category: string;
  rating: number | null;
  licenseStatus: string;
  phone: string;
  activity: { kind: string; text: string }[];
}
interface SavedList {
  _id: string;
  name: string;
  slugs: string[];
}

const readLocal = (): string[] => {
  try { return JSON.parse(localStorage.getItem('tv-saved') || '[]'); } catch { return []; }
};

function Portal() {
  const { isAuthenticated, isLoading, actions } = useMember() as any;
  const [lists, setLists] = useState<SavedList[] | null>(null);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<SavedBiz[] | null>(null);
  const [localSlugs, setLocalSlugs] = useState<string[]>([]);

  // Load member lists (merging localStorage into the default list once).
  useEffect(() => {
    const local = readLocal();
    setLocalSlugs(local);
    if (!isAuthenticated) return;
    (async () => {
      try {
        const res = await fetch('/api/saved-lists').then((r) => r.json());
        if (!res.ok) return;
        let all: SavedList[] = res.lists;
        if (local.length) {
          const main = all.find((l) => l.name === 'My saved pros');
          const merged = [...new Set([...(main?.slugs ?? []), ...local])];
          const up = await fetch('/api/saved-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'upsert', id: main?._id, name: 'My saved pros', slugs: merged }),
          }).then((r) => r.json());
          if (up.ok) {
            all = main
              ? all.map((l) => (l._id === main._id ? { ...l, slugs: merged } : l))
              : [...all, { _id: up.id, name: 'My saved pros', slugs: merged }];
          }
        }
        setLists(all);
        if (all.length) setActiveList(all[0]._id);
      } catch { /* stay on local */ }
    })();
  }, [isAuthenticated]);

  // Resolve the visible slugs → business cards.
  const visibleSlugs = isAuthenticated && lists
    ? (lists.find((l) => l._id === activeList)?.slugs ?? [])
    : localSlugs;
  useEffect(() => {
    if (!visibleSlugs.length) { setBusinesses([]); return; }
    fetch('/api/saved-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs: visibleSlugs }),
    })
      .then((r) => r.json())
      .then((res) => setBusinesses(res.ok ? res.businesses : []))
      .catch(() => setBusinesses([]));
  }, [JSON.stringify(visibleSlugs)]);

  async function newList() {
    const name = window.prompt('Name the list (e.g. "Kitchen reno")');
    if (!name) return;
    const res = await fetch('/api/saved-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert', name, slugs: [] }),
    }).then((r) => r.json());
    if (res.ok) {
      setLists((l) => [...(l ?? []), { _id: res.id, name, slugs: [] }]);
      setActiveList(res.id);
    }
  }

  function unsave(slug: string) {
    if (isAuthenticated && lists && activeList) {
      const list = lists.find((l) => l._id === activeList);
      if (!list) return;
      const slugs = list.slugs.filter((s) => s !== slug);
      fetch('/api/saved-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', id: list._id, name: list.name, slugs }),
      }).catch(() => {});
      setLists(lists.map((l) => (l._id === activeList ? { ...l, slugs } : l)));
    } else {
      const next = readLocal().filter((s) => s !== slug);
      try { localStorage.setItem('tv-saved', JSON.stringify(next)); } catch { /* noop */ }
      setLocalSlugs(next);
    }
  }

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {isAuthenticated && lists ? (
          <>
            {lists.map((l) => (
              <button
                key={l._id}
                onClick={() => setActiveList(l._id)}
                className={`rounded-chip px-3 py-1.5 text-sm font-medium ${activeList === l._id ? 'bg-brand text-white' : 'border border-line text-muted hover:text-ink'}`}
              >
                {l.name} · {l.slugs.length}
              </button>
            ))}
            <button onClick={newList} className="rounded-chip border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-inset">
              + New list
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">
            Saved on this device only —{' '}
            <button onClick={actions.login} className="font-medium text-brand underline underline-offset-2">
              sign in
            </button>{' '}
            to keep lists on your account and name them by project.
          </p>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {businesses === null ? (
          <p className="text-sm text-muted">Loading saved businesses…</p>
        ) : businesses.length === 0 ? (
          <div className="rounded-card border border-line bg-surface p-6">
            <p className="text-sm leading-relaxed text-muted">
              Nothing saved yet. Tap <span className="font-semibold text-ink">♡ Save</span> on any
              business profile and it shows up here — along with new reviews and deals from the
              businesses you follow.
            </p>
            <a href="/categories" className="mt-3 inline-block rounded-chip bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
              Browse categories
            </a>
          </div>
        ) : (
          businesses.map((b) => (
            <div key={b.slug} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <a href={`/business/${b.slug}`} className="font-display text-lg font-semibold text-ink hover:text-brand">{b.name}</a>
                <span className="text-xs text-faint">{b.category} · {b.city}, {b.state}</span>
                {b.rating !== null && <span className="text-sm font-semibold text-ink">{b.rating}★</span>}
                {b.licenseStatus === 'verified' && (
                  <span className="rounded-chip bg-ok-wash px-2 py-0.5 text-[11px] font-semibold text-ok">License verified</span>
                )}
                <button onClick={() => unsave(b.slug)} className="ml-auto text-xs text-faint underline underline-offset-2 hover:text-muted">
                  Remove
                </button>
              </div>
              {b.activity.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {b.activity.map((a, i) => (
                    <li key={i} className="text-sm text-muted">
                      <span className={`mr-1.5 rounded-chip px-1.5 py-0.5 text-[10px] font-semibold uppercase ${a.kind === 'offer' ? 'bg-warn-wash text-warn' : 'bg-brand-wash text-brand'}`}>
                        {a.kind === 'offer' ? 'Deal' : 'New'}
                      </span>
                      {a.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function SavedPortal() {
  return (
    <MemberProvider>
      <Portal />
    </MemberProvider>
  );
}
