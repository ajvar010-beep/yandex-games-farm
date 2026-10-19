/* game/i18n.js — строки «Пасьянса Клондайк» RU/EN.
   Только ключи, реально вызываемые из scenes.js. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var STR = {
    ru: {
      title: 'Пасьянс Клондайк',
      menu_play: 'Играть',
      menu_cont: 'Продолжить',
      menu_snd: 'Звук',
      menu_lang: 'English',
      menu_auth: 'Войти',
      hud_level: 'Уровень {n}',
      hud_coins: 'Монеты',
      shop_title: 'Лавка',
      item_hint: 'Подсказка',
      item_hint_desc: 'Показать доступный ход',
      item_undo: 'Отмена',
      item_undo_desc: 'Отменить последний ход',
      shop_close: 'Закрыть',
      win_title: 'Победа!',
      win_reward: '+{n} ✨',
      win_next: 'Дальше',
      win_menu: 'В меню',
      fail_title: 'Нет ходов!',
      fail_retry: 'Заново',
      fail_menu: 'В меню',
      pause_title: 'Пауза',
      pause_resume: 'Продолжить',
      pause_restart: 'Заново',
      pause_menu: 'В меню',
      not_enough: 'Не хватает монет',
      no_moves: 'Нет доступных ходов',
      tutorial_1: 'Перетаскивайте карты на противоположный цвет по убыванию',
      tutorial_2: 'Собирайте масти от туза до короля в фундаменте',
      tutorial_3: 'Откройте все карты и очистите поле!'
    },
    en: {
      title: 'Klondike Solitaire',
      menu_play: 'Play',
      menu_cont: 'Continue',
      menu_snd: 'Sound',
      menu_lang: 'Русский',
      menu_auth: 'Sign in',
      hud_level: 'Level {n}',
      hud_coins: 'Coins',
      shop_title: 'Shop',
      item_hint: 'Hint',
      item_hint_desc: 'Show available move',
      item_undo: 'Undo',
      item_undo_desc: 'Undo last move',
      shop_close: 'Close',
      win_title: 'You win!',
      win_reward: '+{n} ✨',
      win_next: 'Next',
      win_menu: 'Menu',
      fail_title: 'No moves left!',
      fail_retry: 'Retry',
      fail_menu: 'Menu',
      pause_title: 'Pause',
      pause_resume: 'Resume',
      pause_restart: 'Restart',
      pause_menu: 'Menu',
      not_enough: 'Not enough coins',
      no_moves: 'No available moves',
      tutorial_1: 'Drag cards to opposite color in descending order',
      tutorial_2: 'Build foundations from Ace to King',
      tutorial_3: 'Reveal all cards and clear the board!'
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
