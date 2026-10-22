# Contributing

Thanks for helping. This is a small project, so the bar is simple: keep it
working, keep it honest.

## Getting set up

```bash
git clone https://github.com/khezan10/downloadin-ya.git
cd downloadin-ya
npm install
cp .env.example .env.local     # optional — the app runs without MongoDB
npm run dev
```

## Before you open a pull request

```bash
npm run check     # lint + unit tests + production build
```

All three must pass. CI runs exactly this, on Node 20 and Node 22.

## Ground rules

1. **No API keys, no accounts, no cookies.** Every upstream has to work
   keyless, or the project cannot stay free and open.
2. **Prove it works.** A platform is only "supported" when there is a URL
   that resolves to a media file and a test that shows it. A badge in the UI
   is not evidence.
3. **Hand over links that work.** If an upstream returns a proxy path, unwrap
   it to the direct CDN link — the proxy routes answer 403 to visitors.
4. **Match platforms on the hostname**, never on a substring of the URL.
   `"t.co"` is a substring of `"pinterest.com"`, and that bug sent every
   Pinterest link to the Twitter branch.
5. **Add a test with the fix.** `tests/` holds the regression tests for the
   bugs that have bitten this project.

## Adding a platform

1. Add the host patterns to `lib/platform.js` and a case to
   `tests/platform.test.js`.
2. Normalise the URL if the upstream only accepts one shape (see
   `lib/pinterest.js` for the pattern).
3. Make sure the resolved link is a direct CDN link, not a proxy.
4. Only then flip the badge in `app/page.js` and add the platform to the
   README table.

## Commit messages

Plain and factual: `fix: ...`, `feat: ...`, `docs: ...`, `chore: ...`,
`test: ...`. Describe the change, not the process.
