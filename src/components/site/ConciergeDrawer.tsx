import { useState } from 'react';

/**
 * "Ask TriVetted" drawer (D3). Rendered ONLY when the server has an
 * ANTHROPIC_API_KEY (SiteLayout gates it), so there is never a dead button.
 * Answers come from /api/concierge — grounded in our own listings, guides,
 * reviews, and license data, with citations.
 */
interface Exchange {
  q: string;
  a?: string;
  citations?: { title: string; path: string }[];
  suggestQuote?: boolean;
  quotePath?: string;
  error?: string;
}

export default function ConciergeDrawer() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [log, setLog] = useState<Exchange[]>([]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (question.length < 5 || busy) return;
    setBusy(true);
    setQ('');
    setLog((l) => [...l, { q: question }]);
    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setLog((l) =>
        l.map((x, i) =>
          i === l.length - 1
            ? data.ok
              ? { ...x, a: data.answer, citations: data.citations, suggestQuote: data.suggestQuote, quotePath: data.quotePath }
              : { ...x, error: data.error ?? 'Something went wrong.' }
            : x,
        ),
      );
    } catch {
      setLog((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, error: 'Something went wrong.' } : x)));
    }
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-chip bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-90"
        aria-haspopup="dialog"
      >
        Ask TriVetted
      </button>
      {open && (
        <div role="dialog" aria-label="Ask TriVetted" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-paper shadow-2xl">
          <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
            <div>
              <p className="font-display text-lg font-semibold text-ink">Ask TriVetted</p>
              <p className="text-[11px] text-faint">Answers come from our own listings, guides &amp; license data</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-chip border border-line-strong px-3 py-1.5 text-sm font-medium text-ink">
              Close
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {log.length === 0 && (
              <div className="text-sm leading-relaxed text-muted">
                <p>Try:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>"Do plumbers need a license in NJ?"</li>
                  <li>"Who does emergency drain work near Westwood?"</li>
                  <li>"How do you verify businesses?"</li>
                </ul>
              </div>
            )}
            {log.map((x, i) => (
              <div key={i}>
                <p className="ml-8 rounded-card bg-brand-wash px-3 py-2 text-sm text-ink">{x.q}</p>
                {x.a ? (
                  <div className="mt-2 mr-8 rounded-card border border-line bg-surface px-3 py-2">
                    <p className="text-sm leading-relaxed text-muted">{x.a}</p>
                    {x.citations && x.citations.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2 text-xs">
                        {x.citations.map((c) => (
                          <a key={c.path} href={c.path} className="text-brand underline underline-offset-2">{c.title}</a>
                        ))}
                      </p>
                    )}
                    {x.suggestQuote && x.quotePath && (
                      <a href={x.quotePath} className="mt-2 inline-block rounded-chip bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink">
                        Start a quote request
                      </a>
                    )}
                  </div>
                ) : x.error ? (
                  <p className="mt-2 mr-8 rounded-card bg-danger-wash px-3 py-2 text-sm text-danger">{x.error}</p>
                ) : (
                  <p className="mt-2 mr-8 text-sm text-faint">Thinking…</p>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={ask} className="border-t border-line bg-surface p-3">
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={400}
                placeholder="Ask about local pros, licenses, hiring…"
                className="w-full flex-1 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                aria-label="Your question"
              />
              <button type="submit" disabled={busy || q.trim().length < 5} className="shrink-0 rounded-chip bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
                Ask
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-faint">
              AI answers from TriVetted's own data — may be imperfect; not legal or medical advice.
              Rate-limited; questions are logged without your identity.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
