// Stale-build protection (D56). A cached old page (browser, Telegram WebView, proxy) notices the
// deployed build differs and reloads once with a cache-busting query.
declare const __BUILD__: string;
export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';

/** `url?v=<build>` for files that are not content-hashed (atlases, maps, data). */
export const v = (url: string) => url + (url.includes('?') ? '&' : '?') + 'v=' + BUILD;

/** Returns true when a reload was started. Never loops: one attempt per deployed build per tab. */
export async function reloadIfOutdated(): Promise<boolean> {
  if (import.meta.env.DEV) return false;
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return false;
    const { build } = await r.json() as { build?: string };
    if (!build || build === BUILD) return false;
    const key = 'chkn-reload-' + build;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    const url = new URL(location.href);
    url.searchParams.set('v', build);
    location.replace(url.toString());
    return true;
  } catch { return false; }
}
