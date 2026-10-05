export {};

const mobileSidebarQuery = window.matchMedia('(max-width: 48rem)');
const root = document.documentElement;
const sidebar = document.querySelector<HTMLElement>('[data-sidebar]');
const opener = document.querySelector<HTMLButtonElement>('[data-sidebar-open]');
const closeButton = sidebar?.querySelector<HTMLButtonElement>('[data-sidebar-close]');
const desktopToggle = sidebar?.querySelector<HTMLButtonElement>('[data-sidebar-toggle]');
const backdrop = document.querySelector<HTMLButtonElement>('[data-sidebar-backdrop]');

let lastOpener: HTMLButtonElement | null = null;

function isOpen() {
  return mobileSidebarQuery.matches && root.dataset.sidebarState === 'open';
}

function synchronizeControls(open: boolean) {
  opener?.setAttribute('aria-expanded', String(open));
  opener?.setAttribute('aria-label', open ? '关闭文件导航' : '打开文件导航');
}

function synchronizeSidebar(open: boolean) {
  if (!sidebar) return;

  if (mobileSidebarQuery.matches) {
    sidebar.inert = !open;
    if (open) sidebar.removeAttribute('aria-hidden');
    else sidebar.setAttribute('aria-hidden', 'true');
  } else {
    sidebar.inert = false;
    sidebar.removeAttribute('aria-hidden');
  }
}

function closeDrawer(restoreFocus = true) {
  if (!mobileSidebarQuery.matches) return;

  const wasOpen = isOpen();
  delete root.dataset.sidebarState;
  synchronizeControls(false);
  synchronizeSidebar(false);

  if (restoreFocus && wasOpen) {
    (lastOpener ?? opener)?.focus();
  }
}

function openDrawer(trigger: HTMLButtonElement) {
  if (!mobileSidebarQuery.matches || !sidebar) return;

  lastOpener = trigger;
  root.dataset.sidebarState = 'open';
  synchronizeControls(true);
  synchronizeSidebar(true);
  requestAnimationFrame(() => closeButton?.focus());
}

function synchronizeViewport() {
  const focusWasInSidebar = sidebar?.contains(document.activeElement) ?? false;
  delete root.dataset.sidebarState;
  lastOpener = null;
  synchronizeControls(false);
  synchronizeSidebar(false);

  if (focusWasInSidebar) {
    if (mobileSidebarQuery.matches) opener?.focus();
    else desktopToggle?.focus();
  }
}

opener?.addEventListener('click', () => {
  if (isOpen()) closeDrawer();
  else openDrawer(opener);
});

closeButton?.addEventListener('click', () => closeDrawer());
backdrop?.addEventListener('click', () => closeDrawer());

sidebar?.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('a[href]')) {
    closeDrawer();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isOpen()) {
    event.preventDefault();
    closeDrawer();
  }
});

mobileSidebarQuery.addEventListener('change', synchronizeViewport);
window.addEventListener('pageshow', synchronizeViewport);
synchronizeViewport();
