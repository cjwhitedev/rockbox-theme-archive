import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const origin = "https://themes.rockbox.org";
const devicesPath = fileURLToPath(
  new URL("../public/data/devices.json", import.meta.url),
);

async function readExisting() {
  try {
    return JSON.parse(await readFile(devicesPath, "utf8")).devices;
  } catch {
    return [];
  }
}

// Rockbox Utility's endpoint lists only the themes that pass Rockbox's checks for this device.
async function fetchThemeIds(deviceId) {
  try {
    const response = await fetch(
      `${origin}/rbutilqt.php?target=${encodeURIComponent(deviceId)}`,
      { signal: AbortSignal.timeout(60000) },
    );
    if (!response.ok) return null;

    const text = await response.text();
    if (!/^\[error\]\s*code=0/m.test(text)) return null;
    return [...text.matchAll(/^archive="[^"]*themeid=(\d+)"/gm)]
      .map(([, id]) => Number(id))
      .sort((left, right) => left - right);
  } catch {
    return null;
  }
}

const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Front page request failed: HTTP ${response.status}`);

const listed = [
  ...(await response.text()).matchAll(
    /href="[^"]*\?target=([^"&]+)" title="([^"]*)"[\s\S]*?<small>(\d+) themes?<\/small>/g,
  ),
].map(([, id, name, count]) => ({
  id,
  name: name
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim(),
  count: Number(count),
}));

if (listed.length === 0) throw new Error("No devices found on the front page");

const existing = new Map((await readExisting()).map((device) => [device.id, device]));
const devices = [];
let failed = 0;

for (const { id, name, count } of listed) {
  if (count === 0) continue;

  const themeIds = await fetchThemeIds(id);
  if (themeIds) {
    devices.push({ id, name, themeIds });
  } else {
    failed += 1;
    if (existing.get(id)?.themeIds) devices.push({ ...existing.get(id), name });
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

devices.sort((left, right) => left.name.localeCompare(right.name));
await writeFile(
  devicesPath,
  JSON.stringify({ source: `${origin}/`, capturedAt: new Date().toISOString(), devices }),
);

console.log(JSON.stringify({ listed: listed.length, saved: devices.length, failed }));
