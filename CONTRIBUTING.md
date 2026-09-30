# Contributing

How to work on this project: running it, where things live, and how changes get deployed. The [README](README.md) covers what the site does.

## Setup

You need Node 22 or later (the deploy uses Node 22).

```bash
npm install
npm run dev
```

Open http://localhost:3000. The page reloads as you edit.

> [!NOTE]
> This project uses Next.js 16, which differs from older versions in places. Before changing Next.js config or conventions, check the docs bundled in `node_modules/next/dist/docs/`.

## Project layout

| Path                              | What it is                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `src/components/ThemeBrowser.tsx` | The whole page: header, AI notice, filters, search, sort, share buttons, theme cards |
| `src/app/globals.css`             | All styles, including the light and dark colour variables at the top                 |
| `src/app/page.tsx`                | Loads the data files and passes them to `ThemeBrowser`                               |
| `src/app/layout.tsx`              | Page title, description, and fonts                                                   |
| `public/data/themes.json`         | Theme catalog built by `fetch:catalog`, plus appearance labels                       |
| `public/data/devices.json`        | Devices and the theme IDs that work on each, built by `fetch:devices`                |
| `public/data/touch.json`          | Which themes have touch controls, built by `scan:touch` (run locally, not on deploy) |
| `public/previews/`                | Preview images as `<theme id>.webp`, downloaded by `download:previews`               |
| `scripts/`                        | The data scripts (see below)                                                         |
| `.github/workflows/deploy.yml`    | Builds and deploys to GitHub Pages                                                   |

## Common changes

### Change text or styles

- Page text is in `ThemeBrowser.tsx`. The AI notice is near the top of the returned markup, and the footer is at the bottom.
- Colours are CSS variables in `globals.css`: `:root` for light mode and `:root[data-theme="dark"]` for dark mode. Change the variable instead of individual rules where possible.

### Add or change a filter

Each filter is stored in the URL, so a new filter needs a few matching pieces in `ThemeBrowser.tsx`:

1. **Default value:** add a key to `filterDefaults`. The key becomes the URL parameter name, for example `lcd`.
2. **Allowed values:** add them to `filterParamOptions`, or handle them in `readParam` if they come from the data, as `lcd` and `device` do. Invalid URL values fall back to the default.
3. **Read it:** `const myFilter = readParam("myKey");`
4. **Match it:** add a name to `FilterDimension` and a check in `matchesTheme`. Follow the existing pattern, where `omitted === "<name>"` skips the check so the option counts can be calculated.
5. **Count options:** use `countMatches("<name>", predicate)` for each option.
6. **Dropdown:** copy an existing `<section className="filter-section">` block and call `updateFilters({ myKey: value })` in `onChange`.
7. **Chip:** add an entry to `activeFilters` so the filter can be removed from the results bar.

Clear all and the share buttons pick up new filters automatically.

### Change the data

Don't edit `themes.json` or `devices.json` by hand. The next deploy overwrites them. Change the script that builds them instead. `touch.json` isn't overwritten by deploys, but it should still only be changed through `scan:touch`.

## Data scripts

