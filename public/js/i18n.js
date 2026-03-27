// Minimal i18n helper
// Usage: await I18n.load(); then I18n.t('key') or I18n.apply() to swap data-i18n attrs

const I18n = (() => {
  let strings = {};
  let lang = 'en';

  const supported = ['en', 'fr', 'de', 'es'];

  function detect() {
    const stored = localStorage.getItem('lang');
    if (stored && supported.includes(stored)) return stored;
    const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return supported.includes(browser) ? browser : 'en';
  }

  async function load(forceLang) {
    lang = forceLang || detect();
    try {
      const res = await fetch(`/translations/${lang}.json`);
      strings = await res.json();
    } catch {
      if (lang !== 'en') {
        const res = await fetch('/translations/en.json');
        strings = await res.json();
      }
    }
    apply();
    return lang;
  }

  function t(key, vars = {}) {
    let str = strings[key] || key;
    Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
    return str;
  }

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (strings[key]) el.textContent = strings[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (strings[key]) el.placeholder = strings[key];
    });
  }

  function setLang(l) {
    localStorage.setItem('lang', l);
    return load(l);
  }

  function getLang() { return lang; }

  return { load, t, apply, setLang, getLang, supported };
})();
