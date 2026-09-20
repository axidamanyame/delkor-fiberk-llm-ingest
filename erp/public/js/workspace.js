/** One live workspace. Fiberkapp uploads are ordinary live rows. */
const KEY = 'df_workspace';

export const WS_LIVE = 'live';
export const WS_ARCHIVE = 'live';

export function getWorkspace() {
  return WS_LIVE;
}

export function setWorkspace() {
  try { localStorage.setItem(KEY, WS_LIVE); } catch { /* ignore */ }
  return WS_LIVE;
}

export function isArchive() {
  return false;
}

export function workspaceHref() {
  return '/dashboard.html';
}
