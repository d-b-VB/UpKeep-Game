# UpKeep Game Demo

This repo contains a tiny browser-playable prototype of the hex-grid game idea.

## What should I open in a browser?
Open **`index.html`**.

- Fastest local path: double-click `index.html`.
- Shareable no-terminal path: enable GitHub Pages for the **repository**.

## How do I run this?

### Option A (no terminal, recommended): GitHub Pages

Use this exact path for your repo:
- `https://github.com/<owner>/<repo>/settings/pages`

From the repository page (`Code / Issues / Pull requests / Actions ...`):
1. Click **Settings**.
2. In the left sidebar, scroll to **Code and automation**.
3. Click **Pages** (it is in that sidebar list).
4. In **Build and deployment**, set **Source = GitHub Actions**.
5. Open the **Actions** tab and wait for **Deploy static site to GitHub Pages** to complete.
6. Go back to **Settings → Pages** and open the published URL.

Expected URL pattern:
- `https://<owner>.github.io/<repo>/`

#### If you still don’t see "Build and deployment"
- Confirm you are in **repository settings**, not account settings.
- Confirm the URL includes your repo name: `/UpKeep-Game/settings/pages` (or your repo name).
- If **Pages** appears in the left sidebar but has limited options, GitHub may not have initialized Pages for that repo yet—run the workflow once from **Actions → Deploy static site to GitHub Pages → Run workflow**, then refresh Settings → Pages.

### Option B (local file, no server)
1. Download/clone the repo.
2. Open `index.html` directly in Chrome/Firefox/Safari/Edge.

### Option C (local server, optional)
From the repo folder:

```bash
python3 -m http.server 4173
```

Then open:
- `http://localhost:4173/`

## Controls
- Click or tap a highlighted adjacent hex to move the hammer.
- Keyboard: tab to a highlighted hex, then press `Enter` or `Space`.
