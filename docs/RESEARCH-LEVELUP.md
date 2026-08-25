# Research: what "best in the game" looks like for a local directory (Aug 2026)

Commit this as `docs/RESEARCH-LEVELUP.md`. Four research passes: element-level teardowns of national directories, NJ/NY/PA county and "best of" sites, a 2026 feature inventory, and design/tech direction. Every claim below came with a source URL; the key ones are listed at the end of each section.

## 1. What the best directories put on the page

**Home pages.** Photographic or video hero with a two-field search as the primary CTA (Yelp, Angi, Zocdoc, Tripadvisor, OpenTable), a category tile grid with icons or photos (Angi, Bark, Houzz, Expertise), a trust/stat bar ("1-3 days avg wait", "185 reviewed → 114 curated → 8 picks"), then carousels: top-rated near you, editorial collections (OpenTable "Icons", Resy "Climbing"/"New"), cost guides (Angi), and a business CTA. Zocdoc offers two search modes side by side: "AI Care Assistant" vs "Classic search".

**List pages.** H1 with count and freshness ("THE 10 BEST Roofers … (Updated August 2026)"), a left filter rail (job type, materials, price, Verified License, Responds Quickly, Open now, ownership attributes), sponsored block labeled at top, then cards. Yelp's roofers page for Westwood NJ: every card has a photo carousel, a 4-photo portfolio strip, "Yelp Guaranteed" / "Verified License" shields, "60 years in business", "Free estimates", "Excellent responses", and a "Get pricing & availability" button; the right rail is a sticky "Free quotes from local professionals" form. Split list + map with hover-synced pins is standard (Yelp, Tripadvisor, OpenTable, Airbnb, Zillow). Bottom: FAQ accordion, cost guide, nearby cities, related categories.

**Result card anatomy (union of Yelp, Thumbtack, Houzz, Angi, Zocdoc).** Photo (1:1 or 4:3, carousel), rank number, name, rating + count with a descriptor word ("Exceptional 5.0"), category chips, neighborhood/service area, badges (Verified License, Top Pro, Best of Houzz, Approved, Background checked), years in business, "Responds in about 2 hrs", "X hires / X requested a quote recently", starting price or price range, review snippet with the query term bolded, checkmarks showing which parts of the query match, one CTA (Request quote / Book / Check availability).

**Profile pages (Airbnb/OpenTable/Houzz/Zocdoc anatomy).** Photo mosaic (1 large + 4 small, "Show all N photos" lightbox), header with badges and proof-copy ("Highly recommended — 97% gave 5 stars"), a **sticky right action card** (quote/book/call, response time, "X people requested a quote"), a tab bar (Overview / Services / Photos & Projects / Reviews / Q&A / Location), highlights icon row, services with prices or "Typical job cost" range (Houzz), projects/portfolio with before/after pairs (Yelp auto-groups them), verification/credentials with dates, reviews with **sub-rating bars** (Airbnb: 6; OpenTable: Food/Service/Ambience/Value + noise; Zocdoc: bedside manner/wait time), rating histogram, keyword filter chips, photo reviews, owner responses, "verified hire/diner/patient" stamps, AI summary with drill-down to source reviews (Tripadvisor, Google, Yelp Review Insights with 1–100 aspect scores), Q&A, hours with open-now, mini-map, team/owner card, FAQ, "people also viewed", explicit empty states ("No cost information found yet", Avvo).

**Distinctive ideas worth stealing.** Yelp checkmark match annotations and Popular Offerings; Expertise's curation funnel stat + third-party rating sources row + comparison table; Zocdoc badges with built-in proof copy; Houzz "Typical job cost" and Verified Hires; Angi's response metrics on cards; OpenTable "Booked X times today" and Top booked/viewed/saved tabs; Resy's persistent bottom bar; The Infatuation's "Perfect for" tags; Nextdoor's text recommendations + Fave counts + annual trophy badge; Airbnb's Guest Favorite pill and host card with tenure; Tripadvisor's "#1 of N in {town}"; Google's local-pack justifications ("Provides: ✓ drain cleaning") and Popular Times; Apple Guides' publisher-credited collections.

Sources: yelp.com search (Westwood roofers, screenshot in review), blog.yelp.com fall 2025 / spring 2026 releases, houzz.com professionals pages, angi.com companylist, zocdoc.com dentists Jersey City, expertise.com/nj/newark/plumbing, airbnb.com rooms, opentable.com neighborhood pages, tripadvisor.com restaurants, avvo.com lawyer lists, clutch.co agency lists, maxibestof.one/websites/directory, littleplaces.london, onthegrid.city, theinfatuation.com.

## 2. What the strong NJ/NY/PA local sites have that we don't

