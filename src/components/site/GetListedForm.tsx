import { useState } from 'react';
import { BaseCrudService } from '@/integrations';
import { BUSINESS_CONTACT_EMAIL, STARTER_CATEGORIES } from '@/lib/site';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-faint focus:border-brand focus:outline-none';

export default function GetListedForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [form, setForm] = useState({
    claimantName: '',
    businessName: '',
    phone: '',
    email: '',
    town: '',
    category: '',
    website: '',
    licenseNumber: '',
    // Honeypot — real users never fill this.
    company: '',
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.company) return; // bot
    setStatus('submitting');
    try {
      await BaseCrudService.create('claims', {
        _id: crypto.randomUUID(),
        claimantName: form.claimantName,
        claimantEmail: form.email,
        claimantPhone: form.phone,
        businessName: form.businessName,
        town: form.town,
        category: form.category,
        website: form.website,
        licenseNumber: form.licenseNumber,
        method: 'form',
        source: 'get-listed',
        status: 'new',
        createdAt: new Date(),
      });
      // GHL webhook stub: fires only when the env is configured at build time.
      const webhook = import.meta.env.PUBLIC_GHL_CLAIM_WEBHOOK;
      if (webhook) {
        fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'claim', ...form, company: undefined }),
        }).catch(() => {
          /* webhook is best-effort; the CMS record is the source of truth */
        });
      }
      setStatus('success');
    } catch (err) {
      console.error('get-listed submit failed', err);
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-card border border-line bg-ok-wash p-6" role="status">
        <h2 className="font-display text-xl font-semibold text-ok">Request received</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Thanks — we'll build your draft listing, run license verification, and email it to you
          for review. Nothing goes live until it passes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="gl-name" className="mb-1 block text-sm font-medium text-ink">
            Your name
          </label>
          <input id="gl-name" required value={form.claimantName} onChange={set('claimantName')} className={inputClass} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="gl-business" className="mb-1 block text-sm font-medium text-ink">
            Business name
          </label>
          <input id="gl-business" required value={form.businessName} onChange={set('businessName')} className={inputClass} autoComplete="organization" />
        </div>
        <div>
          <label htmlFor="gl-phone" className="mb-1 block text-sm font-medium text-ink">
            Phone
          </label>
          <input id="gl-phone" type="tel" required value={form.phone} onChange={set('phone')} className={inputClass} autoComplete="tel" />
        </div>
        <div>
          <label htmlFor="gl-email" className="mb-1 block text-sm font-medium text-ink">
            Email
          </label>
          <input id="gl-email" type="email" required value={form.email} onChange={set('email')} className={inputClass} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="gl-town" className="mb-1 block text-sm font-medium text-ink">
            Town &amp; state
          </label>
          <input id="gl-town" required placeholder="Hackensack, NJ" value={form.town} onChange={set('town')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="gl-category" className="mb-1 block text-sm font-medium text-ink">
            Category
          </label>
          <input id="gl-category" required list="gl-categories" placeholder="Roofers" value={form.category} onChange={set('category')} className={inputClass} />
          <datalist id="gl-categories">
            {STARTER_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="gl-website" className="mb-1 block text-sm font-medium text-ink">
            Website <span className="font-normal text-faint">(optional)</span>
          </label>
          <input id="gl-website" type="url" placeholder="https://" value={form.website} onChange={set('website')} className={inputClass} autoComplete="url" />
        </div>
        <div>
          <label htmlFor="gl-license" className="mb-1 block text-sm font-medium text-ink">
            License number <span className="font-normal text-faint">(if your trade has one)</span>
          </label>
          <input id="gl-license" value={form.licenseNumber} onChange={set('licenseNumber')} className={inputClass} />
        </div>
      </div>

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="gl-company">Company</label>
        <input id="gl-company" tabIndex={-1} autoComplete="off" value={form.company} onChange={set('company')} />
      </div>

      {status === 'error' && (
        <p className="rounded-[10px] bg-danger-wash px-4 py-3 text-sm text-danger" role="alert">
          Something went wrong sending your request. Try again, or email us at{' '}
          <a className="font-medium underline" href={`mailto:${BUSINESS_CONTACT_EMAIL}`}>
            {BUSINESS_CONTACT_EMAIL}
          </a>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded-chip bg-accent px-6 py-3 text-base font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending…' : 'Request my free listing'}
      </button>
      <p className="text-xs leading-relaxed text-faint">
        We use these details to build and verify your listing and to contact you about it —
        nothing else. See our <a href="/privacy" className="underline">privacy policy</a>.
      </p>
    </form>
  );
}
