import { useState } from 'react';

/**
 * "Describe your problem" intake (D2). Posts to /api/parse-intent and renders
 * matched pros with why-lines + criteria checkmarks. Works identically with
 * or without server-side AI (the API falls back to the rules parser); if the
 * API itself fails, the panel degrades to a plain link into classic search.
 */
interface Match {
  slug: string;
  name: string;
  city: string;
  state: string;
  rating: number | null;
  why: string;
  criteria: { label: string; met: boolean }[];
}

interface Result {
  intent: { category: string | null; town: string | null; urgency: string | null; confidence: string; source: string };
  matches: Match[];
  fallbackPath: string;
}

export default function NlIntake({ preview = false }: { preview?: boolean }) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 8) return;
    setState('busy');
    try {
      const res = await fetch('/api/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, preview }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setResult(data);
      setState('done');
      try {
        sessionStorage.setItem('tv-intent-message', text.trim());
      } catch { /* private mode */ }
    } catch {
      setState('error');
    }
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <form onSubmit={submit}>
        <label htmlFor="nl-intake" className="block text-sm font-semibold text-ink">
          Or just describe the problem
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <textarea
            id="nl-intake"
            rows={2}
            maxLength={600}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "Water heater leaking in Westwood, need someone this week"'
            className="w-full flex-1 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === 'busy' || text.trim().length < 8}
            className="shrink-0 self-start rounded-chip bg-brand-deep px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {state === 'busy' ? 'Matching…' : 'Find my pro'}
          </button>
        </div>
      </form>

      {state === 'error' && (
        <p className="mt-3 text-sm text-muted" role="alert">
          Matching is unavailable right now — try the{' '}
          <a href="/categories" className="font-medium text-brand underline underline-offset-2">category search</a> instead.
        </p>
      )}

      {state === 'done' && result && (
        <div className="mt-4 border-t border-line pt-4" aria-live="polite">
          <p className="text-xs text-faint">
            Understood as:{' '}
            <span className="text-muted">
              {[result.intent.category, result.intent.town, result.intent.urgency?.replace('-', ' ')]
                .filter(Boolean)
                .join(' · ') || 'general request'}
            </span>
            {result.intent.source === 'rules' && ' (keyword match)'}
          </p>
          {result.matches.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {result.matches.map((m) => (
                <li key={m.slug} className="rounded-card border border-line p-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <a href={`/business/${m.slug}${preview ? '?preview=demo' : ''}#quote`} className="font-display text-base font-semibold text-ink hover:text-brand">
                      {m.name}
                    </a>
                    <span className="text-xs text-faint">{m.city}, {m.state}</span>
                    {m.rating !== null && <span className="text-xs font-semibold text-ink">{m.rating}★</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{m.why}</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {m.criteria.map((c) => (
                      <span key={c.label} className={`text-xs ${c.met ? 'text-ok' : 'text-faint line-through'}`}>
                        {c.met ? '✓' : '✗'} {c.label}
                      </span>
                    ))}
                  </p>
                  <a
                    href={`/business/${m.slug}${preview ? '?preview=demo' : ''}#quote`}
                    className="mt-2 inline-block rounded-chip bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
                  >
                    Get a quote — form prefilled
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              No direct match yet —{' '}
              <a href={result.fallbackPath} className="font-medium text-brand underline underline-offset-2">
                browse {result.intent.category?.toLowerCase() ?? 'all categories'}
              </a>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
