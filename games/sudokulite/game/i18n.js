/* game/i18n.js — строки «Судоку Лайт» RU/EN.
   Только ключи, реально вызываемые из scenes.js. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var STR = {
    ru: {
      title: 'Судоку Лайт',
      menu_play: 'Играть',
      menu_cont: 'Продолжить',
      menu_snd: 'Звук',
      menu_lang: 'English',
      menu_auth: 'Войти',
      menu_streak: 'Дней подряд',
      hud_level: 'Уровень {n}',
      hud_coins: 'Монеты',
      shop_title: 'Лавка',
      shop_rv: 'Видео за {n} ✨',
      item_hint: 'Подсказка',
      item_hint_desc: 'Показать цифру',
      item_erase: 'Стереть ошибку',
      item_erase_desc: 'Убрать неверную цифру',
      item_check: 'Проверить',
      item_check_desc: 'Показать ошибки',
      item_solve: 'Решить клетку',
      item_solve_desc: 'Заполнить клетку',
      shop_close: 'Закрыть',
      win_title: 'Уровень пройден!',
      win_reward: '+{n} ✨',
      win_next: 'Дальше',
      win_menu: 'В меню',
      fail_title: 'Слишком много ошибок!',
      fail_retry: 'Заново',
      fail_menu: 'В меню',
      revive_offer: 'Продолжить за видео?',
      revive_btn: '+3 подсказки за видео',
      revive_no: 'Нет, спасибо',
      pause_title: 'Пауза',
      pause_resume: 'Продолжить',
      pause_restart: 'Заново',
      pause_menu: 'В меню',
      not_enough: 'Не хватает монет',
      no_errors: 'Ошибок нет!',
      tutorial_1: 'Заполните сетку цифрами 1-6',
      tutorial_2: 'Цифра не должна повторяться в строке, столбце и блоке',
      tutorial_3: 'Заполните все клетки правильно!',
      streak_new: 'Стрик {n} дней! +{c} ✨'
    },
    en: {
      title: 'Sudoku Lite',
      menu_play: 'Play',
      menu_cont: 'Continue',
      menu_snd: 'Sound',
      menu_lang: 'Русский',
      menu_auth: 'Sign in',
      menu_streak: 'Day streak',
      hud_level: 'Level {n}',
      hud_coins: 'Coins',
      shop_title: 'Shop',
      shop_rv: 'Video for {n} ✨',
      item_hint: 'Hint',
      item_hint_desc: 'Show correct number',
      item_erase: 'Erase error',
      item_erase_desc: 'Remove wrong number',
      item_check: 'Check',
      item_check_desc: 'Show errors',
      item_solve: 'Solve cell',
      item_solve_desc: 'Fill one cell',
      shop_close: 'Close',
      win_title: 'Level complete!',
      win_reward: '+{n} ✨',
      win_next: 'Next',
      win_menu: 'Menu',
      fail_title: 'Too many errors!',
      fail_retry: 'Retry',
      fail_menu: 'Menu',
      revive_offer: 'Continue for video?',
      revive_btn: '+3 hints for video',
      revive_no: 'No, thanks',
      pause_title: 'Pause',
      pause_resume: 'Resume',
      pause_restart: 'Restart',
      pause_menu: 'Menu',
      not_enough: 'Not enough coins',
      no_errors: 'No errors!',
      tutorial_1: 'Fill the grid with numbers 1-6',
      tutorial_2: 'A number must not repeat in row, column, or block',
      tutorial_3: 'Fill all cells correctly!',
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
