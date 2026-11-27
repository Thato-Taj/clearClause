# ClearClause browser extension

Checks the page you're on (or text you paste) with the ClearClause API. Works in Chrome, Edge, Brave and Firefox (Manifest V3).

## Try it locally

1. Start the API (`cd backend && npm run dev`, port 5001) and the website (`cd frontend && npm run dev`, port 3000).
2. Load this folder:
   - **Chrome / Edge / Brave:** `chrome://extensions` → turn on Developer mode → **Load unpacked** → pick `extension/`.
   - **Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `extension/manifest.json`.
3. Open any terms page, click the ClearClause icon, then **Use this page** → **Check it**.

Guests get the anonymous daily allowance. To use a plan and save checks to **Reports**, sign in on the website, create an access key under **Account → Browser extension and API**, and paste it into the extension (key icon).

## Before publishing

- Set `apiUrl` and `webUrl` in `config.js` to the production URLs.
- Change `browser_specific_settings.gecko.id` in `manifest.json` to an ID you own (for example `extension@yourdomain.co.za`).
- Set `NEXT_PUBLIC_EXTENSION_URL` on the website to the store listing, so "Get the extension" links there.
- The API needs no CORS changes: it already accepts `chrome-extension://` and `moz-extension://` origins.

## How it fits together

- `POST /api/analyze` with `{ text, language, channel: "extension" }`. The `X-API-Key` header is sent when a key is saved.
- `GET /api/me` fills the status line (plan and scans left today).
- Results are drawn with DOM APIs only, never `innerHTML`, because page text and model output are untrusted.
- The popup stops when it closes, so a check in progress is lost. Signed-in checks are still saved to Reports on the server.