The county tourism sites (Visit Bucks County, Valley Forge Tourism, Westchester County Tourism, Discover Long Island, Visit Philly, Pocono Mountains, Destination Dutchess, Discover Lehigh Valley, Morris County Tourism) and the magazine "Best of" programs (Westchester Magazine, Main Line Today, Hudson Valley Magazine, Philadelphia Magazine, Bergen Magazine, NJ Monthly, Chronogram) share fifteen things a bare listings directory lacks:

1. Full-width, seasonal hero photography and photo-tile category navigation.
2. Editorial "best of" lists with photos ("13 Seafood Restaurants", "25 Free Things to Do").
3. An annual awards program: reader nominations → voting → winners by category with badge graphics, a winners party with paid vendor tables and ticket sales, and paid "partner" posts by winners. Best of Westchester 2026 had 200+ winners and sponsors including Tesla and Douglas Elliman.
4. Events calendars with business self-submission, and paid event promotion (Patch: $2/day/community).
5. Deals, coupons, passports and trails (Montco History/Arts/Makers passes, Poconos Experience Passports, Local Girl deals grid).
6. Itineraries and themed trails.
7. Town and neighborhood guide pages with photos (Valley Forge has 24, Westchester 25+).
8. Seasonal "this weekend / this month" hubs.
9. Video, webcams, podcasts, and Instagram UGC walls.
10. Newsletter capture as a primary CTA.
11. Adjacent verticals: real estate, jobs, Top Doctors/Dentists/Lawyers lists, weddings.
12. Clearly productized sponsored placement (Patch $79/mo featured badge + carousel + newsletter slot; Valley Forge sells website/email/guide/billboard ads; Simpleview DTN sells revenue-share sponsored listings for most DMOs).
13. Downloadable guides.
14. Accessibility guides.
15. America 250 / FIFA 2026 tie-ins.

Their shared weaknesses, which are our openings: almost none have an interactive filterable map, user reviews, hours/price filters, or owner self-service; navigation is over-deep (Poconos has ~150 links); Today Media sites (Westchester, Main Line, Hudson Valley) return 403 to crawlers, TAPinto and Patch listings render nothing without JS; deals lack expiry; sponsored vs editorial is blurred; Bergen County's official tourism page is a text stub that sends people to Yelp.

Sources: visitbuckscounty.com, valleyforge.org, visitwestchesterny.com, discoverlongisland.com, visitphilly.com, poconomountains.com, destinationdutchess.com, discoverlehighvalley.com, morristourism.org, bergencountynj.gov/tourism, westchestermagazine.com/best-of-westchester, mainlinetoday.com/best-of-the-main-line, phillymag.com/best-of-philly, healthandlifemags.com/bergen, njmonthly.com, chronogram.com awards, hobokengirl.com and thelocalgirl.com/deals, mybergen.com, patch.com/new-jersey/ridgewood/businesses and support.patch.com pricing, members.montcochamberpa.org/directory, simpleviewinc.com DTN.

## 3. Feature inventory: the 25 features that move engagement and sign-ups

Ranked from the 2026 inventory of Yelp, Thumbtack, Angi, Houzz, Nextdoor, Zocdoc, Expertise, Bark, Porch, Google Business Profile, Apple Business Connect, Tripadvisor, OpenTable, Booksy/Fresha/Vagaro, Alignable, Clutch/Sortlist, Brilliant Directories, eDirectory, GeoDirectory, Directorist:

1. Pre-seeded listings + free claim with verification (the sign-up funnel everywhere).
2. Structured attributes/service schema (hours incl. holiday, service areas, price ranges, accessibility, payment) feeding filters, open-now, and AI answers.
3. Map + proximity search with open-now and category filters.
4. Quote request fanning out to matched pros, with a lead inbox on the other side.
5. Verified, transaction-backed reviews with automated post-job collection.
6. Owner responses + response-time/quality badges.
7. Guided natural-language/multimodal intake ("describe your problem"); Angi reports ~3× quote rate for AI-intake users, Thumbtack says 87% valued photo/voice input.
8. AI review summaries with drill-down to the supporting reviews.
9. Messaging with unified inbox, templates, SMS alerts.
10. Booking via partner deep links rather than a built scheduler.
11. Owner analytics with competitor benchmarks (Yelp: "vs 3 competitors").
12. Posts/updates and offers with expiry (weekly reason to log in).
13. Photos/portfolio with auto before/after grouping; photos lift GBP direction requests ~42%.
14. Credential badges (license, insurance, background check) tied to registry lookups.
15. Featured/boost placement, pay-for-performance or subscription.
16. Popular services auto-extracted from reviews.
17. Cost guides and "best of" city pages as SEO engines.
18. Data-driven annual awards (Best of Houzz ~3% win rate; winners market the badge for free).
19. Saves/collections and project boards with AI summaries.
20. Conversational assistant grounded in your own data (Yelp Assistant, OpenTable Concierge).
21. Exposure to external AI surfaces (schema, an llm-info page, MCP/app presence; Angi is in ChatGPT and Gemini, Zocdoc publishes an AI/LLM info page).
22. Lead targeting and budget controls for pros.
23. AI reply drafting and description generation for owners.
24. Neighborhood-level pages, feeds, and radius-targeted deals.
25. AI phone receptionist as a high-ARPU add-on (Yelp $99–149/mo; Zocdoc pay-per-booking), partner rather than build.

