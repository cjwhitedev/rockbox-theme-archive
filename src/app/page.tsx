import catalog from "../../public/data/themes.json";
import deviceData from "../../public/data/devices.json";
import ThemeBrowser, { type Theme } from "../components/ThemeBrowser";

export default function Home() {
  return (
    <ThemeBrowser
      themes={catalog.themes as Theme[]}
      devices={deviceData.devices}
      capturedAt={catalog.capturedAt}
    />
  );
}
