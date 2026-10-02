// D61: installable app (PWA). The service worker only provides installability and an offline notice
// (public/sw.js); the install screen is reachable from the menu and by a shareable link (/?install=1).

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPrompt; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
  if ('serviceWorker' in navigator && !import.meta.env.DEV && !/[?&]tg=|tgWebAppData=/.test(location.href)) {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('service worker:', e));
  }
}

export const onInstallChange = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };
export const canPromptInstall = () => !!deferred;
export const isStandalone = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as any).standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const installUrl = () => location.origin + '/?install=1';

/** Shows the browser's own install dialog; false when the browser offers none (then show instructions). */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const d = deferred; deferred = null;
  await d.prompt();
  const r = await d.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  listeners.forEach((f) => f());
  return r.outcome === 'accepted';
}

/** Share or copy a link; returns what happened for the toast. */
export async function shareLink(url: string, title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try { if (navigator.share) { await navigator.share({ url, title, text }); return 'shared'; } } catch (e) { if ((e as Error).name === 'AbortError') return 'failed'; }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { /* fall through */ }
  try {
    const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok ? 'copied' : 'failed';
  } catch { return 'failed'; }
}
