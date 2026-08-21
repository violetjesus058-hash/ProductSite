# Analytics deployment check

On 2026-08-21, the Cloudflare Pages production deployment at commit `c38eeb5` was verified at `https://19954329.productsite-8wf.pages.dev/admin/analytics`. The route now loads the ProductSite analytics console with the Worker admin key field, period selector, and Load analytics button. The stable domain had previously returned 404 before Pages picked up the commit. The console is ready; it requires the configured `ADMIN_API_KEY` to request the D1 summary.
