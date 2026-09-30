# Loading improvements

Measured on 2026-09-29 before deploying these changes:

- The public HTML returned in 467 ms in one request.
- The first concurrent requests to the deployed products, categories and popular-products APIs took 9.3–9.7 seconds. Immediately repeated requests took 716–728 ms. This is consistent with startup overhead; these are individual observations, not benchmark averages.
- Server startup ran `initializeCategories()`, including sequential catalog reads and category/type writes, before accepting requests.

## Changes

- Category initialization is now an explicit maintenance operation, outside normal server startup. Existing category documents remain unchanged. For a new database containing a legacy product catalog, run `npm run init:categories` in `server` once before serving traffic. It uses that environment's configured database. This command was not run against production during optimization.
- Product list reads use plain objects via `lean()`. Concurrent frontend product fetches share one pending request; results are not persistently cached, so stock refreshes remain fresh.
- AI chat loads on first use and remains mounted afterward to retain the conversation. Home sliders and lower sections load near the viewport. The hero no longer waits for the slider bundle.
- Product thumbnails request suitably sized Cloudinary images, with automatic quality/format selection and fallback to the original if transformations are unavailable. Local and signed URLs are left unchanged.
- Fonts are discovered directly in HTML, with connection hints for font and image hosts.
- Homepage artwork uses WebP with the same pixel dimensions. Original PNG files are retained. Regenerate with `npm run optimize:images` in `client`.

| Asset | Original bytes | WebP bytes |
| --- | ---: | ---: |
| Hero background | 598,473 | 28,122 |
| Banner | 1,113,876 | 54,064 |
| Feature 1 | 364,795 | 13,794 |
| Feature 2 | 259,064 | 10,198 |
| Hero card | 15,131 | 4,024 |
| Total | 2,351,339 | 110,202 |

One live catalog image returned HTTP 200 at 68,944 bytes originally and 10,892 bytes with the 320px transformation (84% smaller). Savings vary by image.

The build now puts the AI panel (26.44 kB uncompressed) and slider library (81.99 kB uncompressed) in deferred chunks. File size is not a page-load-time measurement.

## Verification and rollout

Client build and targeted ESLint checks passed. All 139 server tests passed.

Both projects were deployed to production on 2026-09-30 from commit `dd2f42e`, with `.vercelignore` added to exclude local environment files and build/dependency directories:

- Frontend: `dpl_3imkhvFESv7tsbhmSx4rvGfhYrHC`, aliased to https://velours-jet.vercel.app
- Backend: `dpl_88QRkPf559eumKVvHz9MtSpVStMc`, aliased to https://vouges-backend.vercel.app

Both deployments reported READY. Production checks returned HTTP 200 for Home, Collection, products, categories, popular products and the optimized hero image. The HTML references the new `index-_IgwXXuU.js` bundle. The products endpoint returns 55 products, and the hero image is served as WebP at 28,122 bytes.

Observed request totals after deployment: the first product request took 1.72 seconds; the subsequent product request took 1.02 seconds, categories 0.94 seconds, popular products 2.51 seconds, and Home HTML 0.61 seconds. These are individual HTTP measurements, not browser page-load or LCP measurements, and the first request is not a controlled cold-start benchmark.

## Dashboard follow-up, 2026-09-30

- Dashboard now loads separately from Recharts: its route chunk is 12.72 kB uncompressed, previously 382.75 kB including the chart. The chart is still available, in a separate lazy-loaded chunk.
- The owner-only `/api/orders/dashboard` endpoint returns 10 orders per page, selected product/address fields and whole-history statistics. Revenue and six-month chart totals are computed before pagination, using the browser's timezone. Responses are private and not cached. The existing all-orders endpoint remains compatible with older clients.
- Added a creation-date index, explicit loading/retry states, stale-response protection when changing pages, and optimized order thumbnails.
- A read-only comparison against the configured database (11 eligible orders) returned identical order counts/revenue: the old response was 17,450 bytes versus 8,756 bytes for the new first page. The observed database-query times were 225 ms and 100 ms respectively. These are single query measurements, not authenticated browser load times.
- Build, targeted lint, and all 144 server tests passed. Tests cover pagination, full-history totals, missing months, invalid query parameters, owner authorization and private caching policy.
- Updated backend deployment: `dpl_91cym7xzonNDPGyip7DND7G8Ee92`. Updated frontend deployment: `dpl_BjsrsDPdQcnJQEbJsCFs9vSbMb5n`. Both are READY and aliased to the existing production domains. `/owner` and the new Dashboard asset return HTTP 200; anonymous access to the new statistics endpoint correctly returns HTTP 401. An authenticated browser timing was not measured.

## Cart follow-up, 2026-09-30

