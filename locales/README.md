# Duvela Web localization

`web-locales.js` is the UTF-8 locale catalog used by `index.html`.

The catalog contains:

- metadata for all 25 interface languages;
- base translations maintained by hand;
- supplemental translations and fallback content;
- text direction metadata for RTL locales.

Run `npm run check:i18n` after changing any locale. The check validates key
coverage, placeholders, HTML fragments, encoding, RTL metadata, and the
language selector in `index.html`.
