/** Runs synchronously in <head> before paint; shared by GUI and terminal. */
(() => {
  const storageKey = 'akira-blog:theme';
  const modes = ['light', 'dark', 'system'];
  const normalize = (value) => modes.includes(value) ? value : 'system';
  const read = () => {
    try { return normalize(localStorage.getItem(storageKey)); }
    catch { return 'system'; }
  };
  const syncControls = () => {
    document.querySelectorAll('[data-theme-control]').forEach((control) => {
      control.value = document.documentElement.dataset.theme;
      control.disabled = false;
    });
  };
  const apply = (value, persist = true) => {
    const theme = normalize(value);
    document.documentElement.dataset.theme = theme;
    if (persist) {
      try { localStorage.setItem(storageKey, theme); } catch { /* Theme still works without storage. */ }
    }
    syncControls();
    document.dispatchEvent(new CustomEvent('blog:theme-change', { detail: theme }));
  };
  window.blogTheme = {
    get: () => normalize(document.documentElement.dataset.theme),
    set: (value) => apply(value),
  };
  apply(read(), false);
  document.addEventListener('DOMContentLoaded', syncControls, { once: true });
  // A delegated listener also works when controls are replaced in a later island.
  document.addEventListener('change', (event) => {
    if (event.target instanceof HTMLSelectElement && event.target.matches('[data-theme-control]')) {
      apply(event.target.value);
    }
  });
  window.addEventListener('pageshow', () => apply(read(), false));
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) apply(read(), false);
  });
})();
