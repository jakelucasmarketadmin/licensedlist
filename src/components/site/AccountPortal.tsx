import { useEffect, useState } from 'react';
import { MemberProvider, useMember } from '@/integrations';

/**
 * /account "My projects" (D1): the member's quote requests as projects —
 * pros contacted, pipeline status, review state, and (when the server has
 * AI) a one-line summary.
 */
interface Project {
  id: string;
  message: string;
  category: string;
  urgency: string;
  status: string;
  statusLabel: string;
  createdAt: string | null;
  reviewSubmitted: boolean;
  pros: { slug: string; name: string; phone: string }[];
  summary: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-inset text-muted',
  contacted: 'bg-brand-wash text-brand',
  won: 'bg-ok-wash text-ok',
  lost: 'bg-inset text-faint',
};

function Portal() {
  const { isAuthenticated, isLoading, actions } = useMember() as any;
  const [projects, setProjects] = useState<Project[] | null | 'error'>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/my-projects')
      .then((r) => r.json())
      .then((res) => setProjects(res.ok ? res.projects : 'error'))
      .catch(() => setProjects('error'));
  }, [isAuthenticated]);

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (!isAuthenticated) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 text-center">
        <h2 className="font-display text-xl font-semibold text-ink">Sign in to see your projects</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Quote requests you send with this email become projects here — with the pros you
          contacted and where each one stands.
        </p>
        <button onClick={actions.login} className="mt-4 rounded-chip bg-accent px-6 py-3 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
          Sign in / create account
        </button>
      </div>
    );
  }
  if (projects === null) return <p className="text-sm text-muted">Loading your projects…</p>;
  if (projects === 'error') return <p className="text-sm text-danger">Couldn't load projects — refresh to retry.</p>;
  if (projects.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-6">
        <p className="text-sm leading-relaxed text-muted">
          No projects yet. Send a quote request from any business profile (using this account's
          email) and it appears here automatically.
        </p>
        <a href="/categories" className="mt-3 inline-block rounded-chip bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
          Find a pro
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <div key={p.id} className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-chip px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status] ?? 'bg-inset text-muted'}`}>
              {p.statusLabel}
            </span>
            {p.category && <span className="text-xs text-faint">{p.category}</span>}
            {p.urgency && <span className="text-xs text-faint">· {p.urgency.replace('-', ' ')}</span>}
            {p.createdAt && (
              <span className="ml-auto text-xs text-faint">
                {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink">{p.summary ?? p.message}</p>
          {p.summary && <p className="mt-0.5 text-[10px] uppercase tracking-wide text-faint">AI summary · original request below</p>}
          {p.summary && <p className="mt-1 text-xs leading-relaxed text-muted">{p.message}</p>}
          {p.pros.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-faint">Contacted</span>
              {p.pros.map((pro) => (
                <a key={pro.slug} href={`/business/${pro.slug}`} className="font-medium text-brand underline underline-offset-2">
                  {pro.name}
                </a>
              ))}
            </p>
          )}
          {p.status === 'won' && !p.reviewSubmitted && (
            <p className="mt-2 rounded-[10px] bg-ok-wash px-3 py-2 text-xs text-ok">
              Job done? A one-time review link lands in your email about a week after the pro marks
              it complete.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AccountPortal() {
  return (
    <MemberProvider>
      <Portal />
    </MemberProvider>
  );
}
