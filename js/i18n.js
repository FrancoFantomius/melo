const SUPPORTED_LANGUAGES = {
  en: 'English',
  it: 'Italiano',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  zh: '中文',
  ja: '日本語'
};

let currentLanguageMode = 'auto'; // 'auto' or explicit lang code like 'it', 'en'
let activeLanguageCode = 'en';    // Resolved code being used ('en', 'it', etc.)
let translations = {};
let translationObserver = null;

export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

export function getCurrentLanguageMode() {
  return currentLanguageMode;
}

export function getActiveLanguageCode() {
  return activeLanguageCode;
}

export function getBrowserLanguage() {
  const navLang = (navigator.language || navigator.userLanguage || 'en').split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES[navLang] ? navLang : 'en';
}

export function getTranslation(englishText, defaultText = '') {
  if (!englishText) return defaultText || '';
  if (translations && typeof translations === 'object' && englishText in translations) {
    return translations[englishText];
  }
  if (defaultText && translations && typeof translations === 'object' && defaultText in translations) {
    return translations[defaultText];
  }
  return defaultText || englishText;
}

export async function setLanguage(langMode) {
  let targetCode = langMode;

  if (langMode === 'auto' || !langMode) {
    currentLanguageMode = 'auto';
    targetCode = getBrowserLanguage();
  } else if (SUPPORTED_LANGUAGES[langMode]) {
    currentLanguageMode = langMode;
    targetCode = langMode;
  } else {
    currentLanguageMode = 'auto';
    targetCode = 'en';
  }

  try {
    const response = await fetch(`./languages/${targetCode}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load language file: ${targetCode}.json`);
    }
    translations = await response.json();
    activeLanguageCode = targetCode;
  } catch (err) {
    console.warn(`[i18n] Fallback to English due to error loading ${targetCode}:`, err);
    if (targetCode !== 'en') {
      return setLanguage('en');
    }
  }

  localStorage.setItem('melo_language', currentLanguageMode);
  document.documentElement.lang = activeLanguageCode;
  applyTranslations();
  startTranslationObserver();
  window.dispatchEvent(new CustomEvent('melo_language_changed', { detail: { mode: currentLanguageMode, lang: activeLanguageCode } }));
}

// Dynamically rendered views (switchView, async content updates, modals) insert
// new DOM with data-i18n attributes after the initial page translation. Watch
// for inserted elements and translate them so SPA navigation keeps working.
function startTranslationObserver() {
  if (translationObserver || typeof MutationObserver === 'undefined') {
    return;
  }
  translationObserver = new MutationObserver((mutations) => {
    const pendingNodes = [];
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          pendingNodes.push(node);
        }
      }
    }
    if (pendingNodes.length === 0) return;
    requestAnimationFrame(() => {
      for (const node of pendingNodes) {
        if (node.isConnected && (node.querySelector('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-label], [data-i18n-headline], [data-i18n-value]') || node.hasAttribute('data-i18n') || node.hasAttribute('data-i18n-placeholder') || node.hasAttribute('data-i18n-title') || node.hasAttribute('data-i18n-label') || node.hasAttribute('data-i18n-headline') || node.hasAttribute('data-i18n-value'))) {
          applyTranslations(node);
        }
      }
    });
  });
  translationObserver.observe(document.body, { childList: true, subtree: true });
}

export function applyTranslations(container = document) {
  // 1. Text Content with data-i18n
  const textElements = container.querySelectorAll('[data-i18n]');
  textElements.forEach(el => {
    if (!el.dataset.i18nEn) {
      const attrVal = el.getAttribute('data-i18n');
      el.dataset.i18nEn = (attrVal && attrVal !== 'true') ? attrVal : el.textContent.trim();
    }
    const key = el.dataset.i18nEn;
    if (key) {
      const translated = getTranslation(key);
      if (translated) {
        el.textContent = translated;
      }
    }
  });

  // 2. Placeholders with data-i18n-placeholder
  const placeholderElements = container.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach(el => {
    if (!el.dataset.i18nPlaceholderEn) {
      const attrVal = el.getAttribute('data-i18n-placeholder');
      el.dataset.i18nPlaceholderEn = (attrVal && attrVal !== 'true') ? attrVal : el.placeholder;
    }
    const key = el.dataset.i18nPlaceholderEn;
    if (key) {
      const translated = getTranslation(key);
      if (translated) {
        el.placeholder = translated;
      }
    }
  });

  // 3. Titles / Aria-labels with data-i18n-title
  const titleElements = container.querySelectorAll('[data-i18n-title]');
  titleElements.forEach(el => {
    if (!el.dataset.i18nTitleEn) {
      const attrVal = el.getAttribute('data-i18n-title');
      el.dataset.i18nTitleEn = (attrVal && attrVal !== 'true') ? attrVal : el.title;
    }
    const key = el.dataset.i18nTitleEn;
    if (key) {
      const translated = getTranslation(key);
      if (translated) {
        el.title = translated;
        el.setAttribute('aria-label', translated);
      }
    }
  });

  // 4. Custom Element labels with data-i18n-label
  const labelElements = container.querySelectorAll('[data-i18n-label]');
  labelElements.forEach(el => {
    if (!el.dataset.i18nLabelEn) {
      const attrVal = el.getAttribute('data-i18n-label');
      el.dataset.i18nLabelEn = (attrVal && attrVal !== 'true') ? attrVal : (el.getAttribute('label') || '');
    }
    const key = el.dataset.i18nLabelEn;
    if (key) {
      const translated = getTranslation(key);
      if (translated) {
        el.setAttribute('label', translated);
        el.label = translated;
      }
    }
  });

  // 5. Custom Element headlines with data-i18n-headline
  const headlineElements = container.querySelectorAll('[data-i18n-headline]');
  headlineElements.forEach(el => {
    if (!el.dataset.i18nHeadlineEn) {
      const attrVal = el.getAttribute('data-i18n-headline');
      el.dataset.i18nHeadlineEn = (attrVal && attrVal !== 'true') ? attrVal : (el.getAttribute('headline') || '');
    }
    const key = el.dataset.i18nHeadlineEn;
    if (key) {
      const translated = getTranslation(key);
      if (translated) {
        el.setAttribute('headline', translated);
        el.headline = translated;
      }
    }
  });

  // 6. Custom Element values (e.g. md-tooltip) with data-i18n-value
  const valueElements = container.querySelectorAll('[data-i18n-value]');
  valueElements.forEach(el => {
    if (!el.dataset.i18nValueEn) {
      const attrVal = el.getAttribute('data-i18n-value');
      el.dataset.i18nValueEn = (attrVal && attrVal !== 'true') ? attrVal : (el.getAttribute('value') || '');
    }
    const key = el.dataset.i18nValueEn;
    if (key) {
      const translated = getTranslation(key);
      if (translated) {
        el.setAttribute('value', translated);
        el.value = translated;
        const forId = el.getAttribute('for');
        if (forId) {
          const anchor = document.getElementById(forId);
          if (anchor) anchor.setAttribute('aria-label', translated);
        }
      }
    }
  });
}

export async function initI18n() {
  const savedMode = localStorage.getItem('melo_language') || 'auto';
  await setLanguage(savedMode);
}
