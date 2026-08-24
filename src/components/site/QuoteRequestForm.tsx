import { useState } from 'react';
import { BaseCrudService } from '@/integrations';

/**
 * Two-step quote request. Writes to the `leads` collection with the exact
 * consent language shown to the user plus a timestamp (FTC/TCPA posture:
 * explicit, named disclosure that up to 3 providers may call/text).
 * Optional GHL forward via PUBLIC_GHL_LEAD_WEBHOOK.
 */
interface Props {
  businessSlug?: string;
  businessName?: string;
  categorySlug?: string;
  townSlug?: string;
  responseTimeHours?: number;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none';

export default function QuoteRequestForm({
  businessSlug,
  businessName,
  categorySlug,
  townSlug,
  responseTimeHours,
}: Props) {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<Status>('idle');
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({
    message: '',
    urgency: 'flexible',
    name: '',
    phone: '',
    email: '',
    company: '', // honeypot
  });

  const consentText = businessName
    ? `I agree that ${businessName} may contact me about this request by phone, text, or email at the number and address I provided. Consent is not a condition of purchase.`
    : `I agree that my request may be shared with up to 3 matching local providers, who may contact me about it by phone, text, or email at the number and address I provided. Consent is not a condition of purchase.`;

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.company || !consent) return;
    setStatus('submitting');
    try {
      await BaseCrudService.create('leads', {
        _id: crypto.randomUUID(),
        businessSlugs: businessSlug ?? '',
        categorySlug: categorySlug ?? '',
        townSlug: townSlug ?? '',
        name: form.name,
        phone: form.phone,
        email: form.email,
        message: form.message,
        urgency: form.urgency,
        consentText,
        consentAt: new Date(),
        consentUserAgent: navigator.userAgent,
        source: businessSlug ? 'business-profile' : 'list-page',
        status: 'new',
        ghlSynced: false,
      });
      const webhook = import.meta.env.PUBLIC_GHL_LEAD_WEBHOOK;
      if (webhook) {
        fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'lead', businessSlug, ...form, company: undefined }),
        }).catch(() => {});
      }
      setStatus('success');
    } catch (err) {
      console.error('quote request failed', err);
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-card border border-line bg-ok-wash p-5" role="status">
        <h3 className="font-display text-lg font-semibold text-ok">Request sent</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {businessName
            ? `${businessName} will get your request right away.`
            : 'Your request is on its way to matching providers.'}{' '}
          Replies usually come by phone or text.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-ink">
        {businessName ? `Get a quote from ${businessName}` : 'Get quotes'}
      </h3>
      {responseTimeHours != null && (
        <p className="text-xs text-muted">
          Typically responds in about {responseTimeHours}{' '}
          {responseTimeHours === 1 ? 'hour' : 'hours'}
        </p>
      )}

      {step === 1 ? (
        <>
          <label htmlFor="qr-message" className="block text-sm font-medium text-ink">
            What do you need done?
          </label>
          <textarea
            id="qr-message"
            required
            rows={3}
            value={form.message}
            onChange={set('message')}
            className={inputClass}
            placeholder="Describe the project…"
          />
          <label htmlFor="qr-urgency" className="block text-sm font-medium text-ink">
            Timing
          </label>
          <select id="qr-urgency" value={form.urgency} onChange={set('urgency')} className={inputClass}>
            <option value="emergency">Emergency — as soon as possible</option>
            <option value="this-week">This week</option>
            <option value="this-month">This month</option>
            <option value="flexible">Flexible / planning ahead</option>
          </select>
          <button
            type="button"
            disabled={!form.message.trim()}
            onClick={() => setStep(2)}
            className="w-full rounded-chip bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            Next: contact info
          </button>
        </>
      ) : (
        <>
          <label htmlFor="qr-name" className="block text-sm font-medium text-ink">
            Your name
          </label>
          <input id="qr-name" required value={form.name} onChange={set('name')} className={inputClass} autoComplete="name" />
          <label htmlFor="qr-phone" className="block text-sm font-medium text-ink">
            Phone
          </label>
          <input id="qr-phone" type="tel" required value={form.phone} onChange={set('phone')} className={inputClass} autoComplete="tel" />
          <label htmlFor="qr-email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input id="qr-email" type="email" required value={form.email} onChange={set('email')} className={inputClass} autoComplete="email" />

          <div className="hidden" aria-hidden="true">
            <label htmlFor="qr-company">Company</label>
            <input id="qr-company" tabIndex={-1} autoComplete="off" value={form.company} onChange={set('company')} />
          </div>

          <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
              required
            />
            <span>{consentText}</span>
          </label>

          {status === 'error' && (
            <p className="rounded-[10px] bg-danger-wash px-3 py-2 text-xs text-danger" role="alert">
              Something went wrong. Please try again.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-chip border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-inset"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={status === 'submitting' || !consent}
              className="flex-1 rounded-chip bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {status === 'submitting' ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </>
      )}
      <p className="text-[11px] leading-relaxed text-faint">
        We store your consent with a timestamp. Details in our{' '}
        <a href="/privacy" className="underline">privacy policy</a>.
      </p>
    </form>
  );
}