Sources: blog.yelp.com releases and yelp-ir.com press, businesswire Thumbtack Apr 2026, ir.angi.com and globenewswire Angi in ChatGPT/Gemini, houzz.com magazine (Best of Houzz), business.nextdoor.com, zocdoc.com/business and Zo press, expertise.com/about/our-selection-process, bark.com how-it-works, elfsight.com and digitalapplied.com GBP feature guides, apple.com newsroom Business Connect, hospitalitynet Tripadvisor summaries, opentable.com Concierge press, biz.booksy.com marketplace, fresha.com 2026 roadmap, support.vagaro.com, brilliantdirectories.com, edirectory.com, wordpress.org GeoDirectory, directorist.com, clutch.co/methodology, sortlist.com.

## 4. Design and tech direction (Astro + React on Wix Headless)

**Look.** Photographic heroes with search as the primary CTA; bento grids for the explore section; editorial serif display type over a warm grotesk body; restrained glass only on the search bar and sticky bars (backdrop-filter costs 15–30% FPS on real devices); dark-mode as a tokenized first-class theme; scroll-driven reveals in CSS, not JS. What reads as dated in 2026: WebGL heroes, blobs, kinetic body type, parallax, Poppins/Montserrat geometrics, Inter as the only voice.

**Type.** Display: Fraunces (variable, SOFT/WONK) or Instrument Serif; body: Hanken Grotesk / General Sans / Manrope; meta: Geist Mono / JetBrains Mono. Two trend faces max. Gallery-featured directories use pairs like Berlingske Serif + PP Neue Montreal, Albra Grotesk, ABC Oracle + Plantin.

**Icons.** Lucide for UI; Phosphor duotone (7,700 icons, six weights) for category tiles; 3D Icons (CC0) or a commissioned Rive/Lottie set if we want Airbnb "Lava"-style animated tiles later (~$25/icon on Upwork).

**Photos when businesses have none.** Fallback ladder: business photo → curated town/landmark photo from Wikimedia Commons (CC BY / CC BY-SA / PD; credit author, license, source; a credits page satisfies attribution) → illustrated category tile on a tinted gradient → static styled map thumbnail (Google Static Maps 10k free/mo then $2/1k; Mapbox 50k free/mo but 30-day cache cap). Skip Street View on cards ($14/1k, no caching allowed). State tourism media libraries are editorial-use only; ask the DMO for written permission. Unsplash/Pexels are fine commercially but carry model/property-release risk and Unsplash API requires hotlinking and credit. If AI illustration is used, keep it clearly illustrative and disclose in the credits (EU AI Act Art. 50 is in force Aug 2026; harmless to comply globally).

**Maps.** MapLibre GL JS + OpenFreeMap: free, unlimited, no key, MIT, six styles (Positron/Bright/Liberty/Dark), native clustering, attribution required; upgrade path is Protomaps PMTiles on Cloudflare R2 for a regional extract. Mapbox: 50k loads/mo free then ~$5/1k. Google Maps JS: 10k loads/mo free then $7/1k and data must display on a Google map. CSP needs `worker-src blob:`, `img-src data: blob:`, `connect-src` to the tile host. Load maps as `client:visible` islands; use a static AVIF map image on the home page.

**Motion.** CSS for hover/enter/exit; Astro `<ClientRouter />` view transitions with `transition:name` for card-image → hero morphs and `transition:persist` on the map; Motion/Framer only for gestures. 200–400ms transforms/opacity; honor `prefers-reduced-motion`.

**Images on Wix.** Use Wix Media URL transforms (`/v1/fill/w_{w},h_{h}/`) for srcset and a tiny blurred variant as LQIP; do not hand-build static.wixstatic.com URLs from IDs (403s); add the host to Astro `image.domains`; always set width/height or aspect-ratio (CLS); `fetchpriority="high"` on the LCP image; AVIF/WebP via autoEncode.

Sources: openfreemap.org, github.com/hyperknot/openfreemap, stadiamaps.com/pricing, developers.google.com/maps (March 2025 pricing, Static Maps map IDs, Street View policies), mapbox.com static maps and CSP guide, thomasgauvin.com Protomaps+Cloudflare, commons.wikimedia.org reuse and credit-line pages, unsplash.com/license and API guidelines, artificialintelligenceact.eu Article 50, typewolf.com, madegooddesigns.com font trends 2026, studiomeyer.io 2026 trends reality check, line25.com 2026 trends, pkgpulse.com icon and map comparisons, muz.li illustration libraries, docs.astro.build images and view transitions, evanw.github.io/thumbhash, leanrada.com CSS-only LQIP, dev.wix.com SDK media and URL transforms.
