/**
 * Loads the fully-vendored MapLibre GL (public/vendor/: main + shared chunk +
 * worker + css) with zero npm-install dependency on the host platform, via an
 * injected <script type="module"> — the browser fetches the file directly, so
 * neither Vite dev (which rejects /public JS imports) nor the production
 * bundler ever touches it. Version-locked: recopy all four files when
 * upgrading maplibre-gl.
 */
export function loadMaplibre(): Promise<any> {
  const w = window as any;
  if (w.__maplibrePromise) return w.__maplibrePromise;

  if (!document.querySelector("link[data-maplibre-css]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/vendor/maplibre-gl.css";
    link.setAttribute("data-maplibre-css", "");
    document.head.appendChild(link);
  }

  w.__maplibrePromise = new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("maplibre vendor load timed out")),
      20000,
    );
    window.addEventListener(
      "__maplibre-ready",
      () => {
        window.clearTimeout(timer);
        const mod = w.__maplibre;
        mod.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
        resolve(mod);
      },
      { once: true },
    );
    const s = document.createElement("script");
    s.type = "module";
    s.textContent =
      'import * as m from "/vendor/maplibre-gl.mjs"; window.__maplibre = m; window.dispatchEvent(new Event("__maplibre-ready"));';
    document.head.appendChild(s);
  });
  return w.__maplibrePromise;
}
