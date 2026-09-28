import catalog from "../../public/data/themes.json";
import ThemeBrowser, { type Theme } from "../components/ThemeBrowser";

export default function Home() {
  return (
    <ThemeBrowser
      themes={catalog.themes as Theme[]}
      capturedAt={catalog.capturedAt}
    />
  );
}
