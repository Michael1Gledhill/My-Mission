# Mission Portal Rebuild (GitHub-Only)

This project has been rebuilt using:

- **HTML + CSS + TS + TSX** (Vite + React frontend)
- **Python** scripts for encryption, validation, and migration
- **GitHub Actions** for validation and Pages deployment

## Security Model

This implementation enforces:

1. Registration requires **first name, last name, email, password**.
2. Accounts are created as **pending** by default.
3. Only **approved** users can access protected content.
4. Admin can approve/reject/suspend users from the admin interface.
5. Sensitive repository stores are represented as encrypted artifacts (`*.enc.json`) and rotated with CI scripts.
6. A baseline Content Security Policy (CSP) is defined in `index.html` for static-hosted protection.

> Note: GitHub Pages is static hosting. This gives practical protection and approval gating, but it is not equivalent to a private always-on backend service.

## Content Security Policy (CSP)

This app uses a CSP `<meta http-equiv="Content-Security-Policy">` in `index.html` because GitHub Pages does not let you set custom response headers directly.

Current baseline policy:

- `default-src 'self'`
- `script-src 'self'`
- `style-src 'self'`
- `img-src 'self' https: data: blob:`
- `font-src 'self' data:`
- `connect-src 'self'`
- `object-src 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `upgrade-insecure-requests`

### Hardening notes

- If your photos are only on trusted origins, replace `https:` in `img-src` with explicit domains.
- If you later move behind a proxy/server, prefer real CSP response headers and add `frame-ancestors 'none'` there.
- Keep third-party scripts disabled unless strictly required.

## Project Structure

- `index.html` — Vite app entry
- `src/` — TS/TSX frontend
- `data/content.json` — canonical editable site content
- `data/*.enc.json` — encrypted auth/audit placeholders
- `scripts/*.py` — Python encryption/validation/migration tools
- `.github/workflows/*.yml` — CI validation + Pages deploy + encryption utility workflow

## Local Development

1. Install Node.js 20+
2. Install dependencies:
   - `npm install`
3. Run dev server:
   - `npm run dev`
4. Build:
   - `npm run build`

## Python Tooling

1. Create venv (optional)
2. Install requirements:
   - `pip install -r requirements.txt`

### Validate content

- `python scripts/validate_content.py --file data/content.json`

### Encrypt a plain auth file

- `python scripts/encrypt.py --input data/accounts.plain.json --output data/accounts.enc.json --key <64_hex_chars>`

### Decrypt an encrypted file

- `python scripts/decrypt.py --input data/accounts.enc.json --output data/accounts.plain.json --key <64_hex_chars>`

### Migrate old `data.json`

- `python scripts/migrate_legacy_data.py`

## GitHub Setup

1. Add GitHub repository secret:
   - `ENCRYPTION_KEY` = 64 hex characters (32 bytes)
2. Enable GitHub Pages (Actions source)
3. Push to `main`
4. `Validate Content` workflow runs first
5. `Deploy GitHub Pages` runs after validation succeeds

## Admin Capabilities

- User approvals: approve/reject/suspend
- Full content JSON editor: **every webapp detail editable** from admin panel
- Local session controls + sign out

## Forgot Password (Secure Flow)

Because this project is static-hosted on GitHub Pages, there is no server-side email reset token service.

Use this process:

1. User contacts an approved admin directly.
2. Admin uses **Reset password** in the admin panel.
3. Temporary password is shown in masked/reveal mode, auto-expires from UI, and should be shared out-of-band.
4. User signs in and should immediately change to a new strong password.

Operational recommendations:

- Prefer one-time direct communication (phone/in-person) for temporary passwords.
- Do not post reset credentials in public chats.
- Review `Audit log` events after password reset actions.

## Legacy Files

Old monolithic pages (`admin.html`, old guide files) are kept in repository history/working tree for reference during migration.
