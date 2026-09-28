import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const catalogPath = fileURLToPath(
  new URL("../public/data/themes.json", import.meta.url),
);
const outputDir = fileURLToPath(new URL("../public/previews/", import.meta.url));
const limitArgument = process.argv.find((argument) =>
  argument.startsWith("--limit="),
);
const limit = limitArgument ? Number(limitArgument.slice(8)) : Infinity;
const concurrency = 6;
const themes = JSON.parse(await readFile(catalogPath, "utf8"))
  .themes.filter((theme) => theme.preview)
  .slice(0, limit);

await mkdir(outputDir, { recursive: true });

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(theme) {
  const target = `${outputDir}${theme.id}.webp`;
  if (await exists(target)) return "cached";

  try {
    // Browser-like user agents receive the site's bot challenge instead of the image.
    const response = await fetch(theme.preview, {
      headers: { Accept: "image/*", Referer: "https://themes.rockbox.org/" },
      signal: AbortSignal.timeout(20000),
    });

    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/")
    ) {
      return "failed";
    }

    const image = Buffer.from(await response.arrayBuffer());
    if (image.length > 20_000_000) return "failed";

    await writeFile(
      target,
      await sharp(image, { limitInputPixels: 40000000 })
        .webp({ quality: 90 })
        .toBuffer(),
    );
    return "downloaded";
  } catch {
    return "failed";
  }
}

const counts = { downloaded: 0, cached: 0, failed: 0 };
const failures = [];
let nextIndex = 0;

await Promise.all(
  Array.from({ length: Math.min(concurrency, themes.length) }, async () => {
    while (nextIndex < themes.length) {
      const theme = themes[nextIndex];
      nextIndex += 1;
      const result = await download(theme);
      counts[result] += 1;
      if (result === "failed") failures.push(theme.id);
    }
  }),
);

console.log(JSON.stringify({ total: themes.length, ...counts, failures }, null, 2));
