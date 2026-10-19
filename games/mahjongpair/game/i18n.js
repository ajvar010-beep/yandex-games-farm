/* game/i18n.js — строки «Парного Маджонга» RU/EN.
   Только ключи, реально вызываемые из scenes.js. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var STR = {
    ru: {
      title: 'Парный Маджонг',
      menu_play: 'Играть',
      menu_cont: 'Продолжить',
      menu_snd: 'Звук',
      menu_lang: 'English',
      menu_auth: 'Войти',
      menu_streak: 'Дней подряд',
      menu_streak_reward: '+{n} за возврат',
      hud_level: 'Уровень {n}',
      hud_time: 'Время',
      hud_coins: 'Монеты',
      hud_score: 'Очки',
      shop_title: 'Лавка',
      shop_rv: 'Видео за {n} ✨',
      item_hint: 'Подсказка',
      item_hint_desc: 'Показать пару',
      item_shuffle: 'Перемешать',
      item_shuffle_desc: 'Перемешать оставшиеся',
      item_time: 'Время +30',
      item_time_desc: 'Добавить 30 секунд',
      item_undo: 'Отмена',
      item_undo_desc: 'Отменить последний ход',
      shop_close: 'Закрыть',
      win_title: 'Уровень пройден!',
      win_reward: '+{n} ✨',
      win_next: 'Дальше',
      win_menu: 'В меню',
      fail_title: 'Время вышло',
      fail_retry: 'Заново',
      fail_menu: 'В меню',
      revive_offer: 'Восстановить за видео?',
      revive_btn: '+30 сек за видео',
      revive_no: 'Нет, спасибо',
      pause_title: 'Пауза',
      pause_resume: 'Продолжить',
      pause_restart: 'Заново',
      pause_menu: 'В меню',
      not_enough: 'Не хватает монет',
      no_moves: 'Нет ходов! Перемешайте.',
      tutorial_1: 'Находите пары одинаковых плиток',
      tutorial_2: 'Плитка доступна, если сверху и сбоку свободно',
      tutorial_3: 'Уберите все плитки до конца времени',
      streak_new: 'Стрик {n} дней! +{c} ✨',
      best_score: 'Рекорд: {n}'
    },
    en: {
      title: 'Mahjong Pair',
      menu_play: 'Play',
      menu_cont: 'Continue',
      menu_snd: 'Sound',
      menu_lang: 'Русский',
      menu_auth: 'Sign in',
      menu_streak: 'Day streak',
      menu_streak_reward: '+{n} for return',
      hud_level: 'Level {n}',
      hud_time: 'Time',
      hud_coins: 'Coins',
      hud_score: 'Score',
      shop_title: 'Shop',
      shop_rv: 'Video for {n} ✨',
      item_hint: 'Hint',
      item_hint_desc: 'Show a pair',
      item_shuffle: 'Shuffle',
      item_shuffle_desc: 'Shuffle remaining',
      item_time: 'Time +30',
      item_time_desc: 'Add 30 seconds',
      item_undo: 'Undo',
      item_undo_desc: 'Undo last move',
      shop_close: 'Close',
      win_title: 'Level complete!',
      win_reward: '+{n} ✨',
      win_next: 'Next',
      win_menu: 'Menu',
      fail_title: 'Time is up',
      fail_retry: 'Retry',
      fail_menu: 'Menu',
      revive_offer: 'Revive for video?',
      revive_btn: '+30 sec for video',
      revive_no: 'No, thanks',
      pause_title: 'Pause',
      pause_resume: 'Resume',
      pause_restart: 'Restart',
      pause_menu: 'Menu',
      not_enough: 'Not enough coins',
      no_moves: 'No moves! Shuffle.',
      tutorial_1: 'Find pairs of matching tiles',
      tutorial_2: 'A tile is free if top and side are clear',
      tutorial_3: 'Clear all tiles before time runs out',
      streak_new: 'Streak {n} days! +{c} ✨',
      best_score: 'Best: {n}'
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
