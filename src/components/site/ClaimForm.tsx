import { useState } from 'react';
import { BaseCrudService } from '@/integrations';

interface Props {
  businessSlug: string;
  businessName: string;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none';

export default function ClaimForm({ businessSlug, businessName }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [claimId, setClaimId] = useState<string | null>(null);
  const [form, setForm] = useState({
    claimantName: '',
    claimantEmail: '',
    claimantPhone: '',
    method: 'phone',
    company: '', // honeypot
  });

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.company) return;
    setStatus('submitting');
    try {
      const claimId = crypto.randomUUID();
      await BaseCrudService.create('claims', {
        _id: claimId,
        businessSlug,
        businessName,
        claimantName: form.claimantName,
        claimantEmail: form.claimantEmail,
        claimantPhone: form.claimantPhone,
        method: form.method,
        source: 'claim',
        status: 'new',
        createdAt: new Date(),
      });
      fetch('/api/webhook-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'claim',
          itemId: claimId,
          payload: {
            businessSlug,
            businessName,
            claimantName: form.claimantName,
            claimantEmail: form.claimantEmail,
            claimantPhone: form.claimantPhone,
            method: form.method,
            consentAt: new Date().toISOString(),
          },
        }),
      }).catch(() => {});
      setClaimId(claimId);
      setStatus('success');
    } catch (err) {
      console.error('claim failed', err);
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-card border border-line bg-ok-wash p-5" role="status">
        <h3 className="font-display text-lg font-semibold text-ok">Claim received</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We'll verify ownership using your chosen method and email you next steps — usually
          within one business day.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">One more step:</span> create your free owner
          login now so your approved claim connects to your account.
        </p>
        <a
          href={`/owner${claimId ? `?claim=${claimId}` : ''}`}
          className="mt-3 inline-block rounded-chip bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
        >
          Create your owner login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cl-name" className="mb-1 block text-sm font-medium text-ink">Your name</label>
          <input id="cl-name" required value={form.claimantName} onChange={set('claimantName')} className={inputClass} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="cl-phone" className="mb-1 block text-sm font-medium text-ink">Phone</label>
          <input id="cl-phone" type="tel" required value={form.claimantPhone} onChange={set('claimantPhone')} className={inputClass} autoComplete="tel" />
        </div>
      </div>
      <div>
        <label htmlFor="cl-email" className="mb-1 block text-sm font-medium text-ink">Email</label>
        <input id="cl-email" type="email" required value={form.claimantEmail} onChange={set('claimantEmail')} className={inputClass} autoComplete="email" />
      </div>
      <div>
        <label htmlFor="cl-method" className="mb-1 block text-sm font-medium text-ink">
          How should we verify you?
        </label>
        <select id="cl-method" value={form.method} onChange={set('method')} className={inputClass}>
          <option value="phone">Call the business number on file</option>
          <option value="email">Email the business domain</option>
          <option value="document">Business document (license, utility bill)</option>
        </select>
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="cl-company">Company</label>
        <input id="cl-company" tabIndex={-1} autoComplete="off" value={form.company} onChange={set('company')} />
      </div>

      {status === 'error' && (
        <p className="rounded-[10px] bg-danger-wash px-3 py-2 text-xs text-danger" role="alert">
          Something went wrong. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded-chip bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending…' : 'Submit claim'}
      </button>
    </form>
  );
}
