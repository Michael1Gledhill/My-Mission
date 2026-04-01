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

> Note: GitHub Pages is static hosting. This gives practical protection and approval gating, but it is not equivalent to a private always-on backend service.

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

## Legacy Files

Old monolithic pages (`admin.html`, old guide files) are kept in repository history/working tree for reference during migration.
