import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const catalogPath = fileURLToPath(
  new URL("../public/data/themes.json", import.meta.url),
);
const dryRun = process.argv.includes("--dry-run");
const limitArgument = process.argv.find((argument) =>
  argument.startsWith("--limit="),
);
const limit = limitArgument ? Number(limitArgument.slice(8)) : Infinity;
const concurrency = 6;
const themes = JSON.parse(await readFile(catalogPath, "utf8")).themes;
const selectedThemes = themes.slice(0, limit);
const imageRequests = new Map();

async function getPreview(url) {
  if (!imageRequests.has(url)) {
    imageRequests.set(
      url,
      (async () => {
        try {
          const response = await fetch(url, {
            headers: {
              Accept: "image/*",
              Referer: "https://themes.rockbox.org/",
            },
            signal: AbortSignal.timeout(20000),
          });

          if (
            !response.ok ||
            !response.headers.get("content-type")?.startsWith("image/")
          ) {
            return null;
          }

          const image = Buffer.from(await response.arrayBuffer());
          if (image.length > 20_000_000) return null;
          return image;
        } catch {
          return null;
        }
      })(),
    );
  }

  return imageRequests.get(url);
}

async function classify(theme) {
  if (!theme.preview) {
    return {
      id: theme.id,
      appearance: "unknown",
      blackShare: null,
      mostlyBlack: false,
    };
  }

  const image = await getPreview(theme.preview);
  if (!image) {
    return {
      id: theme.id,
      appearance: "unknown",
      blackShare: null,
      mostlyBlack: false,
    };
  }

  try {
    const { data, info } = await sharp(image, { limitInputPixels: 40000000 })
      .resize(48, 48, { fit: "inside" })
      .flatten({ background: { r: 128, g: 128, b: 128 } })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.width < 8 || info.height < 8) {
      return {
        id: theme.id,
        appearance: "unknown",
        blackShare: null,
        mostlyBlack: false,
      };
    }

    let darkPixels = 0;
    let blackPixels = 0;
    let lightPixels = 0;
    const pixelCount = info.width * info.height;

    for (let index = 0; index < data.length; index += info.channels) {
      const red = data[index] / 255;
      const green = data[index + 1] / 255;
      const blue = data[index + 2] / 255;
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

      if (luminance < 0.055) blackPixels += 1;
      if (luminance < 0.27) darkPixels += 1;
      if (luminance > 0.73) lightPixels += 1;
    }

    const blackShare = blackPixels / pixelCount;
    const darkShare = darkPixels / pixelCount;
    const lightShare = lightPixels / pixelCount;
    const appearance =
      darkShare >= 0.55 && darkShare - lightShare >= 0.2
        ? "dark"
        : lightShare >= 0.55 && lightShare - darkShare >= 0.2
          ? "light"
          : "mixed";

    return {
      id: theme.id,
      appearance,
      blackShare,
      mostlyBlack: blackShare >= 0.55,
      appearanceConfidence: Number(Math.max(darkShare, lightShare).toFixed(2)),
    };
  } catch {
    return {
      id: theme.id,
      appearance: "unknown",
      blackShare: null,
      mostlyBlack: false,
    };
  }
}

const results = new Array(selectedThemes.length);
let nextIndex = 0;

await Promise.all(
  Array.from({ length: Math.min(concurrency, selectedThemes.length) }, async () => {
    while (nextIndex < selectedThemes.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await classify(selectedThemes[index]);
    }
  }),
);

const counts = results.reduce(
  (total, result) => {
    total[result.appearance] = (total[result.appearance] ?? 0) + 1;
    return total;
  },
  {},
);
const mostlyBlackCount = results.filter(
  (result) => result.mostlyBlack,
).length;
const darkIncludingBlackCount = results.filter(
  (result) => result.appearance === "dark" || result.mostlyBlack,
).length;

if (!dryRun) {
  const resultsById = new Map(results.map((result) => [result.id, result]));

  for (const theme of themes) {
    const result = resultsById.get(theme.id);
    if (!result) continue;
    theme.appearance = result.appearance;
    theme.blackShare = result.blackShare;
    theme.mostlyBlack = result.mostlyBlack;
    theme.appearanceConfidence = result.appearanceConfidence ?? null;
  }

  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  catalog.themes = themes;
  catalog.appearanceMethod =
    "Estimated from the first theme preview's luminance and near-black pixel share";
  catalog.appearanceClassifiedAt = new Date().toISOString();
  await writeFile(catalogPath, JSON.stringify(catalog));
}

console.log(
  JSON.stringify(
    {
      processed: results.length,
      total: themes.length,
      dryRun,
      counts,
      mostlyBlackCount,
      darkIncludingBlackCount,
      sample: results.slice(0, 8),
    },
    null,
    2,
  ),
);
