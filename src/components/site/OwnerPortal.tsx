import { useEffect, useState } from 'react';
import { MemberProvider, useMember } from '@/integrations';
import OwnerInbox from '@/components/site/OwnerInbox';
import OwnerStats from '@/components/site/OwnerStats';

/**
 * Owner dashboard island. Sign in with Wix Members; the server resolves the
 * member's approved claim and returns only owner-editable fields
 * (description, hours, photos, services, phone, website — never license
 * fields, ratings, or tier).
 */
interface Listing {
  slug: string;
  name: string;
  status: string;
  tier: string;
  licenseStatus: string;
  description: string;
  hoursJson: string;
  photosJson: string;
  services: string;
  phone: string;
  website: string;
  city?: string;
  state?: string;
}

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none';

function completeness(l: Listing): { pct: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ['Description', l.description.trim().length >= 80],
    ['Hours', Boolean(l.hoursJson)],
    ['Photos', Boolean(l.photosJson && l.photosJson !== '[]')],
    ['Services', l.services.trim().length > 0],
    ['Phone', l.phone.trim().length > 0],
    ['Website', l.website.trim().length > 0],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}

function Portal() {
  const { isAuthenticated, isLoading, actions } = useMember() as any;
  const [listing, setListing] = useState<Listing | null | 'loading'>('loading');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pending, setPending] = useState<string[]>([]);
  const [linkNote, setLinkNote] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    // Link a just-submitted claim to this account if we arrived with ?claim=
    const claimId = new URLSearchParams(window.location.search).get('claim');
    const link = claimId
      ? fetch('/api/claim-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimId }),
        })
          .then((r) => r.json())
          .then((r) => {
            if (r.ok) setLinkNote('Your claim is linked to this account — we’ll email you once it’s approved.');
          })
          .catch(() => {})
      : Promise.resolve();
    link.then(() =>
      fetch('/api/owner-listing')
        .then((r) => r.json())
        .then((r) => setListing(r.ok ? r.listing : null))
        .catch(() => setListing(null)),
    );
  }, [isAuthenticated]);

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  if (!isAuthenticated) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 text-center">
        <h2 className="font-display text-xl font-semibold text-ink">Owner sign-in</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Sign in (or create a free owner account) to manage your listing. Your account
          unlocks after we approve your claim.
        </p>
        <button
          onClick={actions.login}
          className="mt-4 rounded-chip bg-accent px-6 py-3 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
        >
          Sign in / create account
        </button>
      </div>
    );
  }

  if (listing === 'loading') return <p className="text-sm text-muted">Loading your listing…</p>;

  if (listing === null) {
    return (
      <div className="rounded-card border border-line bg-surface p-6">
        {linkNote && <p className="mb-3 rounded-[10px] bg-ok-wash px-3 py-2 text-sm text-ok">{linkNote}</p>}
        <h2 className="font-display text-xl font-semibold text-ink">No approved listing yet</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Once we verify your claim (usually within one business day), your listing appears
          here. Haven't claimed yet?
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/claim" className="rounded-chip bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
            Claim your listing
          </a>
          <button onClick={actions.logout} className="rounded-chip border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-inset">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const meter = completeness(listing);
  const set = (key: keyof Listing) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setListing({ ...listing, [key]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (listing === 'loading' || listing === null) return;
    setSaved('saving');
    try {
      const res = await fetch('/api/owner-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: listing.description,
          hoursJson: listing.hoursJson,
          photosJson: listing.photosJson,
          services: listing.services,
          phone: listing.phone,
          website: listing.website,
        }),
      });
      const out = await res.json();
      setPending(out.ok && Array.isArray(out.pending) ? out.pending : []);
      setSaved(out.ok ? 'saved' : 'error');
    } catch {
      setSaved('error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{listing.name}</h2>
            <p className="text-sm text-muted">
              {listing.city}, {listing.state} · status: {listing.status} · plan: {listing.tier}
            </p>
          </div>
          <a href={`/business/${listing.slug}`} className="rounded-chip border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-inset">
            View public listing
          </a>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">Profile completeness</span>
            <span className="text-muted">{meter.pct}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-chip bg-inset">
            <div className="h-full rounded-chip bg-brand" style={{ width: `${meter.pct}%` }} />
          </div>
          {meter.missing.length > 0 && (
            <p className="mt-2 text-xs text-faint">Add: {meter.missing.join(', ')}</p>
          )}
        </div>
        {listing.licenseStatus !== 'verified' && (
          <div className="mt-4 rounded-[10px] bg-brand-wash px-4 py-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">Get verified.</span> The green badge — with the
              registry receipt — is the strongest trust signal on your listing.
            </p>
            <a href="/pricing" className="mt-2 inline-block rounded-chip bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
              See verification plans
            </a>
          </div>
        )}
      </div>

      <form onSubmit={save} className="space-y-4 rounded-card border border-line bg-surface p-5">
        <h3 className="font-display text-lg font-semibold text-ink">Edit your listing</h3>
        <p className="text-xs text-faint">
          You can edit these fields. License records, ratings, and plan are managed by
          {' '}the directory and can't be changed here.
        </p>
        <div>
          <label htmlFor="ol-desc" className="mb-1 block text-sm font-medium text-ink">Description</label>
          <textarea id="ol-desc" rows={5} value={listing.description} onChange={set('description')} className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ol-phone" className="mb-1 block text-sm font-medium text-ink">Phone</label>
            <input id="ol-phone" type="tel" value={listing.phone} onChange={set('phone')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="ol-web" className="mb-1 block text-sm font-medium text-ink">Website</label>
            <input id="ol-web" type="url" value={listing.website} onChange={set('website')} className={inputClass} />
          </div>
        </div>
        <div>
          <label htmlFor="ol-services" className="mb-1 block text-sm font-medium text-ink">
            Services <span className="font-normal text-faint">(comma-separated)</span>
          </label>
          <input id="ol-services" value={listing.services} onChange={set('services')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ol-hours" className="mb-1 block text-sm font-medium text-ink">
            Hours <span className="font-normal text-faint">(JSON, e.g. {'{"mon":"8:00-17:00"}'})</span>
          </label>
          <input id="ol-hours" value={listing.hoursJson} onChange={set('hoursJson')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ol-photos" className="mb-1 block text-sm font-medium text-ink">
            Photo URLs <span className="font-normal text-faint">(JSON array)</span>
          </label>
          <input id="ol-photos" value={listing.photosJson} onChange={set('photosJson')} className={inputClass} />
        </div>
        {saved === 'error' && (
          <p className="rounded-[10px] bg-danger-wash px-3 py-2 text-xs text-danger" role="alert">
            Save failed — check the JSON fields and try again.
          </p>
        )}
        {saved === 'saved' && (
          <p className="rounded-[10px] bg-ok-wash px-3 py-2 text-xs text-ok" role="status">
            Saved. Changes appear on your public listing within a minute.
            {pending.length > 0 && ` Your new ${pending.join(' and ')} will show once our team approves it, usually within a day.`}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saved === 'saving'} className="rounded-chip bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60">
            {saved === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={actions.logout} className="text-sm font-medium text-muted hover:text-ink">
            Sign out
          </button>
        </div>
      </form>

      <OwnerStats tier={listing.tier} />

      <OwnerInbox />
    </div>
  );
}

export default function OwnerPortal() {
  return (
    <MemberProvider>
      <Portal />
    </MemberProvider>
  );
}