These collect data from [themes.rockbox.org](https://themes.rockbox.org). Rockbox has no public API, so the scripts read the site's pages. Please keep requests to a minimum, since it's a community project's server.

| Script                        | Requests to Rockbox                                    | What it does                                                          |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| `npm run fetch:catalog`       | 1                                                      | Rebuilds `themes.json` from the all themes page                       |
| `npm run download:previews`   | 1 per missing image                                    | Downloads preview images that aren't in `public/previews/` yet        |
| `npm run classify:appearance` | None                                                   | Labels new themes as mostly dark, light, black, or unidentified       |
| `npm run fetch:devices`       | About 85, spaced half a second apart (about 3 minutes) | Rebuilds `devices.json` from each device's Rockbox Utility theme list |
| `npm run data:update`         | All of the above                                       | Runs the four scripts in order                                        |

Notes:

- `fetch:catalog` refuses to overwrite `themes.json` if it finds far fewer themes than before, which usually means Rockbox returned an error or bot-check page.
- `fetch:catalog` keeps existing appearance labels unless a theme's preview image changed.
- `fetch:devices` keeps a device's previous list if its request fails.
- `classify:appearance --all` relabels every theme using the local images. It makes no requests.

### Touch controls scan (run locally)

```bash
npm run scan:touch
```

Rockbox's data doesn't say whether a theme has touch controls, so this script downloads each theme's package and checks its skin files for touch regions (`%T(` or `%Tl` tags). Results are saved by theme ID in `public/data/touch.json`.

- **Each theme is downloaded at most once.** Themes already in `touch.json` are skipped, so each run only downloads themes added since the last one.
- **Each download adds 1 to that theme's public download count on Rockbox,** because the only way to get the files is the site's download link. That's why this runs locally rather than on every deploy: the deploy doesn't commit its data back, so it would download the same new themes on every push.
- **Downloads are spaced 1 second apart.** The first full scan covers about 1,600 themes (roughly 477 MB) and takes well over half an hour. Each result is saved as soon as that theme is scanned, so you can stop it with <kbd>Ctrl</kbd>+<kbd>C</kbd> and run it again later to continue.
- **If `touch.json` can't be read,** the script stops instead of starting over, since starting over would re-download every theme. Restore the file from git (`git checkout public/data/touch.json`) and run it again.
- **`--limit=N`** scans at most N unscanned themes, for example `npm run scan:touch -- --limit=50`.
- **Themes whose download returns 404 on Rockbox** are recorded as `unavailable` and skipped on later runs. To try them again, use `npm run scan:touch -- --retry-unavailable`. Other failures, such as timeouts, are retried automatically next run.
- It uses the `unzip` command, which is included on macOS and most Linux systems.

After scanning, commit `public/data/touch.json`. Themes that haven't been scanned yet, or whose download is missing on Rockbox, appear under **Unidentified** in the filter and show "Touch unknown" on their card.

The cache only lasts as long as the committed file. If `touch.json` is deleted or reset before being committed, or you scan on another computer without running `git pull` first, those themes are downloaded again. When a theme is updated on Rockbox it gets a new ID, so each new version is scanned once.

## Before you commit

Run the same checks the deploy relies on:

```bash
npx tsc --noEmit && npm run lint && NEXT_PUBLIC_BASE_PATH=/rockbox-theme-archive npm run build
```

`NEXT_PUBLIC_BASE_PATH` matches how GitHub Pages serves the site under `/rockbox-theme-archive/`, so this catches broken image or link paths.

To preview the built site, serve the `out/` folder with any static server, for example `npx serve out`. Links will expect the `/rockbox-theme-archive/` prefix.

Then commit and push:

```bash
git add -A && git commit -m "Describe the change" && git push
```

## Deploying

Every push to `main` deploys automatically through [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

1. Installs dependencies.
2. Runs `npm run data:update`. If Rockbox can't be reached, this step fails without stopping the deploy, and the build uses the data committed in the repo.
3. Builds the static site and publishes it to GitHub Pages.

It usually takes 4 to 5 minutes, mostly for `fetch:devices`. You can also start it by hand from the repo's **Actions** tab (**Deploy to GitHub Pages → Run workflow**).

The deploy doesn't commit refreshed data back to the repo. To commit it, run `npm run data:update` locally now and then and push the changes. That also keeps the preview downloads during each deploy small.

## Troubleshooting

- **Type errors mentioning `.next/dev/types`:** these come from files the dev server generated for code that no longer exists. Delete `.next/dev` and rerun.
- **A deploy's data step failed:** open the run in the **Actions** tab and expand **Refresh theme data from themes.rockbox.org**. The site still deployed with the committed data.
- **A theme's preview is missing:** its image failed to download. Run `npm run download:previews`, then `npm run classify:appearance`.
