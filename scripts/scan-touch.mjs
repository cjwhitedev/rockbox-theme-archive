import { execFile } from "node:child_process";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const origin = "https://themes.rockbox.org";
const catalogPath = fileURLToPath(
  new URL("../public/data/themes.json", import.meta.url),
);
const touchPath = fileURLToPath(new URL("../public/data/touch.json", import.meta.url));
const limitArgument = process.argv.find((argument) =>
  argument.startsWith("--limit="),
);
const limit = limitArgument ? Number(limitArgument.slice(8)) : Infinity;
const retryUnavailable = process.argv.includes("--retry-unavailable");
const unavailable = "unavailable";
const skinPatterns = ["*.wps", "*.rwps", "*.sbs", "*.rsbs", "*.fms", "*.rfms"];
// %T( defines a touch region and %Tl reacts to touches; %Tp only checks whether a touchscreen exists.
const touchTag = /%T[(l]/;

async function readResults() {
  try {
    return JSON.parse(await readFile(touchPath, "utf8")).themes;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    // Starting over here would re-download every theme, so stop instead.
    throw new Error(`Couldn't read ${touchPath}: ${error.message}. Fix or restore it before scanning.`);
  }
}

async function saveResults(results) {
  const tempPath = `${touchPath}.tmp`;
  await writeFile(
    tempPath,
    JSON.stringify({
      source: `${origin}/download.php`,
      method: "Theme skin files (.wps, .sbs, .fms) scanned for touch region tags",
      values: "true = touch controls, false = none, unavailable = Rockbox download link returns 404",
      updatedAt: new Date().toISOString(),
      themes: results,
    }),
  );
  await rename(tempPath, touchPath);
}

function stripComments(skin) {
  return skin.replace(/(^|[^%])#.*$/gm, "$1");
}

// Returns true, false, or "unavailable"; throws with a reason for failures worth retrying.
async function hasTouchControls(themeId, workDir) {
  const response = await fetch(`${origin}/download.php?themeid=${themeId}`, {
    signal: AbortSignal.timeout(120000),
  });
  if (response.status === 404) return unavailable;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const archive = Buffer.from(await response.arrayBuffer());
  if (archive.subarray(0, 2).toString("latin1") !== "PK") {
    throw new Error(`not a zip (${response.headers.get("content-type")})`);
  }

  const zipPath = join(workDir, `${themeId}.zip`);
  await writeFile(zipPath, archive);
  try {
    const { stdout } = await run("unzip", ["-p", "-C", zipPath, ...skinPatterns], {
      encoding: "latin1",
      maxBuffer: 50 * 1024 * 1024,
    });
    return touchTag.test(stripComments(stdout));
  } catch (error) {
    // unzip exits with 11 when any pattern has no match, but still extracts the others.
    if (error.code === 11) return touchTag.test(stripComments(error.stdout ?? ""));
    throw new Error(`unzip failed: ${String(error.stderr ?? error.message).trim().slice(0, 200)}`);
  } finally {
    await rm(zipPath, { force: true });
  }
}

const { themes } = JSON.parse(await readFile(catalogPath, "utf8"));
const results = await readResults();
const pending = themes
  .filter((theme) => {
    const result = results[theme.id];
    return result === undefined || (retryUnavailable && result === unavailable);
  })
  .slice(0, limit);

console.log(
  `${Object.keys(results).length} themes already scanned, ${pending.length} to download`,
);

if (pending.length > 0) {
  const workDir = await mkdtemp(join(tmpdir(), "rockbox-touch-"));
  let scanned = 0;
  let failed = 0;

  try {
    for (const theme of pending) {
      try {
        results[theme.id] = await hasTouchControls(theme.id, workDir);
        await saveResults(results);
        if (results[theme.id] === unavailable) {
          console.log(`Unavailable on Rockbox ${theme.id} (${theme.name}): download returns 404`);
        }
      } catch (error) {
        failed += 1;
        console.log(`Failed ${theme.id} (${theme.name}): ${error.message}`);
      }

      scanned += 1;
      if (scanned % 25 === 0) {
        console.log(`${scanned}/${pending.length} downloaded, ${failed} failed`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  const values = Object.values(results);
  console.log(
    JSON.stringify({
      scanned,
      failed,
      totalScanned: values.length,
      touch: values.filter((value) => value === true).length,
      unavailable: values.filter((value) => value === unavailable).length,
    }),
  );
}
