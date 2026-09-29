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

## Sources

- [Rockbox theme site](https://themes.rockbox.org/index.php?allthemes): the source of the theme catalog, preview images, and downloads
- [Rockbox/themesite](https://github.com/Rockbox/themesite): the source code for the Rockbox theme site, used to understand how the catalog is structured
- [Rockbox](https://www.rockbox.org): the open source firmware these themes are made for

## Features

- Filter by LCD resolution, device, firmware support, community rating, download size, screen shape, and preview appearance
- Filter counts update to reflect the other filters you've applied
- Removable filter chips, text search, and sorting
- Filters and sort are saved in the URL (for example `?lcd=320x240&palette=black&sort=downloads`), with share buttons for the filtered view or the plain page
- Appearance labels (mostly dark, mostly light, mostly black, unidentified) to help find themes for OLED screens
- Rockbox-inspired design with a light/dark mode toggle that remembers your choice

## Data notes

- **Catalog data:** `public/data/themes.json` is built from the [all themes page](https://themes.rockbox.org/index.php?allthemes), since Rockbox doesn't offer a public API. It's refreshed each time the site deploys, so it's as current as the last deploy.
- **Device data:** `public/data/devices.json` lists the themes that pass Rockbox's own compatibility check for each device, from the same source Rockbox Utility uses. Devices with the same screen size can support different themes, so this is more precise than filtering by LCD resolution.
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
| `npm run data:update`         | Runs the four data scripts below in order                                                     |
| `npm run fetch:catalog`       | Rebuilds `themes.json` from the Rockbox all themes page (one request)                         |
| `npm run download:previews`   | Downloads missing preview images into `public/previews/` as WebP (existing files are skipped) |
| `npm run classify:appearance` | Labels themes that don't have an appearance yet, using the local preview images               |
| `npm run fetch:devices`       | Rebuilds `devices.json` with each device's compatible themes (about 85 spaced-out requests)   |

`download:previews` and `classify:appearance` accept `--limit=N` for trial runs. `classify:appearance` also accepts `--dry-run`, and `--all` to relabel every theme.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the project layout, how to add a filter, and the full edit-and-deploy workflow.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which:

1. Installs dependencies with `npm ci` on Node 22
2. Runs `npm run data:update` to pick up new and changed themes and refresh each device's compatible themes. Only missing preview images are downloaded, and device requests are spaced out, to keep the load on the Rockbox server low. If Rockbox can't be reached, the build continues with the data committed in the repo.
3. Builds with `NEXT_PUBLIC_BASE_PATH=/<repo-name>` so links and images work under the GitHub Pages subpath
4. Uploads the `out/` folder and deploys it to GitHub Pages

You can also run the workflow by hand from the **Actions** tab. In the repo settings, **Settings → Pages → Source** must be set to **GitHub Actions**.

Preview images are committed to the repo because GitHub Pages can only serve static files and the Rockbox site doesn't reliably serve its preview images to other sites. The deploy doesn't commit its refreshed data back to the repo, so run `npm run data:update` locally and commit the results now and then to keep each deploy's downloads small.
