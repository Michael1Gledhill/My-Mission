## Plan: Complete Secure GitHub-Hosted Rebuild

Recreate the app as a modern TS/TSX frontend + admin CMS, with Python-powered GitHub Actions handling approvals, encryption workflows, validation, and publishing.
This will satisfy your requirements: required signup fields (first/last/email/password), admin approval before access, and encrypted sensitive files in GitHub for additional protection.

### What is locked in from your requirements

- GitHub-only hosting ✅ (GitHub Pages + GitHub Actions allowed)
- Required signup fields ✅ (first name, last name, email, password)
- Approval gate ✅ (no approved account = no protected access)
- Admin-editable everything ✅ (all site details editable in admin)
- Encrypted files in repo ✅ (accounts/pending/audit stored encrypted)

### Steps

1. **Security and scope definition** *(blocks all other work)*  
   Define threat model and access tiers (`public`, `approved-user`, `admin`) and codify security boundaries for GitHub static hosting.

2. **Project bootstrap (HTML/CSS/TS/TSX + Python)** *(depends on 1)*  
   Build new repo structure with separate public app and admin app, plus Python scripts for security/data workflows.

3. **Canonical data model and schema validation** *(depends on 1; parallel with 2 after field inventory)*  
   Move to single source of truth for content, and encrypted JSON files for auth/account state.

4. **User auth UX implementation** *(depends on 2,3)*  
   Build signup/login with required fields and account states (`pending`, `approved`, `rejected`, `suspended`).

5. **Admin approval system** *(depends on 4)*  
   Approval queue, account moderation, role-based admin controls, and audit trail in admin UI.

6. **GitHub Actions + Python security workflows** *(depends on 2,3,4,5)*  
   Workflows for registration processing, approval updates, encryption/decryption, validation, and publish.

7. **Encrypted-at-rest repository storage** *(depends on 3,6)*  
   Use AES-GCM Python scripts and GitHub Secrets-managed keys for protected account artifacts.

8. **Full admin-editable CMS coverage** *(depends on 2,3; parallel with 4/5)*  
   Every visible detail editable: profile, updates, map, photos, scripture, labels, metadata, legal text, toggles.

9. **UX and accessibility hardening** *(depends on 4,5,8)*  
   Mobile-first improvements, accessibility compliance, better error states, loading and feedback quality.

10. **Security hardening** *(depends on 4,5,6,7)*  
   CSP, sanitization, throttling, failed-login lockouts, signed admin actions, key rotation procedures.

11. **Data migration + cutover** *(depends on 8,10)*  
   Convert existing `data.json` to new schema and perform controlled switch from current app.

12. **Verification and acceptance** *(depends on all)*  
   End-to-end testing for signup → approval → gated access and admin editability verification.

### Relevant files (current + planned)

- `c:\Users\cadet\Documents\GitHub\My Mission\index.html` — public app baseline to replace with modular TS/TSX
- `c:\Users\cadet\Documents\GitHub\My Mission\admin.html` — current admin baseline for full feature inventory
- `c:\Users\cadet\Documents\GitHub\My Mission\data.json` — migration source
- `c:\Users\cadet\Documents\GitHub\My Mission\SETUP-GUIDE.html` — operator docs to rewrite
- `c:\Users\cadet\Documents\GitHub\My Mission\.github\workflows\*.yml` — new automation workflows
- `c:\Users\cadet\Documents\GitHub\My Mission\scripts\*.py` — encryption/validation/migration/audit scripts
- `c:\Users\cadet\Documents\GitHub\My Mission\src\public\*.tsx` — public site
- `c:\Users\cadet\Documents\GitHub\My Mission\src\admin\*.tsx` — admin panel
- `c:\Users\cadet\Documents\GitHub\My Mission\data\*.enc.json` — encrypted account and approval stores

### Verification

1. PR gates: lint, typecheck, schema validation, build pass.
2. Registration requires first/last/email/password and enters pending state.
3. Pending users cannot access protected content.
4. Admin approve/reject immediately updates access state after workflow publish.
5. Encrypted repo artifacts contain no plaintext user records.
6. Admin “edit everything” checklist passes for all webapp sections.

### Decisions applied

- Manual admin approval only (no external email verification service).
- GitHub Actions permitted under GitHub-only rule.
- All webapp details must be editable from admin (explicitly included).
- Encrypted files in GitHub added for account/pending/audit protection.
- Important caveat: with static hosting, this is strong practical protection, but not equal to a private server-side auth backend.
