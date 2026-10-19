/* game/i18n.js — строки «Слияния 2048» RU/EN.
   Только ключи, реально вызываемые из scenes.js. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var STR = {
    ru: {
      title: 'Слияние 2048',
      menu_play: 'Играть',
      menu_cont: 'Продолжить',
      menu_snd: 'Звук',
      menu_lang: 'English',
      menu_auth: 'Войти',
      menu_streak: 'Дней подряд',
      hud_level: 'Уровень {n}',
      hud_target: 'Цель: {n}',
      hud_score: 'Очки',
      hud_coins: 'Монеты',
      shop_title: 'Лавка',
      shop_rv: 'Видео за {n} ✨',
      item_hint: 'Подсказка',
      item_hint_desc: 'Показать лучший ход',
      item_shuffle: 'Перемешать',
      item_shuffle_desc: 'Перемешать поле',
      item_undo: 'Отмена',
      item_undo_desc: 'Отменить последний ход',
      item_bomb: 'Бомба',
      item_bomb_desc: 'Убрать самую маленькую',
      shop_close: 'Закрыть',
      win_title: 'Уровень пройден!',
      win_reward: '+{n} ✨',
      win_next: 'Дальше',
      win_menu: 'В меню',
      fail_title: 'Нет ходов!',
      fail_retry: 'Заново',
      fail_menu: 'В меню',
      revive_offer: 'Восстановить за видео?',
      revive_btn: '+3 хода за видео',
      revive_no: 'Нет, спасибо',
      pause_title: 'Пауза',
      pause_resume: 'Продолжить',
      pause_restart: 'Заново',
      pause_menu: 'В меню',
      not_enough: 'Не хватает монет',
      game_over: 'Игра окончена',
      tutorial_1: 'Свайпайте, чтобы сдвинуть плитки',
      tutorial_2: 'Одинаковые плитки сливаются в одну',
      tutorial_3: 'Создайте плитку с целью уровня!',
      streak_new: 'Стрик {n} дней! +{c} ✨',
      best_score: 'Рекорд: {n}'
    },
    en: {
      title: 'Merge 2048',
      menu_play: 'Play',
      menu_cont: 'Continue',
      menu_snd: 'Sound',
      menu_lang: 'Русский',
      menu_auth: 'Sign in',
      menu_streak: 'Day streak',
      hud_level: 'Level {n}',
      hud_target: 'Target: {n}',
      hud_score: 'Score',
      hud_coins: 'Coins',
      shop_title: 'Shop',
      shop_rv: 'Video for {n} ✨',
      item_hint: 'Hint',
      item_hint_desc: 'Show best move',
      item_shuffle: 'Shuffle',
      item_shuffle_desc: 'Shuffle the board',
      item_undo: 'Undo',
      item_undo_desc: 'Undo last move',
      item_bomb: 'Bomb',
      item_bomb_desc: 'Remove smallest tile',
      shop_close: 'Close',
      win_title: 'Level complete!',
      win_reward: '+{n} ✨',
      win_next: 'Next',
      win_menu: 'Menu',
      fail_title: 'No moves left!',
      fail_retry: 'Retry',
      fail_menu: 'Menu',
      revive_offer: 'Revive for video?',
      revive_btn: '+3 moves for video',
      revive_no: 'No, thanks',
      pause_title: 'Pause',
      pause_resume: 'Resume',
      pause_restart: 'Restart',
      pause_menu: 'Menu',
      not_enough: 'Not enough coins',
      game_over: 'Game over',
      tutorial_1: 'Swipe to move tiles',
      tutorial_2: 'Matching tiles merge into one',
      tutorial_3: 'Create the target tile!',
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
