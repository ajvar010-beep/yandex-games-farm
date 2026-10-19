/* game/i18n.js — строки «Рыбного Пруда» RU/EN.
   Структура: G.i18n = { ru: {...}, en: {...} } — совместимо с engine/i18n.js. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.i18n = {
    ru: {
      title: 'Рыбный Пруд',
      menu_play: 'Играть',
      menu_snd: 'Звук',
      menu_lang: 'English',
      hud_score: 'Очки',
      hud_best: 'Рекорд',
      tutorial_1: 'Коснитесь рыбки, чтобы поймать её',
      tutorial_2: 'Коснитесь пузыря, чтобы собрать его',
      over_title: 'Игра окончена',
      over_score: 'Ваш счёт: {n}',
      over_best: 'Рекорд: {n}',
      over_retry: 'Ещё раз',
      over_menu: 'В меню'
    },
    en: {
      title: 'Fish Pond',
      menu_play: 'Play',
      menu_snd: 'Sound',
      menu_lang: 'Русский',
      hud_score: 'Score',
      hud_best: 'Best',
      tutorial_1: 'Tap a fish to catch it',
      tutorial_2: 'Tap a bubble to collect it',
      over_title: 'Game Over',
      over_score: 'Your score: {n}',
      over_best: 'Best: {n}',
      over_retry: 'Play again',
      over_menu: 'Menu'
    }
  };
})(window.GAME);