- Removed the full-cart lock during quantity edits. Quantities and totals update immediately, with a 180 ms coalescing window for rapid clicks and one in-flight write per line. Independent lines can save concurrently. Removing a line skips the debounce delay.
- Older responses do not overwrite newer input. A failed final write restores the last acknowledged quantity. Checkout and size changes wait for pending writes, and signing out cancels queued requests. Pending saves continue when navigating within the app.
- Bulk removal sends independent line deletions concurrently, instead of waiting for each removal to finish before starting the next.
- Cart API handlers reuse the authenticated user document instead of fetching it again. Product validation reads only size/stock fields. Authentication, stock validation, atomic updates and cart ordering remain in place.
- Checkout/address and QR components load when their step is needed. The Cart route chunk decreased from about 47.5 kB to 18.04 kB uncompressed in the local build.
- Build, targeted lint and all 152 tests passed, including rapid-click coalescing, stale responses, update/delete races, rollback, independent lines, cancellation and avoiding duplicate account reads. No authenticated production cart was changed for testing, and end-to-end authenticated mutation latency was not measured.
- Production backend: `dpl_GPJRDbjGP2bDNwFpj99v2HqMYxsX`. Production frontend: `dpl_BfdEbEkZfEJRssompHWRcvEnJvzU`. Both reported READY and were aliased to the existing domains. Anonymous cart updates correctly return HTTP 401.

## Cart and Dashboard follow-up review, 2026-09-30

- Removed both size-change success toasts in Cart. The size picker still explains quantity merging before confirmation, and failed changes still show their error.
- Opening `/owner` no longer starts the full catalog and category requests. They load when entering a screen that needs them, including Cart and List Product.
- Confirmed order-status changes stay visible while Dashboard statistics refresh in the background. The status control no longer waits for the popular-products request. Dashboard reads time out after 15 seconds and expose the existing retry action.
- CORS preflight permissions can be reused by the browser for 600 seconds, reducing repeated OPTIONS round trips for authenticated requests. This does not cache user data or bypass authentication.
- Build, targeted ESLint, and all 152 tests passed. Cart queue, size changes, stock validation, dashboard pagination and authorization were included. Authenticated browser load times have not been measured for this revision.
- Deployed backend `dpl_4LS1GNY9wjbtB2PzwhfyVLAa9BgH` and frontend `dpl_Fzc85jankhEDmv8ZV2nfzYzqdkyF`; both READY on their existing production domains. Production Cart HTML returned 200, unauthenticated Dashboard API returned 401, and cart preflight returned 204 with `Access-Control-Max-Age: 600`.

## Authentication and QR Back follow-up, 2026-09-30

- Profile loading starts from Clerk's authenticated user ID and no longer depends on the full mutable user object. Concurrent profile consumers share one request; account changes abort it and discard late responses. Owner access still requires a successful server profile response. Profile HTTP requests time out after 15 seconds; Dashboard offers retry instead of treating a network error as a non-owner login.
- HTML includes connection hints for the configured backend and Clerk frontend API, derived only from public client configuration.
- QR Back can run during status polling. It aborts the redundant read, suspends polling during cancellation, and navigates after the server confirms cancellation without waiting for a full catalog fetch. The transaction response includes restored stock fields for immediate local reconciliation; the catalog then refreshes in the background.
- Repeated cancellation after a lost response is idempotent and cannot restore stock twice. Paid orders and other users' orders remain protected. QR polling is limited to one active read, with cancellation on unmount and HTTP timeouts.
- Build, targeted lint and all 157 tests passed, including profile deduplication/account changes/sign-out/retry, stock response, repeated cancellation and paid/foreign-order rejection. No real payment/order was changed for verification. Authenticated browser timings were not measured.
- Backend `dpl_JAkxPh75GvZQuxmwW3wVtXccs9D5` and frontend `dpl_BCSQSaCdJCksLP6n9EWiAXnq7yoF` are READY on the existing production domains. Cart HTML returns 200; profile reads and QR cancellation without authentication both return 401.

## Dashboard revisits and cart feedback, 2026-09-30

- Dashboard keeps per-account/timezone/page data in provider-owned memory across route changes. Cached data renders immediately; reads within 30 seconds reuse it, while stale entries refresh in the background. Concurrent visits share a pending read. Focus and a visible-page 30-second interval refresh stale data. Signing out, switching accounts or losing the owner role clears the cache and aborts pending reads.
- Confirmed order-status changes update cached order rows and invalidate summaries. COD placement and confirmed QR payment invalidate summaries as well. Failed refreshes preserve existing data with the retry error visible. The backend still authorizes every request and sends private/no-store responses; no customer data is persisted in browser storage.
- Revenue bars no longer animate on every mount. The chart is memoized and retains the same layout, colours, axes and tooltip.
- Quantity writes start on the next event-loop turn, removing the previous 180 ms debounce. Same-line writes remain serialized and newer quantities coalesce while a save is pending.
- Validated size changes update the displayed size, quantity, price and selection immediately, preserving the source row timestamp. Failed saves restore original size rows and timestamps; account changes suppress late results. Checkout waits for the server acknowledgement. Size success toasts remain disabled.
- Build, targeted lint and all 165 tests passed. New cases cover returning visits without another summary request, stale background refreshes, cache/account isolation, invalidation, failed refresh recovery, immediate size changes, rollback and cancellation. These checks establish request counts and state behavior, not authenticated production API latency. No backend runtime code changed in this revision.
- Frontend `dpl_DrzikJJecjo5oCj7HKNGJVUCZe3X` is READY and aliased to the existing production site. `/owner` and the new `index-D5L4Bjc3.js` return 200; the served entry bundle includes the Dashboard cache.
