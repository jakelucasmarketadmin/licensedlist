# Domain, analytics, Search Console — cutover checklist

## 0. When the custom domain is chosen

Tell Claude the domain. Code-side it is one change: set `PUBLIC_SITE_URL=https://www.yourdomain.com`
(exact host that will return 200 — www vs apex must match the Wix primary domain) in the Wix
environment (Vibe → Code → environment variables, or `wix env`), or hardcode the fallback in
`src/lib/site.ts`. That single value drives every canonical, og:url, JSON-LD id, and the
sitemap. Then publish and spot-check:

```bash
curl -s https://www.yourdomain.com/ | grep -o '<link rel="canonical"[^>]*>'
curl -s https://www.yourdomain.com/sitemap | head -5
```

Rules learned the hard way on this fleet: the canonical host must be **whichever host
returns 200** (if Wix 301s apex→www, canonicals must say www), and if the primary domain
ever flips, `PUBLIC_SITE_URL` moves with it.

## 1. Connect the domain in Wix

Dashboard (manage.wix.com/dashboard/04efedc9-0e97-410c-98a1-d253a2a55945) → Settings →
Domains → Connect. Prefer Wix nameservers (they manage DNS + certs). Decide www vs apex as
the primary; let Wix 301 the other.

## 2. Analytics (GA4)

1. Create the GA4 property at analytics.google.com (Admin → Create property → Web stream for
   the domain). Copy the `G-XXXXXXXXXX` id.
2. Set `PUBLIC_GA4_ID=G-XXXXXXXXXX` in the site environment and publish. The tag only loads
   when this env is set; no other third-party scripts ship. The footer "Privacy choices"
   link → `/privacy#analytics` documents opt-out (no consent banner is currently promised
   anywhere on the site, so no gating is required; if a banner is ever added, gate the tag
   behind it — see the ETA Bootcamp incident notes).
3. Verify: load the site with DevTools → Network → filter `collect` → one `page_view`.

## 3. Google Search Console

1. search.google.com/search-console → Add property → **Domain** property (covers www+apex,
   http+https). Requires a DNS TXT record: with Wix nameservers, add it in Wix Dashboard →
   Domains → DNS records → TXT. **Add alongside any existing TXT records, never replace.**
2. Wait for verification (minutes to a few hours after DNS).
3. Sitemaps → submit `sitemap` (the property + `/sitemap`). Expect "Success" with ~180+ URLs
   discovered (grows automatically as businesses publish).
4. URL Inspection on `/`, `/nj`, and one town hub → "Request indexing" to prime the crawl.

## 4. Bing Webmaster Tools

1. bing.com/webmasters → Add site. Easiest: **Import from Google Search Console** (one
   click, reuses the verified property). Otherwise DNS CNAME/TXT verification, same DNS
   panel as above.
2. Sitemaps → submit `https://www.yourdomain.com/sitemap`.

## 5. robots.txt

Already served with a Sitemap line via the dashboard Robots.txt Editor (SEO & GEO →
Robots.txt Editor). After the domain cutover, update the line to
`Sitemap: https://www.yourdomain.com/sitemap` (the editor stores an absolute URL).

## 6. /sitemap.xml on the custom domain — investigation note

On the current `*.wix-vibe-site.com` domain, the platform hard-404s any `*.xml` route (the
repo serves the same XML at both `/sitemap.xml` and `/sitemap`; only `/sitemap` resolves —
same behavior seen on other sites in this fleet on custom domains, e.g. etabootcamp.com).
After cutover, test once:

```bash
curl -s -o /dev/null -w "%{http_code}" https://www.yourdomain.com/sitemap.xml
```

If it 200s, point robots.txt at `/sitemap.xml` (the standard path); if it 404s (expected),
keep `/sitemap` — Google and Bing both accept any sitemap URL listed in robots.txt or
submitted directly, so nothing is lost either way.
