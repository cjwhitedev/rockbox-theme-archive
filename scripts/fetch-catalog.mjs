import { readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = "https://themes.rockbox.org/index.php?allthemes";
const origin = "https://themes.rockbox.org";
const catalogPath = fileURLToPath(
  new URL("../public/data/themes.json", import.meta.url),
);
const previewDir = fileURLToPath(new URL("../public/previews/", import.meta.url));
const sizeUnits = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function clean(text = "") {
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

function parseCatalog(html) {
  const names = new Map(
    [...html.matchAll(/<th[^>]*><a href="index\.php\?themeid=(\d+)">([\s\S]*?)<\/a><\/th>/g)].map(
      ([, id, name]) => [Number(id), clean(name)],
    ),
  );

  return [...html.matchAll(/<td>\s*<p align="center">([\s\S]*?)<\/td>/g)].flatMap(
    ([, cell]) => {
      const id = Number(cell.match(/download\.php\?themeid=(\d+)/)?.[1]);
      const lcd = clean(cell.match(/Designed for LCD size: <\/strong>([^<]*)</)?.[1]);
      if (!id || !lcd) return [];

      const [width, height] = lcd.split("x").map(Number);
      const imagePath = cell.match(/<img src="(themes\/[^"]+\.(?:png|jpe?g|gif|bmp))"/i)?.[1];
      const size = cell.match(/Size:\s*([\d.]+)\s*([KMG]?B)\b/);

      return [
        {
          id,
          name: names.get(id) ?? "",
          submitter: clean(cell.match(/Submitter:<\/strong>([\s\S]*?)<br/)?.[1]),
          submittedAt: clean(cell.match(/Submitted:<\/strong>([\s\S]*?)<br/)?.[1]),
          downloads: Number(cell.match(/Downloaded (\d+) times?/)?.[1] ?? 0),
          votes: Number(cell.match(/(\d+) votes?\b/)?.[1] ?? 0),
          rating: (cell.match(/src="filled\.png"/g) ?? []).length,
          sizeLabel: size ? `${size[1]}${size[2]}` : "",
          sizeBytes: size ? Math.round(Number(size[1]) * sizeUnits[size[2]]) : 0,
          lcd,
          width: width || 0,
          height: height || 0,
          description: clean(
            cell.match(/Description:<\/strong><br \/>([\s\S]*?)<br \/>/)?.[1],
          ),
          worksWithDev: /Works with <span class="build_info"[^>]*>current dev build/.test(cell),
          releaseVersions: [
            ...cell.matchAll(/<strong>Works with release ([^<]+)<\/strong>/g),
          ].map(([, version]) => clean(version)),
          preview: imagePath ? new URL(decodeEntities(imagePath), `${origin}/`).href : "",
          detailUrl: `${origin}/index.php?themeid=${id}`,
          downloadUrl: `${origin}/download.php?themeid=${id}`,
        },
      ];
    },
  );
}

const previous = JSON.parse(await readFile(catalogPath, "utf8"));
const previousById = new Map(previous.themes.map((theme) => [theme.id, theme]));

const response = await fetch(source, {
  headers: { Accept: "text/html" },
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Catalog request failed: HTTP ${response.status}`);

const themes = parseCatalog(await response.text());

// Guards against writing a bot-challenge page or a changed layout over good data.
if (themes.length < previous.themes.length * 0.9) {
  throw new Error(
    `Parsed ${themes.length} themes, expected about ${previous.themes.length}; keeping the existing catalog`,
  );
}

let changedPreviews = 0;
for (const theme of themes) {
  const prior = previousById.get(theme.id);
  const samePreview = prior?.preview === theme.preview;

  if (prior && !samePreview) {
    changedPreviews += 1;
    await unlink(`${previewDir}${theme.id}.webp`).catch(() => { });
  }

  theme.appearance = samePreview ? prior.appearance : "mixed";
  theme.appearanceConfidence = samePreview ? prior.appearanceConfidence : null;
  theme.blackShare = samePreview ? prior.blackShare : null;
  theme.mostlyBlack = samePreview ? prior.mostlyBlack : false;
}

await writeFile(
  catalogPath,
  JSON.stringify({
    ...previous,
    source,
    capturedAt: new Date().toISOString(),
    count: themes.length,
    themes,
  }),
);

console.log(
  JSON.stringify({
    total: themes.length,
    added: themes.filter((theme) => !previousById.has(theme.id)).length,
    removed: previous.themes.filter(
      (theme) => !themes.some((current) => current.id === theme.id),
    ).length,
    changedPreviews,
  }),
);
