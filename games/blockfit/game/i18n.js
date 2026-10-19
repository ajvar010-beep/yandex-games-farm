/* game/i18n.js — строки «Блок-Фита» RU/EN.
   Только ключи, реально вызываемые из scenes.js. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var STR = {
    ru: {
      title: 'Блок-Фит',
      menu_play: 'Играть',
      menu_cont: 'Продолжить',
      menu_snd: 'Звук',
      menu_lang: 'English',
      menu_auth: 'Войти',
      menu_streak: 'Дней подряд',
      hud_level: 'Уровень {n}',
      hud_target: 'Цель: {n}',
      hud_score: 'Очки',
      shop_title: 'Лавка',
      shop_rv: 'Видео за {n} ✨',
      item_hint: 'Подсказка',
      item_hint_desc: 'Показать лучшее место',
      item_shuffle: 'Новые фигуры',
      item_shuffle_desc: 'Заменить фигуры на панели',
      item_undo: 'Отмена',
      item_undo_desc: 'Отменить размещение',
      item_bomb: 'Бомба',
      item_bomb_desc: 'Убрать область 3×3',
      shop_close: 'Закрыть',
      win_title: 'Уровень пройден!',
      win_reward: '+{n} ✨',
      win_next: 'Дальше',
      win_menu: 'В меню',
      fail_title: 'Нет места!',
      fail_retry: 'Заново',
      fail_menu: 'В меню',
      revive_offer: 'Продолжить за видео?',
      revive_btn: '+3 фигуры за видео',
      revive_no: 'Нет, спасибо',
      pause_title: 'Пауза',
      pause_resume: 'Продолжить',
      pause_restart: 'Заново',
      pause_menu: 'В меню',
      not_enough: 'Не хватает монет',
      no_moves: 'Нет места для фигур!',
      tutorial_1: 'Перетаскивайте фигуры на поле',
      tutorial_2: 'Заполняйте линии, чтобы очистить их',
      tutorial_3: 'Наберите целевое количество очков!',
      streak_new: 'Стрик {n} дней! +{c} ✨'
    },
    en: {
      title: 'Block Fit',
      menu_play: 'Play',
      menu_cont: 'Continue',
      menu_snd: 'Sound',
      menu_lang: 'Русский',
      menu_auth: 'Sign in',
      menu_streak: 'Day streak',
      hud_level: 'Level {n}',
      hud_target: 'Target: {n}',
      hud_score: 'Score',
      shop_title: 'Shop',
      shop_rv: 'Video for {n} ✨',
      item_hint: 'Hint',
      item_hint_desc: 'Show best place',
      item_shuffle: 'New shapes',
      item_shuffle_desc: 'Replace panel shapes',
      item_undo: 'Undo',
      item_undo_desc: 'Undo last placement',
      item_bomb: 'Bomb',
      item_bomb_desc: 'Clear 3×3 area',
      shop_close: 'Close',
      win_title: 'Level complete!',
      win_reward: '+{n} ✨',
      win_next: 'Next',
      win_menu: 'Menu',
      fail_title: 'No space left!',
      fail_retry: 'Retry',
      fail_menu: 'Menu',
      revive_offer: 'Continue for video?',
      revive_btn: '+3 shapes for video',
      revive_no: 'No, thanks',
      pause_title: 'Pause',
      pause_resume: 'Resume',
      pause_restart: 'Restart',
      pause_menu: 'Menu',
      not_enough: 'Not enough coins',
      no_moves: 'No space for shapes!',
      tutorial_1: 'Drag shapes onto the board',
      tutorial_2: 'Fill lines to clear them',
      tutorial_3: 'Reach the target score!',
      streak_new: 'Streak {n} days! +{c} ✨'
    }
  };

  G.i18n = {
    lang: 'ru',
    t: function (key, params) {
      var s = STR[G.i18n.lang] && STR[G.i18n.lang][key];
      if (!s) s = STR.en[key] || key;
      if (params) {
        for (var k in params) s = s.replace('{' + k + '}', params[k]);
      }
      return s;
    },
    setLang: function (l) { if (STR[l]) G.i18n.lang = l; },
    list: function () { return Object.keys(STR); }
  };
})(window.GAME);
