# Elder Gledhill's Mission Website

A beautiful, fully-featured missionary website hosted on **GitHub Pages** with admin panel and GitHub API publishing.

---

## 📁 Files

| File | Purpose |
|------|---------|
| `index.html` | Public-facing website (Home, Updates, Photos, About, Contact) |
| `admin.html` | Password-protected admin panel |
| `data.json` | **All site content** — the single source of truth |
| `README.md` | This file |

---

## 🚀 Setup (5 minutes)

### Step 1 — Create your GitHub repository

1. Go to **github.com** and sign in
2. Click **+ New repository**
3. Name it `mission-site` (or anything you like)
4. Set it to **Public**
5. Click **Create repository**

### Step 2 — Upload the files

1. In your new repo, click **Add file → Upload files**
2. Upload all 4 files: `index.html`, `admin.html`, `data.json`, `README.md`
3. Click **Commit changes**

### Step 3 — Enable GitHub Pages

1. Go to your repo **Settings → Pages**
2. Under **Source**, select **Deploy from a branch**
3. Choose **main** branch, **/ (root)** folder
4. Click **Save**
5. Your site will be live at: `https://YOUR-USERNAME.github.io/mission-site`

### Step 4 — Configure the Admin Panel

1. Visit `https://YOUR-USERNAME.github.io/mission-site/admin.html`
2. Log in with password: **mission2024** (change this immediately in Settings!)
3. Go to **GitHub / Publish** panel
4. Enter your GitHub username, repo name, and Personal Access Token

### Step 5 — Get a GitHub Personal Access Token (PAT)

1. Go to **github.com → Settings → Developer Settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Name it `Mission Site Admin`
4. Set expiration: **No expiration** (or 1 year)
5. Check the **`repo`** scope
6. Click **Generate token** — copy it immediately!
7. Paste it into the Admin → GitHub/Publish panel

### Step 6 — Update the public site config

In `index.html`, find these two lines near the bottom and update them:

```javascript
const GITHUB_USER = 'your-username';   // ← your GitHub username
const GITHUB_REPO = 'mission-site';    // ← your repo name
```

Commit this change and you're done!

---

## ✏️ How to Update the Site

1. Visit `admin.html` on your live site
2. Log in with your password
3. Make changes (write updates, adjust progress, move the map pin, etc.)
4. Click **🐙 Push to GitHub** in any panel or the top toolbar
5. Enter a commit message (e.g. "Add week 48 update")
6. Your live site updates automatically within 1–2 minutes!

---

## 🗺️ How to Draw Your Mission Boundary on the Map

1. Go to Admin → **Mission Map Editor**
2. Use the **polygon draw tool** (left toolbar on the map)
3. Click around the border of the mission territory, point by point
4. Double-click to close the polygon
5. When prompted, click **OK** to save as the mission boundary
6. Click **Save All Map Data**, then **Push to GitHub**

To draw individual **area boundaries** (Rexburg, Pocatello, etc.):
1. Draw a polygon the same way
2. When prompted, click **Cancel** (to assign as area, not mission boundary)
3. Enter the area name when prompted
4. Save and push

To **import a KML or GeoJSON boundary** you already have:
1. Convert your KML to a coordinate array: `[[lat,lng],[lat,lng],…]`
2. Paste it into the **Import GeoJSON** box in the Map Editor
3. Click **Import Boundary**

---

## 🔐 Security Notes

- The admin panel password is stored in your **browser's localStorage** — it never goes to GitHub
- Your GitHub PAT is also stored only in localStorage — it's never in any file in the repo
- The PAT is used only to push `data.json` updates to GitHub
- Change the default password immediately after setup!

---

## 📞 Support

Built for Elder Michael Gledhill's Idaho Idaho Falls Mission. Questions? Contact the Gledhill family.

*The Church of Jesus Christ of Latter-day Saints · Idaho Idaho Falls Mission · 2024–2026*
