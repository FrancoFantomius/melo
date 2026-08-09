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
  window.dispatchEvent(new CustomEvent('melo_language_changed', { detail: { mode: currentLanguageMode, lang: activeLanguageCode } }));
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
}

export async function initI18n() {
  const savedMode = localStorage.getItem('melo_language') || 'auto';
  await setLanguage(savedMode);
}
