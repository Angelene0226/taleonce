(() => {
  const drawer = document.querySelector('#drawer');
  const backdrop = document.querySelector('#drawerBackdrop');
  const menu = document.querySelector('#menuButton');
  const close = document.querySelector('#drawerClose');
  const setOpen = (open) => {
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    menu.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
  };
  menu.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  document.querySelector('#themeButton').addEventListener('click', () => document.body.classList.toggle('dark'));
  document.querySelector('#fontButton').addEventListener('click', () => {
    const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--story-font-size'), 10) || 20;
    document.documentElement.style.setProperty('--story-font-size', `${current >= 24 ? 18 : current + 2}px`);
  });
})();
