(function renderDuvelaLegalPage() {
  'use strict';

  const webCatalog = window.DUVELA_WEB_I18N;
  const legalCatalog = window.DUVELA_LEGAL;
  const params = new URLSearchParams(window.location.search);
  const validKinds = new Set(['privacy', 'impressum', 'terms']);
  const kind = validKinds.has(params.get('doc')) ? params.get('doc') : 'privacy';
  const requestedLocale = String(params.get('lang') || localStorage.getItem('duvela.webLang') || 'en')
    .toLowerCase()
    .split('-')[0];
  const localeMeta =
    webCatalog.locales.find((item) => item.code === requestedLocale) ?? webCatalog.locales[0];
  const locale = localeMeta.code;
  const contentLocale = legalCatalog.content[kind][locale] ? locale : 'en';
  const content = legalCatalog.content[kind][contentLocale];
  const webCopy = Object.assign(
    {},
    webCatalog.base.en,
    webCatalog.extra.en,
    webCatalog.base[locale] ?? {},
    webCatalog.extra[locale] ?? {},
  );

  document.documentElement.lang = locale;
  document.documentElement.dir = localeMeta.dir;
  document.title = `${content.title} — Duvela`;

  const languageSelect = document.getElementById('legalLanguage');
  for (const language of webCatalog.locales) {
    const option = document.createElement('option');
    option.value = language.code;
    option.textContent = `${language.flag} ${language.name}`;
    option.selected = language.code === locale;
    languageSelect.appendChild(option);
  }
  languageSelect.addEventListener('change', () => {
    localStorage.setItem('duvela.webLang', languageSelect.value);
    const next = new URL(window.location.href);
    next.searchParams.set('lang', languageSelect.value);
    window.location.href = next.toString();
  });

  const labels = {
    privacy: webCopy.footPrivacy,
    impressum: webCopy.footImpressum,
    terms: webCopy.footTerms,
  };

  for (const link of document.querySelectorAll('[data-legal-kind]')) {
    const linkKind = link.dataset.legalKind;
    link.textContent = labels[linkKind];
    link.href = `./legal.html?doc=${linkKind}&lang=${locale}`;
    link.classList.toggle('active', linkKind === kind);
  }

  document.getElementById('legalCookieSettings').textContent = webCopy.footCookie;
  document.getElementById('legalCookieSettings').addEventListener('click', () => {
    window.DUVELA_CONSENT.openSettings();
  });

  const contentRoot = document.getElementById('legalContent');
  if (contentLocale !== locale) {
    const fallback = document.createElement('p');
    fallback.className = 'legal-fallback';
    fallback.textContent = 'This legal document is currently provided in English.';
    contentRoot.appendChild(fallback);
  }

  const contentElement = document.createElement('div');
  contentElement.className = 'privacyContent';
  const title = document.createElement('h1');
  title.className = 'privacyTitle';
  title.textContent = content.title;
  contentElement.appendChild(title);

  function appendParagraph(parent, value) {
    const paragraph = document.createElement('p');
    paragraph.className = 'privacyParagraph';
    const urlPattern = /(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[a-z]{2,})/gi;
    let cursor = 0;
    for (const match of value.matchAll(urlPattern)) {
      paragraph.append(document.createTextNode(value.slice(cursor, match.index)));
      const link = document.createElement('a');
      link.href = match[0].includes('@') ? `mailto:${match[0]}` : match[0];
      link.textContent = match[0];
      if (!match[0].includes('@')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      paragraph.append(link);
      cursor = match.index + match[0].length;
    }
    paragraph.append(document.createTextNode(value.slice(cursor)));
    parent.appendChild(paragraph);
  }

  function appendList(parent, values) {
    if (!values?.length) return;
    const list = document.createElement('ul');
    list.className = 'privacyList';
    for (const value of values) {
      const item = document.createElement('li');
      item.textContent = value;
      list.appendChild(item);
    }
    parent.appendChild(list);
  }

  function appendTextBlocks(parent, block) {
    for (const paragraph of block.paragraphs ?? []) appendParagraph(parent, paragraph);
    appendList(parent, block.list);
    for (const paragraph of block.afterList ?? []) appendParagraph(parent, paragraph);
  }

  for (const sectionData of content.sections) {
    const section = document.createElement('section');
    section.className = 'privacySection';
    const heading = document.createElement('h2');
    heading.className = 'privacyHeading';
    heading.textContent = sectionData.title;
    section.appendChild(heading);
    appendTextBlocks(section, sectionData);

    for (const subsectionData of sectionData.subsections ?? []) {
      const subsection = document.createElement('div');
      subsection.className = 'privacySubsection';
      const subheading = document.createElement('h3');
      subheading.className = 'privacySubheading';
      subheading.textContent = subsectionData.title;
      subsection.appendChild(subheading);
      appendTextBlocks(subsection, subsectionData);
      section.appendChild(subsection);
    }
    contentElement.appendChild(section);
  }

  contentRoot.appendChild(contentElement);
  window.DUVELA_CONSENT.init(locale);
})();
