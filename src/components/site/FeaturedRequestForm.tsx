import { useState } from 'react';
import { BaseCrudService } from '@/integrations';

/**
 * Featured-slot request with the 3-per-category-per-county cap enforced at
 * request time. Open slot → records a featured-request (we invoice / send the
 * plan checkout link). Cap full → waitlist entry (claims, method=waitlist).
 */
interface GeoOption { slug: string; name: string }
interface Props {
  states: { slug: string; name: string; counties: GeoOption[] }[];
  categories: GeoOption[];
}

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none';

export default function FeaturedRequestForm({ states, categories }: Props) {
  const [stateSlug, setStateSlug] = useState(states[0]?.slug ?? '');
  const [countySlug, setCountySlug] = useState(states[0]?.counties[0]?.slug ?? '');
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? '');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<'form' | 'checking' | 'open' | 'waitlist' | 'done' | 'error'>('form');
  const [slots, setSlots] = useState<{ taken: number; cap: number } | null>(null);

  const counties = states.find((s) => s.slug === stateSlug)?.counties ?? [];

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setPhase('checking');
    try {
      const res = await fetch(
        `/api/featured-slots?state=${stateSlug}&county=${countySlug}&category=${categorySlug}`,
      );
      const out = await res.json();
      if (!out.ok) throw new Error(out.error);
      setSlots({ taken: out.taken, cap: out.cap });
      setPhase(out.open > 0 ? 'open' : 'waitlist');
    } catch {
      setPhase('error');
    }
  }

  async function submit(kind: 'featured-request' | 'waitlist') {
    try {
      await BaseCrudService.create('claims', {
        _id: crypto.randomUUID(),
        businessName,
        claimantEmail: email,
        method: kind === 'waitlist' ? 'waitlist' : 'featured-request',
        source: 'pricing',
        status: 'new',
        town: countySlug,
        category: categorySlug,
        createdAt: new Date(),
      });
      setPhase('done');
    } catch {
      setPhase('error');
    }
  }

  const countyName = counties.find((c) => c.slug === countySlug)?.name ?? countySlug;
  const categoryName = categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug;

  if (phase === 'done') {
    return (
      <div className="rounded-card border border-line bg-ok-wash p-5" role="status">
        <h3 className="font-display text-lg font-semibold text-ok">Request received</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We'll email you at {email} with next steps
          {slots && slots.taken >= slots.cap ? ' as soon as a slot opens' : ' and the checkout link'}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-ink">Request a Featured slot</h3>
      <p className="text-xs text-faint">
        Max 3 Featured businesses per category per county — checked live before you commit.
      </p>
      <form onSubmit={check} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="fr-state" className="mb-1 block text-sm font-medium text-ink">State</label>
            <select id="fr-state" value={stateSlug} className={inputClass}
              onChange={(e) => { setStateSlug(e.target.value); setCountySlug(states.find((s) => s.slug === e.target.value)?.counties[0]?.slug ?? ''); }}>
              {states.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fr-county" className="mb-1 block text-sm font-medium text-ink">County</label>
            <select id="fr-county" value={countySlug} onChange={(e) => setCountySlug(e.target.value)} className={inputClass}>
              {counties.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fr-category" className="mb-1 block text-sm font-medium text-ink">Category</label>
            <select id="fr-category" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className={inputClass}>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="fr-name" className="mb-1 block text-sm font-medium text-ink">Business name</label>
            <input id="fr-name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="fr-email" className="mb-1 block text-sm font-medium text-ink">Email</label>
            <input id="fr-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
        </div>
        {phase === 'form' || phase === 'checking' ? (
          <button type="submit" disabled={phase === 'checking'} className="rounded-chip bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60">
            {phase === 'checking' ? 'Checking slots…' : 'Check availability'}
          </button>
        ) : null}
      </form>

      {phase === 'open' && slots && (
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">{slots.cap - slots.taken} of {slots.cap} Featured slots open</span> in {countyName} for {categoryName}.
          </p>
          <button onClick={() => submit('featured-request')} className="mt-3 rounded-chip bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
            Reserve it — we'll send the checkout link
          </button>
        </div>
      )}
      {phase === 'waitlist' && (
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-ink">
            <span className="font-semibold">Featured slots are full in {countyName} for {categoryName}.</span>{' '}
            Join the waitlist and we'll email you when one opens.
          </p>
          <button onClick={() => submit('waitlist')} className="mt-3 rounded-chip border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-inset">
            Join the waitlist
          </button>
        </div>
      )}
      {phase === 'error' && (
        <p className="rounded-[10px] bg-danger-wash px-3 py-2 text-xs text-danger" role="alert">
          Something went wrong — try again.
        </p>
      )}
    </div>
  );
}
