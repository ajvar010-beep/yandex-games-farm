/* game/i18n.js — словари RU/EN. Все строки игры берутся только через E.i18n.t(). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.i18n = {
    ru: {
      title: 'Гвозди',
      title1: 'ГВОЗДИ',
      subtitle: 'Мастерская, шары и шпильки',
      cover_tag: 'Выдёргивай шпильки — направляй шары',
      cover_line: '15 уровней · 3 чаши · точный момент',

      play: 'Играть',
      shop: 'Мастерская',
      close: 'Понятно',
      sound_on: 'Звук: вкл',
      sound_off: 'Звук: выкл',

      coins: 'Монеты',
      level_n: 'Уровень {n}',
      progress_n: 'Уровень {n} из {total}',
      best_n: 'Дошёл до {n}',
      menu_tip: 'Тап по шпильке — она вылетает',

      rules_title: 'Как играть',
      rules_1: 'Сверху падают стальные шары — по одному.',
      rules_2: 'Шар отскакивает от шпилек и летит в одну из трёх чаш.',
      rules_3: 'Тап по шпильке выдёргивает её и меняет путь следующих шаров.',
      rules_4: 'Заполни все чаши, пока не кончились шары.',

      tut_watch: 'Смотри, куда падает шар',
      tut_pull: 'Тап по шпильке — она вылетает',

      paused: 'Пауза',
      pause_resume: 'Продолжить',
      pause_restart: 'Заново',
      pause_menu: 'В меню',

      win_title: 'Уровень пройден!',
      win_sub: 'Все чаши полны',
      won_coins: '+{n} монет',
      next_level: 'Дальше',
      retry: 'Заново',
      to_menu: 'В меню',

      lose_title: 'Шары кончились',
      cups_now: 'Заполнено чаш: {a} из {b}',

      double_reward: '×2 награда',
      second_chance: '+3 шара',
      ad_fail: 'Реклама не показалась',

      shop_title: 'Мастерская',
      shop_hint: 'Постоянные улучшения за монеты',
      shop_stock: 'Запас шаров',
      shop_stock_d: '+2 шара к каждому уровню',
      shop_slow: 'Тормоз',
      boost_slow: 'Стоп',
      boost_pliers: 'Клещи',
      boost_shop: 'Лавка',
      boost_busy: 'Сейчас не сработает',
      shop_slow_d: 'Замедление шаров на 5 секунд',
      shop_pliers: 'Клещи',
      shop_pliers_d: 'Снимают нужную шпильку за тебя',
      buy: 'Купить',
      maxed: 'Максимум',
      not_enough: 'Не хватает монет',
      back: 'Назад',
      owned_n: 'Ур. {n}/{max}',

    },

    en: {
      title: 'Pin Drop',
      title1: 'PIN DROP',
      subtitle: 'A workshop, steel balls and pins',
      cover_tag: 'Pull the pins, steer the balls',
      cover_line: '15 levels · 3 cups · perfect timing',

      play: 'Play',
      shop: 'Workshop',
      close: 'Got it',
      sound_on: 'Sound: on',
      sound_off: 'Sound: off',

      coins: 'Coins',
      level_n: 'Level {n}',
      progress_n: 'Level {n} of {total}',
      best_n: 'Best: {n}',
      menu_tip: 'Tap a pin and it pops out',

      rules_title: 'How to play',
      rules_1: 'Steel balls drop from the hopper, one at a time.',
      rules_2: 'Each ball bounces off the pins into one of three cups.',
      rules_3: 'Tap a pin to pull it out and reroute the next balls.',
      rules_4: 'Fill every cup before you run out of balls.',

      tut_watch: 'Watch where the ball lands',
      tut_pull: 'Tap a pin to pop it out',

      paused: 'Paused',
      pause_resume: 'Resume',
      pause_restart: 'Restart',
      pause_menu: 'Menu',

      win_title: 'Level cleared!',
      win_sub: 'Every cup is full',
      won_coins: '+{n} coins',
      next_level: 'Next',
      retry: 'Retry',
      to_menu: 'Menu',

      lose_title: 'Out of balls',
      cups_now: 'Cups filled: {a} of {b}',

      double_reward: '×2 reward',
      second_chance: '+3 balls',
      ad_fail: 'Ad did not show',

      shop_title: 'Workshop',
      shop_hint: 'Permanent upgrades for coins',
      shop_stock: 'Ball stock',
      shop_stock_d: '+2 balls on every level',
      shop_slow: 'Brake',
      boost_slow: 'Brake',
      boost_pliers: 'Pliers',
      boost_shop: 'Shop',
      boost_busy: 'Not right now',
      shop_slow_d: 'Slows the balls for 5 seconds',
      shop_pliers: 'Pliers',
      shop_pliers_d: 'Pulls the right pin for you',
      buy: 'Buy',
      maxed: 'Maxed',
      not_enough: 'Not enough coins',
      back: 'Back',
      owned_n: 'Lv {n}/{max}',

    }
  };
})(window.GAME);
