"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type Theme = {
  id: number;
  name: string;
  submitter: string;
  submittedAt: string;
  downloads: number;
  votes: number;
  rating: number;
  sizeLabel: string;
  sizeBytes: number;
  lcd: string;
  width: number;
  height: number;
  description: string;
  worksWithDev: boolean;
  releaseVersions: string[];
  preview: string;
  appearance: "dark" | "light" | "mixed";
  appearanceConfidence: number | null;
  blackShare: number | null;
  mostlyBlack: boolean;
  detailUrl: string;
  downloadUrl: string;
};

type ThemeBrowserProps = {
  themes: Theme[];
  capturedAt: string;
};

type SortOption = "newest" | "downloads" | "rating" | "name" | "smallest";

const numberFormat = new Intl.NumberFormat("en");
const pageSize = 30;
const appearanceLabels = {
  dark: "Mostly dark",
  light: "Mostly light",
  mixed: "Unidentified",
} as const;
const colorModeChangeEvent = "rockbox-color-mode-change";

function subscribeToColorMode(onChange: () => void) {
  window.addEventListener(colorModeChangeEvent, onChange);
  return () => window.removeEventListener(colorModeChangeEvent, onChange);
}

function getDarkModeSnapshot() {
  const preference = window.localStorage.getItem("rockbox-theme-mode");
  return (
    preference === "dark" ||
    (preference === null &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

const aiNoticeKey = "rockbox-ai-notice-dismissed";
const aiNoticeChangeEvent = "rockbox-ai-notice-change";

function subscribeToAiNotice(onChange: () => void) {
  window.addEventListener(aiNoticeChangeEvent, onChange);
  return () => window.removeEventListener(aiNoticeChangeEvent, onChange);
}

function getAiNoticeDismissedSnapshot() {
  return window.localStorage.getItem(aiNoticeKey) === "true";
}

const filterDefaults = {
  q: "",
  lcd: "all",
  firmware: "all",
  rating: "0",
  size: "all",
  shape: "all",
  palette: "all",
  sort: "newest",
};
type FilterParam = keyof typeof filterDefaults;
const filterParams = Object.keys(filterDefaults) as FilterParam[];
const filterParamOptions: Partial<Record<FilterParam, readonly string[]>> = {
  firmware: ["all", "current", "release"],
  rating: ["0", "3", "4", "5"],
  size: ["all", "small", "large"],
  shape: ["all", "portrait", "landscape", "square"],
  palette: ["all", "dark", "black", "light", "mixed"],
  sort: ["newest", "downloads", "rating", "name", "smallest"],
};
const filterParamsChangeEvent = "rockbox-filter-params-change";

function subscribeToFilterParams(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(filterParamsChangeEvent, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(filterParamsChangeEvent, onChange);
  };
}

function getFilterParamsSnapshot() {
  return window.location.search;
}

function writeFilterParams(changes: Partial<Record<FilterParam, string>>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes) as [FilterParam, string][]) {
    if (value === filterDefaults[key]) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
  window.dispatchEvent(new Event(filterParamsChangeEvent));
}

function ThemeCard({
  theme,
  eagerPreview,
}: {
  theme: Theme;
  eagerPreview: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const status = theme.worksWithDev
    ? "CURRENT BUILD"
    : theme.releaseVersions.length > 0
      ? "RELEASE BUILD"
      : "UNVERIFIED";

  return (
    <article className="theme-card">
      <div className="theme-preview">
        <span className="preview-tag">LCD {theme.lcd}</span>
        {theme.preview && !imageFailed ? (
          <Image
            alt={`${theme.name} theme preview`}
            className="theme-preview-image"
            height={theme.height || 240}
            loading={eagerPreview ? "eager" : "lazy"}
            onError={() => setImageFailed(true)}
            src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/previews/${theme.id}.webp`}
            unoptimized
            width={theme.width || 320}
          />
        ) : (
          <span aria-hidden="true" className="preview-empty">
            RB
          </span>
        )}
      </div>
      <div className="theme-card-body">
        <div className="theme-card-topline">
          <span
            className={`theme-status${theme.worksWithDev ? "" : " theme-status--legacy"}`}
          >
            {status}
          </span>
          <span className="mono-label">#{theme.id}</span>
        </div>
        <h2 title={theme.name}>{theme.name}</h2>
        <p className="theme-author">by {theme.submitter || "Unknown author"}</p>
        <p className="theme-description">
          {theme.description || "No description provided."}
        </p>
        <div className="theme-metrics">
          <span
            className={`appearance-pill appearance-pill--${theme.mostlyBlack ? "black" : theme.appearance}`}
            title={
              theme.mostlyBlack
                ? `At least 55% near-black pixels in the first preview (${Math.round((theme.blackShare ?? 0) * 100)}%)`
                : `Estimated from the first preview image (${theme.appearanceConfidence === null ? "confidence unavailable" : `${Math.round(theme.appearanceConfidence * 100)}% confidence`})`
            }
          >
            {theme.mostlyBlack
              ? "Mostly black"
              : appearanceLabels[theme.appearance]}
          </span>
          <span>
            {theme.rating > 0 ? `${theme.rating}/5 rating` : "Not rated"}
            {theme.votes > 0 ? ` · ${numberFormat.format(theme.votes)}` : ""}
          </span>
          <span>{numberFormat.format(theme.downloads)} downloads</span>
          <span>{theme.sizeLabel || "Size unknown"}</span>
        </div>
        <div className="theme-actions">
          <a
            className="theme-detail-link"
            href={theme.detailUrl}
            rel="noreferrer"
            target="_blank"
          >
            Details <span aria-hidden="true">↗</span>
          </a>
          <a className="download-link" href={theme.downloadUrl}>
            Download
          </a>
        </div>
      </div>
    </article>
  );
}

export default function ThemeBrowser({
  themes,
  capturedAt,
}: ThemeBrowserProps) {
  const darkMode = useSyncExternalStore(
    subscribeToColorMode,
    getDarkModeSnapshot,
    () => false,
  );
  const aiNoticeDismissed = useSyncExternalStore(
    subscribeToAiNotice,
    getAiNoticeDismissedSnapshot,
    () => false,
  );
  const queryString = useSyncExternalStore(
    subscribeToFilterParams,
    getFilterParamsSnapshot,
    () => "",
  );
  const resolutions = [...new Set(themes.map((theme) => theme.lcd))].sort((left, right) => {
    const [leftWidth, leftHeight] = left.split("x").map(Number);
    const [rightWidth, rightHeight] = right.split("x").map(Number);
    return leftWidth * leftHeight - rightWidth * rightHeight;
  });
  const urlParams = new URLSearchParams(queryString);
  const readParam = (key: FilterParam) => {
    const value = urlParams.get(key);
    const allowed = key === "lcd" ? resolutions : filterParamOptions[key];
    if (value === null || (allowed && !allowed.includes(value))) {
      return filterDefaults[key];
    }
    return value;
  };
  const search = readParam("q");
  const deferredSearch = useDeferredValue(search);
  const resolution = readParam("lcd");
  const compatibility = readParam("firmware");
  const minimumRating = readParam("rating");
  const packageSize = readParam("size");
  const orientation = readParam("shape");
  const appearance = readParam("palette") as "all" | "black" | Theme["appearance"];
  const sortBy = readParam("sort") as SortOption;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [shareStatus, setShareStatus] = useState("");
  const shareStatusTimer = useRef<number | undefined>(undefined);

  const updateFilters = (changes: Partial<Record<FilterParam, string>>) => {
    writeFilterParams(changes);
    setVisibleCount(pageSize);
  };
  const hasFilterParams = filterParams.some((key) => urlParams.has(key));

  const shareLink = async (includeFilters: boolean) => {
    const url = new URL(window.location.pathname, window.location.origin);
    if (includeFilters) {
      for (const key of filterParams) {
        const value = urlParams.get(key);
        if (value !== null) url.searchParams.set(key, value);
      }
    }
    const link = url.toString();

    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setShareStatus(includeFilters ? "Link with filters copied" : "Link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Couldn't share this link");
    }
    window.clearTimeout(shareStatusTimer.current);
    shareStatusTimer.current = window.setTimeout(() => setShareStatus(""), 2500);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  const toggleDarkMode = () => {
    const nextMode = !darkMode;
    window.localStorage.setItem("rockbox-theme-mode", nextMode ? "dark" : "light");
    document.documentElement.dataset.theme = nextMode ? "dark" : "light";
    window.dispatchEvent(new Event(colorModeChangeEvent));
  };

  const dismissAiNotice = () => {
    window.localStorage.setItem(aiNoticeKey, "true");
    window.dispatchEvent(new Event(aiNoticeChangeEvent));
  };

  const searchTerm = deferredSearch.trim().toLocaleLowerCase();
  type FilterDimension =
    | "search"
    | "resolution"
    | "compatibility"
    | "rating"
    | "size"
    | "orientation"
    | "appearance";
  const screenShape = (theme: Theme) =>
    theme.width === theme.height
      ? "square"
      : theme.width > theme.height
        ? "landscape"
        : "portrait";
  const matchesTheme = (theme: Theme, omitted?: FilterDimension) => {
    const matchesSearch =
      omitted === "search" ||
      !searchTerm ||
      `${theme.name} ${theme.submitter} ${theme.description}`
        .toLocaleLowerCase()
        .includes(searchTerm);
    const matchesResolution =
      omitted === "resolution" || resolution === "all" || theme.lcd === resolution;
    const matchesCompatibility =
      omitted === "compatibility" ||
      compatibility === "all" ||
      (compatibility === "current" && theme.worksWithDev) ||
      (compatibility === "release" && theme.releaseVersions.length > 0);
    const matchesRating =
      omitted === "rating" ||
      (theme.rating >= Number(minimumRating) &&
        (minimumRating === "0" || theme.votes > 0));
    const matchesSize =
      omitted === "size" ||
      packageSize === "all" ||
      (packageSize === "small" && theme.sizeBytes < 100 * 1024) ||
      (packageSize === "large" && theme.sizeBytes >= 100 * 1024);
    const matchesOrientation =
      omitted === "orientation" ||
      orientation === "all" ||
      screenShape(theme) === orientation;
    const matchesAppearance =
      omitted === "appearance" ||
      appearance === "all" ||
      (appearance === "black" && theme.mostlyBlack) ||
      (appearance === "dark" &&
        (theme.appearance === "dark" || theme.mostlyBlack)) ||
      (appearance !== "black" &&
        appearance !== "dark" &&
        theme.appearance === appearance);

    return (
      matchesSearch &&
      matchesResolution &&
      matchesCompatibility &&
      matchesRating &&
      matchesSize &&
      matchesOrientation &&
      matchesAppearance
    );
  };
  const countMatches = (
    omitted: FilterDimension,
    predicate: (theme: Theme) => boolean = () => true,
  ) => themes.filter((theme) => matchesTheme(theme, omitted) && predicate(theme)).length;

  const resolutionCounts = Object.fromEntries(
    resolutions.map((item) => [
      item,
      countMatches("resolution", (theme) => theme.lcd === item),
    ]),
  ) as Record<string, number>;
  const allResolutionCount = countMatches("resolution");
  const compatibilityCounts = {
    all: countMatches("compatibility"),
    current: countMatches("compatibility", (theme) => theme.worksWithDev),
    release: countMatches(
      "compatibility",
      (theme) => theme.releaseVersions.length > 0,
    ),
  };
  const ratingCounts = {
    all: countMatches("rating"),
    three: countMatches(
      "rating",
      (theme) => theme.rating >= 3 && theme.votes > 0,
    ),
    four: countMatches(
      "rating",
      (theme) => theme.rating >= 4 && theme.votes > 0,
    ),
    five: countMatches(
      "rating",
      (theme) => theme.rating >= 5 && theme.votes > 0,
    ),
  };
  const sizeCounts = {
    all: countMatches("size"),
    small: countMatches("size", (theme) => theme.sizeBytes < 100 * 1024),
    large: countMatches("size", (theme) => theme.sizeBytes >= 100 * 1024),
  };
  const orientationCounts = {
    all: countMatches("orientation"),
    portrait: countMatches("orientation", (theme) => screenShape(theme) === "portrait"),
    landscape: countMatches("orientation", (theme) => screenShape(theme) === "landscape"),
    square: countMatches("orientation", (theme) => screenShape(theme) === "square"),
  };
  const appearanceCounts = {
    all: countMatches("appearance"),
    dark: countMatches(
      "appearance",
      (theme) => theme.appearance === "dark" || theme.mostlyBlack,
    ),
    black: countMatches("appearance", (theme) => theme.mostlyBlack),
    light: countMatches("appearance", (theme) => theme.appearance === "light"),
    mixed: countMatches("appearance", (theme) => theme.appearance === "mixed"),
  };
  const filteredThemes = themes.filter((theme) => matchesTheme(theme));

  filteredThemes.sort((left, right) => {
    if (sortBy === "downloads") return right.downloads - left.downloads;
    if (sortBy === "rating") {
      return right.rating - left.rating || right.votes - left.votes;
    }
    if (sortBy === "name") return left.name.localeCompare(right.name);
    if (sortBy === "smallest") return left.sizeBytes - right.sizeBytes;
    return right.submittedAt.localeCompare(left.submittedAt);
  });

  const clearFilters = () => updateFilters(filterDefaults);

  const activeFilters: Array<{
    key: string;
    label: string;
    clear: () => void;
  }> = [];
  if (search.trim()) {
    activeFilters.push({
      key: "search",
      label: `Search: ${search.trim()}`,
      clear: () => updateFilters({ q: "" }),
    });
  }
  if (resolution !== "all") {
    activeFilters.push({
      key: "resolution",
      label: `LCD: ${resolution}`,
      clear: () => updateFilters({ lcd: "all" }),
    });
  }
  if (compatibility !== "all") {
    activeFilters.push({
      key: "compatibility",
      label: compatibility === "current" ? "Current build" : "Release build",
      clear: () => updateFilters({ firmware: "all" }),
    });
  }
  if (minimumRating !== "0") {
    activeFilters.push({
      key: "rating",
      label: `Rating: ${minimumRating}+ stars`,
      clear: () => updateFilters({ rating: "0" }),
    });
  }
  if (packageSize !== "all") {
    activeFilters.push({
      key: "size",
      label: packageSize === "small" ? "Under 100 KB" : "100 KB or more",
      clear: () => updateFilters({ size: "all" }),
    });
  }
  if (orientation !== "all") {
    activeFilters.push({
      key: "orientation",
      label: `Screen: ${orientation}`,
      clear: () => updateFilters({ shape: "all" }),
    });
  }
  if (appearance !== "all") {
    const appearanceLabel =
      appearance === "black" ? "Mostly black" : appearanceLabels[appearance];
    activeFilters.push({
      key: "appearance",
      label: `Palette: ${appearanceLabel}`,
      clear: () => updateFilters({ palette: "all" }),
    });
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <Link
          aria-label="Rockbox Theme Library home"
          className="brand-lockup"
          href="/"
          onClick={clearFilters}
        >
          <span aria-hidden="true" className="brand-mark">
            <span className="brand-wordmark">Rockbox</span>
            <span className="brand-tagline">OPEN SOURCE JUKEBOX</span>
          </span>
          <span>
            THEME ARCHIVE
            <span className="brand-subtitle">Community Theme Library</span>
          </span>
        </Link>
        <div className="topbar-actions">
          <button
            aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
            aria-pressed={darkMode}
            className="mode-toggle"
            onClick={toggleDarkMode}
            type="button"
          >
            <span aria-hidden="true" className="mode-toggle-track">
              <span className="mode-toggle-thumb" />
            </span>
            <span>{darkMode ? "Dark" : "Light"} mode</span>
          </button>
          <a
            className="topbar-link"
            href="https://themes.rockbox.org/index.php?allthemes"
            rel="noreferrer"
            target="_blank"
          >
            Original archive <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      {!aiNoticeDismissed && (
        <aside aria-label="AI disclosure" className="ai-notice">
          <strong className="ai-notice-label">Built with AI</strong>
          <p>
            This site was written almost entirely by GitHub Copilot, an AI
            coding agent. It&apos;s unofficial and may contain mistakes.{" "}
            <a
              href="https://github.com/cjwhitedev/rockbox-theme-archive"
              rel="noreferrer"
              target="_blank"
            >
              View the source on GitHub <span aria-hidden="true">↗</span>
            </a>
          </p>
          <button
            aria-label="Dismiss AI notice"
            className="ai-notice-dismiss"
            onClick={dismissAiNotice}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </aside>
      )}

      <section aria-labelledby="page-title" className="intro">
        <div>
          <div className="eyebrow">ROCKBOX / COMMUNITY THEME ARCHIVE</div>
          <h1 id="page-title">
            Rockbox <span>themes</span>
          </h1>
        </div>
        <div aria-label="Catalog summary" className="intro-stats">
          <div className="intro-stat">
            <strong>{numberFormat.format(themes.length)}</strong>
            <span>themes</span>
          </div>
          <div className="intro-stat">
            <strong>{resolutions.length}</strong>
            <span>LCD sizes</span>
          </div>
          <div className="intro-stat">
            <strong>
              {numberFormat.format(
                themes.filter((theme) => theme.worksWithDev).length,
              )}
            </strong>
            <span>current builds</span>
          </div>
        </div>
      </section>

      <main className="catalog-layout">
        <aside aria-label="Theme filters" className="filter-panel">
          <div className="filter-heading">
            <h2>Filter themes</h2>
            <button className="text-button" onClick={clearFilters} type="button">
              Clear all
            </button>
          </div>
          <div className="filter-content">
            <section className="filter-section">
              <label className="filter-section-label" htmlFor="resolution">
                LCD resolution
              </label>
              <select
                className="filter-select"
                id="resolution"
                onChange={(event) => updateFilters({ lcd: event.target.value })}
                value={resolution}
              >
                <option value="all">
                  All screens ({numberFormat.format(allResolutionCount)})
                </option>
                {resolutions.map((item) => (
                  <option key={item} value={item}>
                    {item} ({numberFormat.format(resolutionCounts[item])})
                  </option>
                ))}
              </select>
            </section>

            <section className="filter-section">
              <label className="filter-section-label" htmlFor="compatibility">
                Firmware support
              </label>
              <select
                className="filter-select"
                id="compatibility"
                onChange={(event) =>
                  updateFilters({ firmware: event.target.value })
                }
                value={compatibility}
              >
                <option value="all">
                  Any compatibility ({numberFormat.format(compatibilityCounts.all)})
                </option>
                <option value="current">
                  Current dev build ({numberFormat.format(compatibilityCounts.current)})
                </option>
                <option value="release">
                  Release build ({numberFormat.format(compatibilityCounts.release)})
                </option>
              </select>
            </section>

            <section className="filter-section">
              <label className="filter-section-label" htmlFor="minimum-rating">
                Community rating
              </label>
              <select
                className="filter-select"
                id="minimum-rating"
                onChange={(event) => updateFilters({ rating: event.target.value })}
                value={minimumRating}
              >
                <option value="0">
                  Any rating ({numberFormat.format(ratingCounts.all)})
                </option>
                <option value="3">
                  3 stars and up ({numberFormat.format(ratingCounts.three)})
                </option>
                <option value="4">
                  4 stars and up ({numberFormat.format(ratingCounts.four)})
                </option>
                <option value="5">
                  5 stars ({numberFormat.format(ratingCounts.five)})
                </option>
              </select>
            </section>

            <section className="filter-section">
              <label className="filter-section-label" htmlFor="package-size">
                Download size
              </label>
              <select
                className="filter-select"
                id="package-size"
                onChange={(event) => updateFilters({ size: event.target.value })}
                value={packageSize}
              >
                <option value="all">
                  Any package size ({numberFormat.format(sizeCounts.all)})
                </option>
                <option value="small">
                  Under 100 KB ({numberFormat.format(sizeCounts.small)})
                </option>
                <option value="large">
                  100 KB or more ({numberFormat.format(sizeCounts.large)})
                </option>
              </select>
            </section>

            <section className="filter-section">
              <label className="filter-section-label" htmlFor="orientation">
                Screen shape
              </label>
              <select
                className="filter-select"
                id="orientation"
                onChange={(event) => updateFilters({ shape: event.target.value })}
                value={orientation}
              >
                <option value="all">
                  Any orientation ({numberFormat.format(orientationCounts.all)})
                </option>
                <option value="portrait">
                  Portrait ({numberFormat.format(orientationCounts.portrait)})
                </option>
                <option value="landscape">
                  Landscape ({numberFormat.format(orientationCounts.landscape)})
                </option>
                <option value="square">
                  Square ({numberFormat.format(orientationCounts.square)})
                </option>
              </select>
            </section>

            <section className="filter-section">
              <label className="filter-section-label" htmlFor="appearance">
                Preview appearance
              </label>
              <select
                className="filter-select"
                id="appearance"
                onChange={(event) => updateFilters({ palette: event.target.value })}
                value={appearance}
              >
                <option value="all">
                  Any appearance ({numberFormat.format(appearanceCounts.all)})
                </option>
                <option value="dark">
                  Mostly dark ({numberFormat.format(appearanceCounts.dark)})
                </option>
                <option value="black">
                  Mostly black ({numberFormat.format(appearanceCounts.black)})
                </option>
                <option value="light">
                  Mostly light ({numberFormat.format(appearanceCounts.light)})
                </option>
                <option value="mixed">
                  Unidentified ({numberFormat.format(appearanceCounts.mixed)})
                </option>
              </select>
              <p className="filter-note">
                Palette labels are a best guess from one preview, not verified
                theme behavior. Mostly black means 55% or more near-black pixels.
              </p>
            </section>
          </div>
        </aside>

        <section aria-label="Theme results" className="catalog-main">
          <div className="catalog-toolbar">
            <div className="search-wrap">
              <label htmlFor="theme-search">Search archive</label>
              <input
                autoComplete="off"
                className="search-input"
                id="theme-search"
                onChange={(event) => updateFilters({ q: event.target.value })}
                placeholder="Theme, author, or description"
                type="search"
                value={search}
              />
            </div>
            <div className="sort-wrap">
              <label htmlFor="sort-themes">Sort by</label>
              <select
                className="sort-select"
                id="sort-themes"
                onChange={(event) => updateFilters({ sort: event.target.value })}
                value={sortBy}
              >
                <option value="newest">Recently added</option>
                <option value="downloads">Most downloaded</option>
                <option value="rating">Top rated</option>
                <option value="name">Name A to Z</option>
                <option value="smallest">Smallest download</option>
              </select>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div aria-label="Active filters" className="active-filters">
              {activeFilters.map((filter) => (
                <button
                  aria-label={`Remove ${filter.label} filter`}
                  className="filter-chip"
                  key={filter.key}
                  onClick={filter.clear}
                  type="button"
                >
                  <span>{filter.label}</span>
                  <span aria-hidden="true" className="filter-chip-remove">
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}

          <div aria-live="polite" className="result-bar">
            <span className="result-count">
              {numberFormat.format(filteredThemes.length)} themes found
            </span>
            <div className="share-actions">
              <span className="share-status" role="status">
                {shareStatus}
              </span>
              <button
                className="share-button"
                disabled={!hasFilterParams}
                onClick={() => shareLink(true)}
                title={
                  hasFilterParams
                    ? "Share a link that keeps your current filters and sort"
                    : "Choose a filter or sort to share it"
                }
                type="button"
              >
                Share with filters
              </button>
              <button
                className="share-button"
                onClick={() => shareLink(false)}
                title="Share a link to the full archive"
                type="button"
              >
                Share page
              </button>
            </div>
            <span className="result-meta">
              CATALOG SNAPSHOT {capturedAt.slice(0, 10)}
            </span>
          </div>

          {filteredThemes.length > 0 ? (
            <>
              <div className="theme-grid">
                {filteredThemes.slice(0, visibleCount).map((theme, index) => (
                  <ThemeCard
                    eagerPreview={index < 6}
                    key={theme.id}
                    theme={theme}
                  />
                ))}
              </div>
              {visibleCount < filteredThemes.length && (
                <div className="load-more-wrap">
                  <button
                    className="load-more"
                    onClick={() => setVisibleCount((count) => count + pageSize)}
                    type="button"
                  >
                    Show more themes
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div>
                <h2>No themes match those filters.</h2>
                <p>Try a different screen size or clear your filters.</p>
                <button
                  className="clear-empty"
                  onClick={clearFilters}
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <span>
          Built with AI: written by GitHub Copilot. Unofficial and may contain
          mistakes.
        </span>
        <span>Theme metadata and images belong to their original creators.</span>
        <span>
          Data from{" "}
          <a
            href="https://themes.rockbox.org/index.php?allthemes"
            rel="noreferrer"
            target="_blank"
          >
            themes.rockbox.org
          </a>
          {" · "}
          <a
            href="https://github.com/cjwhitedev/rockbox-theme-archive"
            rel="noreferrer"
            target="_blank"
          >
            Source on GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}
