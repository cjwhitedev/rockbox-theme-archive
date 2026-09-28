# Rockbox Theme Archive

A friendlier way to browse, filter, and sort the community themes from the [Rockbox theme site](https://themes.rockbox.org/index.php?allthemes).

**Live site:** https://cjwhitedev.github.io/rockbox-theme-archive/

> [!IMPORTANT]
> **This project was generated with AI.**
>
> **Nearly all of the code, scripts, styling, and this README were written by GitHub Copilot, an AI coding assistant, running in agent mode in VS Code on the Claude Opus 5.5 model.** A human (me, the repo owner, a front-end developer with 10+ years of experience) directed the work, chose the features, and reviewed the results in the browser, but did not hand-write the code. This is a side project to test out what an AI coding agent can do.
>
> A note from Copilot: I built this over a few chat sessions by reading the original site and its [source code](https://github.com/Rockbox/themesite), writing the scripts that collect the catalog and preview images, and running type checks, lint, and production builds along the way. I can make mistakes, and some of the data here is my own estimate rather than fact (see [Data notes](#data-notes)). Please treat it that way, and open an issue if something looks wrong.

This is an unofficial project and isn't affiliated with Rockbox. Themes, previews, and metadata belong to their original creators. Downloads and details pages link back to themes.rockbox.org.

## Features

- Filter by LCD resolution, firmware support, community rating, download size, screen shape, and preview appearance
- Filter counts update to reflect the other filters you've applied
- Removable filter chips, text search, and sorting
- Appearance labels (mostly dark, mostly light, mostly black, mixed) to help find themes for OLED screens
- Rockbox-inspired design with a light/dark mode toggle that remembers your choice

## Data notes

- **Catalog snapshot:** `public/data/themes.json` is a one-time snapshot of the Rockbox theme list. Rockbox doesn't offer a public API, and the site is behind a bot challenge, so the data doesn't update live.
- **Appearance labels are estimates.** They're based on the brightness of each theme's first preview image. "Mostly black" means at least 55% of that preview's pixels are near-black. A theme may look different on your device.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router) with [React](https://react.dev) 19 and TypeScript
- Static export (`output: "export"`) hosted on GitHub Pages
- [sharp](https://sharp.pixelplumbing.com/) for converting previews to WebP and measuring their brightness
- ESLint via `eslint-config-next`

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Script                        | What it does                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Starts the development server                                                                 |
| `npm run build`               | Builds the static site into `out/`                                                            |
| `npm run lint`                | Runs ESLint                                                                                   |
| `npm run download:previews`   | Downloads missing preview images into `public/previews/` as WebP (existing files are skipped) |
| `npm run classify:appearance` | Recalculates the appearance labels in `themes.json` from the preview images                   |

Both data scripts accept `--limit=N` for trial runs. `classify:appearance` also accepts `--dry-run`.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which:

1. Installs dependencies with `npm ci` on Node 22
2. Builds with `NEXT_PUBLIC_BASE_PATH=/<repo-name>` so links and images work under the GitHub Pages subpath
3. Uploads the `out/` folder and deploys it to GitHub Pages

You can also run the workflow by hand from the **Actions** tab. In the repo settings, **Settings → Pages → Source** must be set to **GitHub Actions**.

Preview images are committed to the repo because GitHub Pages can only serve static files and the Rockbox site doesn't reliably serve its preview images to other sites.
