/* Theme boot — resolves stored → system and sets the class before first paint. */
(function () {
  try {
    var t = localStorage.getItem('saboot_theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    var root = document.documentElement;
    root.classList.add(t);
    root.style.colorScheme = t;
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
