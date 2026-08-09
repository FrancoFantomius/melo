let systemMediaListenerAdded = false;

export function getCurrentTheme() {
  return localStorage.getItem('theme') || 'system';
}

export function getEffectiveTheme() {
  const savedTheme = getCurrentTheme();
  if (savedTheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return savedTheme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const validTheme = (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : 'system';
  localStorage.setItem('theme', validTheme);

  const effectiveTheme = validTheme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : validTheme;

  if (effectiveTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  }

  updateThemeUI();
}

export function toggleTheme() {
  const currentEffective = getEffectiveTheme();
  const nextTheme = currentEffective === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
}

export function updateThemeUI() {
  const iconEl = document.getElementById('theme-toggle-icon');
  const btnEl = document.getElementById('btn-theme-toggle');
  const effectiveTheme = getEffectiveTheme();
  const savedTheme = getCurrentTheme();

  if (iconEl && btnEl) {
    if (effectiveTheme === 'dark') {
      iconEl.textContent = 'light_mode';
      const label = savedTheme === 'system' ? 'Switch to Light mode (System: Dark)' : 'Switch to Light mode';
      btnEl.setAttribute('title', label);
      btnEl.setAttribute('aria-label', label);
    } else {
      iconEl.textContent = 'dark_mode';
      const label = savedTheme === 'system' ? 'Switch to Dark mode (System: Light)' : 'Switch to Dark mode';
      btnEl.setAttribute('title', label);
      btnEl.setAttribute('aria-label', label);
    }
  }

  const selectEl = document.getElementById('setting-theme');
  if (selectEl) {
    selectEl.value = savedTheme;
  }
}

export function initTheme() {
  const savedTheme = getCurrentTheme();
  applyTheme(savedTheme);

  if (!systemMediaListenerAdded) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemThemeChange = () => {
      if (getCurrentTheme() === 'system') {
        applyTheme('system');
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemThemeChange);
    }
    systemMediaListenerAdded = true;
  }
}

