import { useEffect, useState } from 'react';

/**
 * Review submission form (/write-review).
 *
 * Two entry paths: an invitation token (?token=…) resolves the business via
 * /api/review-token and yields a verified-hire review; the public path
 * (?biz=slug) submits an unverified, labeled review. The verified flag is
 * decided server-side in /api/submit-review either way.
 */
interface Props {
  businessSlug?: string;
  businessName?: string;
  token?: string;
}

const ASPECTS: [string, string][] = [
  ['quality', 'Quality of work'],
  ['communication', 'Communication'],
  ['value', 'Value'],
  ['timeliness', 'Timeliness'],
];

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none';

function Stars({
  value,
  onChange,
  label,
  size = 'text-2xl',
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  size?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          className={`${size} leading-none transition-colors ${n <= value ? 'text-accent' : 'text-line-strong hover:text-faint'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function WriteReviewForm({ businessSlug, businessName, token }: Props) {
  const [resolved, setResolved] = useState<{
    slug: string;
    name: string;
    verified: boolean;
  } | null>(businessSlug ? { slug: businessSlug, name: businessName ?? businessSlug, verified: false } : null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [rating, setRating] = useState(0);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    body: '',
    jobType: '',
    reviewerName: '',
    reviewerEmail: '',
    townName: '',
    company: '', // honeypot
  });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/review-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setResolved({ slug: res.businessSlug, name: res.businessName || res.businessSlug, verified: true });
          if (res.reviewerName) setForm((f) => ({ ...f, reviewerName: res.reviewerName }));
        } else {
          setTokenError(
            res.error === 'already used'
              ? 'This review link was already used — each invitation works once.'
              : 'This review link is invalid or expired. You can still leave a public review from the business profile.',
          );
        }
      })
      .catch(() => setTokenError('Could not check the review link — please try again.'));
  }, [token]);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.company || !resolved || rating === 0) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSlug: resolved.slug,
          token: resolved.verified ? token : '',
          rating,
          aspects,
          ...form,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  if (tokenError && !resolved) {
    return (
      <p className="rounded-card border border-warn bg-warn-wash px-4 py-3 text-sm text-warn" role="alert">
        {tokenError}
      </p>
    );
  }
  if (!resolved) {
    return token ? (
      <p className="text-sm text-muted" role="status">Checking your review link…</p>
    ) : (
      <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-muted">
        No business selected — open “Write a review” from a business profile.
      </p>
    );
  }
  if (status === 'success') {
    return (
      <div className="rounded-card border border-line bg-ok-wash p-5" role="status">
        <h2 className="font-display text-lg font-semibold text-ok">Review submitted</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Thanks — your review of {resolved.name} is in moderation and will appear on the profile
          once it clears the checks in our review policy. We check identity and job linkage only —
          never the rating.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Review {resolved.name}</h2>
        {resolved.verified ? (
          <p className="mt-1.5 inline-block rounded-chip bg-[#177245] px-2.5 py-1 text-xs font-semibold text-white">
            Verified hire — this link came from your completed job
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-muted">
            Public review — it will be labeled “Unverified” because the hire didn't go through
            TriVetted.
          </p>
        )}
      </div>

      <div>
        <span className="block text-sm font-medium text-ink">Overall rating *</span>
        <div className="mt-1">
          <Stars value={rating} onChange={setRating} label="Overall rating" size="text-3xl" />
        </div>
      </div>

      <fieldset className="rounded-card border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-medium text-ink">Rate the details (optional)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ASPECTS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">{label}</span>
              <Stars
                value={aspects[key] ?? 0}
                onChange={(n) => setAspects((a) => ({ ...a, [key]: n }))}
                label={label}
                size="text-lg"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="rv-body" className="block text-sm font-medium text-ink">
          Your review *
        </label>
        <textarea
          id="rv-body"
          required
          rows={5}
          maxLength={4000}
          value={form.body}
          onChange={set('body')}
          className={`mt-1 ${inputClass}`}
          placeholder="What was the job, how did it go, and would you hire them again?"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rv-job" className="block text-sm font-medium text-ink">Job type</label>
          <input id="rv-job" maxLength={80} value={form.jobType} onChange={set('jobType')} className={`mt-1 ${inputClass}`} placeholder="e.g. Water heater replacement" />
        </div>
        <div>
          <label htmlFor="rv-town" className="block text-sm font-medium text-ink">Your town</label>
          <input id="rv-town" maxLength={80} value={form.townName} onChange={set('townName')} className={`mt-1 ${inputClass}`} placeholder="e.g. Westwood, NJ" />
        </div>
        <div>
          <label htmlFor="rv-name" className="block text-sm font-medium text-ink">Your name *</label>
          <input id="rv-name" required maxLength={80} autoComplete="name" value={form.reviewerName} onChange={set('reviewerName')} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="rv-email" className="block text-sm font-medium text-ink">Email * (never shown publicly)</label>
          <input id="rv-email" type="email" required maxLength={120} autoComplete="email" value={form.reviewerEmail} onChange={set('reviewerEmail')} className={`mt-1 ${inputClass}`} />
        </div>
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="rv-company">Company</label>
        <input id="rv-company" tabIndex={-1} autoComplete="off" value={form.company} onChange={set('company')} />
      </div>

      {status === 'error' && (
        <p className="rounded-[10px] bg-danger-wash px-3 py-2 text-sm text-danger" role="alert">
          Something went wrong — please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting' || rating === 0}
        className="rounded-chip bg-accent px-6 py-3 text-base font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {status === 'submitting' ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}
