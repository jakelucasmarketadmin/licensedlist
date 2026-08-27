import { useEffect, useState } from 'react';

/**
 * Owner dashboard 2.0 (Batch E): first-party stats over 30/90 days, the
 * anonymized county benchmark, completeness with exact missing items, the
 * AI-visibility score with ranked to-dos, "What's new" posts (30-day expiry),
 * offer creation, and the Verified/Featured upgrade path.
 */
interface Stats {
  windows: { last30: Record<string, number>; last90: Record<string, number> };
  reviews: { count: number; verifiedHires: number; average: number | null; awaitingResponse: number };
  benchmark: { peers: number; last30: Record<string, number> } | null;
  completeness: { pct: number; missing: string[] };
  aiVisibility: { score: number; todos: string[] };
}

const METRIC_LABELS: [string, string][] = [
  ['profile_view', 'Profile views'],
  ['call_click', 'Calls'],
  ['website_click', 'Website clicks'],
  ['quote_started', 'Quotes started'],
  ['quote_submitted', 'Quote requests'],
  ['save', 'Saves'],
  ['share', 'Shares'],
];

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none';

export default function OwnerStats({ tier }: { tier?: string }) {
  const [stats, setStats] = useState<Stats | null | 'error'>(null);
  const [win, setWin] = useState<'last30' | 'last90'>('last30');
  const [post, setPost] = useState('');
  const [postNote, setPostNote] = useState('');
  const [offer, setOffer] = useState({ title: '', details: '', terms: '', code: '', expiresAt: '' });
  const [offerNote, setOfferNote] = useState('');

  useEffect(() => {
    fetch('/api/owner-stats')
      .then((r) => r.json())
      .then((res) => setStats(res.ok ? res : 'error'))
      .catch(() => setStats('error'));
  }, []);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!post.trim()) return;
    const res = await fetch('/api/owner-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-post', text: post }),
    }).then((r) => r.json()).catch(() => ({ ok: false }));
    setPostNote(res.ok ? 'Posted — visible on your profile for 30 days.' : 'Post failed — try again.');
    if (res.ok) setPost('');
  }

  async function submitOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!offer.title.trim()) return;
    const res = await fetch('/api/owner-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-offer', ...offer }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'network' }));
    setOfferNote(res.ok ? res.note : res.error ?? 'Failed — try again.');
    if (res.ok) setOffer({ title: '', details: '', terms: '', code: '', expiresAt: '' });
  }

  if (stats === null) return <p className="text-sm text-muted">Loading stats…</p>;
  if (stats === 'error') return null;

  const w = stats.windows[win];
  const bench = stats.benchmark?.last30;

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-ink">Performance</h3>
          <div className="flex gap-1" role="tablist">
            {(['last30', 'last90'] as const).map((k) => (
              <button key={k} role="tab" aria-selected={win === k} onClick={() => setWin(k)}
                className={`rounded-chip px-3 py-1.5 text-xs font-semibold ${win === k ? 'bg-brand text-white' : 'border border-line text-muted hover:text-ink'}`}>
                {k === 'last30' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METRIC_LABELS.map(([key, label]) => (
            <div key={key} className="rounded-[10px] bg-inset px-3 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</dt>
              <dd className="mt-0.5 font-display text-2xl font-bold text-ink">{w[key] ?? 0}</dd>
              {win === 'last30' && bench && (
                <dd className="text-[11px] text-faint" title={`Average of ${stats.benchmark!.peers} similar ${stats.benchmark!.peers === 1 ? 'business' : 'businesses'} in your county (anonymized)`}>
                  similar: {bench[key] ?? 0}
                </dd>
              )}
            </div>
          ))}
        </dl>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span><span className="font-semibold text-ink">{stats.reviews.count}</span> on-site reviews</span>
          <span><span className="font-semibold text-ink">{stats.reviews.verifiedHires}</span> verified hires</span>
          {stats.reviews.average !== null && <span><span className="font-semibold text-ink">{stats.reviews.average}★</span> average</span>}
          {stats.reviews.awaitingResponse > 0 && (
            <span className="text-warn">{stats.reviews.awaitingResponse} awaiting your response ↓</span>
          )}
        </p>
        <p className="mt-2 text-[11px] leading-snug text-faint">
          First-party counters, day-bucketed, no personal data. Benchmark is the average of up
          to 3 similar businesses in your county — never named.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-5">
          <h3 className="font-display text-lg font-semibold text-ink">AI visibility score</h3>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-display text-4xl font-bold text-ink">{stats.aiVisibility.score}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-chip bg-inset">
              <div className="h-full rounded-chip bg-brand" style={{ width: `${stats.aiVisibility.score}%` }} />
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            How complete and structured your profile looks to AI assistants that recommend local
            pros. Top moves, in order of impact:
          </p>
          {stats.aiVisibility.todos.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              {stats.aiVisibility.todos.slice(0, 5).map((t) => <li key={t}>{t}</li>)}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-ok">Everything's filled in — nothing to do.</p>
          )}
        </div>

        <div className="rounded-card border border-line bg-surface p-5">
          <h3 className="font-display text-lg font-semibold text-ink">Post an update</h3>
          <p className="mt-1 text-xs text-faint">Shows in your profile's "What's new" for 30 days.</p>
          <form onSubmit={submitPost} className="mt-3">
            <textarea rows={3} maxLength={500} value={post} onChange={(e) => setPost(e.target.value)} className={inputClass} placeholder="e.g. Booking fall boiler tune-ups now — two crew slots open next week." />
            <div className="mt-2 flex items-center gap-3">
              <button type="submit" disabled={!post.trim()} className="rounded-chip bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">Post update</button>
              {postNote && <span className="text-xs text-muted" role="status">{postNote}</span>}
            </div>
          </form>

          <h3 className="mt-6 font-display text-lg font-semibold text-ink">Create a deal</h3>
          <form onSubmit={submitOffer} className="mt-3 space-y-2">
            <input value={offer.title} onChange={(e) => setOffer({ ...offer, title: e.target.value })} maxLength={100} className={inputClass} placeholder="Offer title, e.g. $50 off first service" />
            <input value={offer.details} onChange={(e) => setOffer({ ...offer, details: e.target.value })} maxLength={500} className={inputClass} placeholder="Details" />
            <div className="grid grid-cols-2 gap-2">
              <input value={offer.code} onChange={(e) => setOffer({ ...offer, code: e.target.value })} maxLength={30} className={inputClass} placeholder="Code (optional)" />
              <input type="date" value={offer.expiresAt} onChange={(e) => setOffer({ ...offer, expiresAt: e.target.value })} className={inputClass} aria-label="Expires" />
            </div>
            <input value={offer.terms} onChange={(e) => setOffer({ ...offer, terms: e.target.value })} maxLength={300} className={inputClass} placeholder="Terms (optional)" />
            <div className="flex items-center gap-3">
              <button type="submit" disabled={!offer.title.trim()} className="rounded-chip border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-inset disabled:opacity-50">Submit for review</button>
              {offerNote && <span className="text-xs text-muted" role="status">{offerNote}</span>}
            </div>
          </form>
        </div>
      </div>

      {(tier === 'free' || !tier) && (
        <div className="rounded-card bg-brand-deep p-5 text-white">
          <h3 className="font-display text-lg font-semibold">Upgrade your listing</h3>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-white/85">
            <span className="font-semibold text-white">Verified ($29/mo)</span> adds the registry-checked
            badge and unlimited offers. <span className="font-semibold text-white">Featured ($99/mo)</span> adds
            the labeled placement block — capped at 3 per category per county, and never changes
            organic ranking.
          </p>
          <a href="/pricing" className="mt-3 inline-block rounded-chip bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
            See plans &amp; check Featured availability
          </a>
        </div>
      )}
    </div>
  );
}
