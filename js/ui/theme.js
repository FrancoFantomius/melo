let systemMediaListenerAdded = false;

export function getCurrentTheme() {
  return localStorage.getItem('theme') || 'system';
}

export function getEffectiveTheme() {
  const savedTheme = getCurrentTheme();
  if (savedTheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return savedTheme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const validTheme = (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : 'system';
  localStorage.setItem('theme', validTheme);

  const effectiveTheme = validTheme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : validTheme;

  if (effectiveTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  }

  document.documentElement.setAttribute('data-theme', effectiveTheme);

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', effectiveTheme === 'light' ? '#ffffff' : '#0e1117');
  }

  updateThemeUI();

  window.dispatchEvent(new CustomEvent('melo_theme_changed', {
    detail: { theme: validTheme, effectiveTheme }
  }));
}

export function toggleTheme() {
  const savedTheme = getCurrentTheme();
  const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let nextTheme;
  if (savedTheme === 'system') {
    // If currently on system/device theme, switch to the opposite theme first
    nextTheme = isSystemDark ? 'light' : 'dark';
  } else if (savedTheme === (isSystemDark ? 'light' : 'dark')) {
    // Next switch to the matching explicit theme
    nextTheme = isSystemDark ? 'dark' : 'light';
  } else {
    // Finally switch back to system / device default
    nextTheme = 'system';
  }

  applyTheme(nextTheme);
}

export function updateThemeUI() {
  const iconEl = document.getElementById('theme-toggle-icon');
  const btnEl = document.getElementById('btn-theme-toggle');
  const effectiveTheme = getEffectiveTheme();
  const savedTheme = getCurrentTheme();

  let iconName;
  let label;

  if (savedTheme === 'system') {
    iconName = 'brightness_auto';
    label = `Theme: Device default (${effectiveTheme === 'dark' ? 'Dark' : 'Light'})`;
  } else if (savedTheme === 'light') {
    iconName = 'light_mode';
    label = 'Theme: Light';
  } else {
    iconName = 'dark_mode';
    label = 'Theme: Dark';
  }

  if (btnEl) {
    btnEl.setAttribute('icon', iconName);
    if ('icon' in btnEl) {
      btnEl.icon = iconName;
    }
    btnEl.setAttribute('title', label);
    btnEl.setAttribute('aria-label', label);
  }

  if (iconEl) {
    iconEl.textContent = iconName;
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
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
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


