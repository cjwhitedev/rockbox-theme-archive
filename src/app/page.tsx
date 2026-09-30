import catalog from "../../public/data/themes.json";
import deviceData from "../../public/data/devices.json";
import touchData from "../../public/data/touch.json";
import ThemeBrowser, { type Theme } from "../components/ThemeBrowser";

const touchResults: Record<string, boolean | string> = touchData.themes;

export default function Home() {
  const themes = (catalog.themes as Omit<Theme, "touch">[]).map((theme): Theme => {
    const result = touchResults[theme.id];
    return {
      ...theme,
      touch:
        typeof result === "boolean" || result === "unavailable" ? result : null,
    };
  });

  return (
    <ThemeBrowser
      themes={themes}
      devices={deviceData.devices}
      capturedAt={catalog.capturedAt}
    />
  );
}
