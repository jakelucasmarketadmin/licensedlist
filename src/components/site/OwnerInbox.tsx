import { useEffect, useState } from 'react';

/**
 * Owner inbox tabs: lead pipeline (new → contacted → won/lost), review
 * responses with labeled AI-drafted suggestions (owner edits, never
 * auto-posted). All server calls go through
 * /api/owner-inbox, which re-checks the approved claim on every request.
 */
interface Lead {
  _id: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  urgency: string;
  status: string;
  wonAt: string | null;
  reviewInviteSentAt: string | null;
  reviewSubmittedAt: string | null;
  createdAt: string | null;
}
interface Review {
  _id: string;
  reviewerName: string;
  rating: number;
  body: string;
  jobType: string;
  verifiedHire: boolean;
  moderationStatus: string;
  ownerResponse: string;
  ownerFlag: string;
  createdAt: string | null;
}

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none';
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

async function post(action: string, payload: Record<string, unknown>) {
  const res = await fetch('/api/owner-inbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

export default function OwnerInbox() {
  const [tab, setTab] = useState<'leads' | 'reviews'>('leads');
  const [data, setData] = useState<{ leads: Lead[]; reviews: Review[] } | null | 'loading'>('loading');

  const reload = () =>
    fetch('/api/owner-inbox')
      .then((r) => r.json())
      .then((r) => setData(r.ok ? { leads: r.leads, reviews: r.reviews } : null))
      .catch(() => setData(null));

  useEffect(() => {
    reload();
  }, []);

  if (data === 'loading') return <p className="text-sm text-muted">Loading inbox…</p>;
  if (data === null) return null;

  const tabs: ['leads' | 'reviews', string][] = [
    ['leads', `Leads (${data.leads.filter((l) => l.status === 'new').length} new)`],
    ['reviews', `Reviews (${data.reviews.length})`],
  ];

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <h3 className="font-display text-lg font-semibold text-ink">Inbox</h3>
      <div className="mt-3 flex gap-1 border-b border-line" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'leads' && <LeadsTab leads={data.leads} onChange={reload} />}
      {tab === 'reviews' && <ReviewsTab reviews={data.reviews} onChange={reload} />}
    </div>
  );
}

function LeadsTab({ leads, onChange }: { leads: Lead[]; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!leads.length) return <p className="mt-4 text-sm text-faint">No quote requests yet.</p>;
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs leading-relaxed text-faint">
        Mark a job <span className="font-semibold">Won</span> when you complete it — 7 days later
        the customer automatically gets a one-time review link. Invitations go to every won job
        (that's the rule that makes “verified hire” reviews credible).
      </p>
      {leads
        .slice()
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .map((l) => (
          <div key={l._id} className="rounded-[10px] border border-line p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-ink">{l.name}</span>
              <span className="text-faint">{fmt(l.createdAt)}</span>
              <span className="rounded-chip bg-inset px-2 py-0.5 text-[11px] text-muted">{l.urgency}</span>
              {l.reviewSubmittedAt ? (
                <span className="rounded-chip bg-ok-wash px-2 py-0.5 text-[11px] font-medium text-ok">reviewed</span>
              ) : l.reviewInviteSentAt ? (
                <span className="rounded-chip bg-inset px-2 py-0.5 text-[11px] text-muted">review link sent</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">{l.message}</p>
            <p className="mt-1 text-xs text-faint">{l.phone} · {l.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(['new', 'contacted', 'won', 'lost'] as const).map((s) => (
                <button
                  key={s}
                  disabled={busy === l._id}
                  onClick={async () => {
                    setBusy(l._id);
                    await post('lead-status', { id: l._id, status: s }).catch(() => {});
                    setBusy(null);
                    onChange();
                  }}
                  className={`rounded-chip px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${l.status === s ? 'bg-brand text-white' : 'border border-line text-muted hover:border-brand hover:text-ink'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function ReviewsTab({ reviews, onChange }: { reviews: Review[]; onChange: () => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftSource, setDraftSource] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  if (!reviews.length)
    return <p className="mt-4 text-sm text-faint">No on-site reviews yet. Win jobs through quote requests and reviews follow automatically.</p>;
  return (
    <div className="mt-4 space-y-3">
      {reviews.map((r) => (
        <div key={r._id} className="rounded-[10px] border border-line p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-ink">{r.reviewerName}</span>
            <span className="text-ink">{r.rating}★</span>
            {r.verifiedHire && <span className="rounded-chip bg-ok-wash px-2 py-0.5 text-[11px] font-medium text-ok">verified hire</span>}
            <span className="rounded-chip bg-inset px-2 py-0.5 text-[11px] text-muted">{r.moderationStatus}</span>
            <span className="ml-auto text-xs text-faint">{fmt(r.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{r.body}</p>
          {r.ownerResponse ? (
            <p className="mt-2 rounded-[8px] bg-inset p-2 text-sm text-muted">
              <span className="font-semibold text-ink">Your response:</span> {r.ownerResponse}
            </p>
          ) : (
            <div className="mt-2">
              <textarea
                rows={2}
                value={drafts[r._id] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [r._id]: e.target.value }))}
                className={inputClass}
                placeholder="Write a public response…"
              />
              {draftSource[r._id] && (
                <p className="mt-1 text-[11px] text-faint">
                  {draftSource[r._id] === 'ai' ? 'AI-drafted suggestion' : 'Suggested draft'} — edit before posting; it is never posted automatically.
                </p>
              )}
              <div className="mt-1.5 flex gap-2">
                <button
                  disabled={busy === r._id}
                  onClick={async () => {
                    setBusy(r._id);
                    const res = await post('draft-reply', { id: r._id }).catch(() => null);
                    setBusy(null);
                    if (res?.ok) {
                      setDrafts((d) => ({ ...d, [r._id]: res.draft }));
                      setDraftSource((s) => ({ ...s, [r._id]: res.source }));
                    }
                  }}
                  className="rounded-chip border border-line px-3 py-1.5 text-xs font-medium text-muted hover:border-brand hover:text-ink disabled:opacity-50"
                >
                  Suggest a reply
                </button>
                <button
                  disabled={busy === r._id || !(drafts[r._id] ?? '').trim()}
                  onClick={async () => {
                    setBusy(r._id);
                    await post('respond-review', { id: r._id, response: drafts[r._id] }).catch(() => {});
                    setBusy(null);
                    onChange();
                  }}
                  className="rounded-chip bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50"
                >
                  Post response
                </button>
                {!r.ownerFlag && (
                  <button
                    disabled={busy === r._id}
                    onClick={async () => {
                      const reason = window.prompt('Why should we re-check this review? (fake, wrong business, policy violation…)');
                      if (!reason) return;
                      setBusy(r._id);
                      await post('flag-review', { id: r._id, reason }).catch(() => {});
                      setBusy(null);
                      onChange();
                    }}
                    className="ml-auto text-xs text-faint underline underline-offset-2 hover:text-muted"
                  >
                    Flag for moderation
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-faint">
        Responses are public. Reviews can't be edited or removed here — flag one and we re-check
        identity and job linkage (never the rating).
      </p>
    </div>
  );
}

