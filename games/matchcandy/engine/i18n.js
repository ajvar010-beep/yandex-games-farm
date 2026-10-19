/* engine/i18n.js — словари RU/EN. Никаких захардкоженных строк в логике. */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';
  var I = {
    dicts: {}, lang: 'en', fallback: 'en',
    init: function (dicts, lang) {
      I.dicts = dicts || {};
      I.lang = I.dicts[lang] ? lang : I.fallback;
      try { document.documentElement.lang = I.lang; } catch (e) {}
      return I.lang;
    },
    setLang: function (lang) {
      if (I.dicts[lang]) { I.lang = lang; try { document.documentElement.lang = lang; } catch (e) {} }
      return I.lang;
    },
    t: function (key, vars) {
      var d = I.dicts[I.lang] || {};
      var s = d[key];
      if (s == null) s = (I.dicts[I.fallback] || {})[key];
      if (s == null) s = key;
      if (vars) for (var k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
      return s;
    }
  };
  E.i18n = I;
})(window.Engine);
