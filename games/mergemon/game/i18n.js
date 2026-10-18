/* game/i18n.js — ВСЕ строки игры. EN — настоящий перевод RU (8.2).
   Имена монстриков живут здесь, а не в config: это текст, а не конфиг (5.1.3 —
   название в материалах и в игре идентично, оба берутся из этого словаря). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.i18n = {
    ru: {
      title: 'Слияние Монстриков',
      menu_play: 'Играть',
      menu_best: 'Рекорд: уровень {n}',
      menu_auth: 'Яндекс ID',
      menu_auth_ok: 'Сохранения в облаке',
      menu_hint: 'Соединяйте одинаковых монстриков — они эволюционируют!',
      snd_on: 'Звук: вкл', snd_off: 'Звук: выкл', lang_btn: 'English',
      pause_title: 'Пауза', pause_resume: 'Продолжить', pause_restart: 'Заново', pause_menu: 'В меню',
      over_title: 'Поле заполнено!',
      over_score: 'Уровень: {n}', over_best: 'Рекорд: {n}', over_newbest: 'Новый рекорд!',
      over_revive: 'Очистить 3 клетки за видео', over_restart: 'Заново', over_menu: 'В меню',
      shop_title: 'Бустеры', shop_coins: 'Монеты: {n}', shop_next: 'Далее', shop_rv: 'Видео: +{n} монет',
      spawn_btn: 'Яйцо: {n}',
      hud_level: 'Уровень {n}', hud_income: '+{n}/с',
      goal_title: 'Цели',
      tut_drag: 'Тяните монстрика на такого же — они сольются в нового!',
      tut_spawn: 'Тапните по яйцу, чтобы призвать нового монстрика.',
      tut_goal: 'Выполняйте цели сверху — за них уровень и горы монет.',
      levelup: 'Уровень {n}! +{c} монет',
      merge_to: '{name}!',
      item_gem: 'Камень роста', item_gem_d: 'Случайный монстрик +1 тир',
      item_wild: 'Джокер', item_wild_d: 'Мержится с любым монстриком',
      item_clear: 'Метла', item_clear_d: 'Убрать самого слабого (+монеты)',
      item_gust: 'Ураган', item_gust_d: 'Перемешивает всех по доске',
      full_warn: 'Поле почти заполнено!',
      revive_done: 'Поле почищено!',
      mons: ['Ростик', 'Капля', 'Рогач', 'Ушко', 'Пуфик', 'Лампик',
             'Ёжик', 'Бесёнок', 'Крылик', 'Мотылёк', 'Король', 'Ангелик',
             'Светлячок', 'Дракончик', 'Комочек', 'Царь-Змей']
    },
    en: {
      title: 'Merge Monsters',
      menu_play: 'Play',
      menu_best: 'Best: level {n}',
      menu_auth: 'Yandex ID',
      menu_auth_ok: 'Cloud saves on',
      menu_hint: 'Merge matching monsters — they evolve!',
      snd_on: 'Sound: on', snd_off: 'Sound: off', lang_btn: 'Русский',
      pause_title: 'Paused', pause_resume: 'Resume', pause_restart: 'Restart', pause_menu: 'Menu',
      over_title: 'Board is full!',
      over_score: 'Level: {n}', over_best: 'Best: {n}', over_newbest: 'New record!',
      over_revive: 'Clear 3 cells for a video', over_restart: 'Restart', over_menu: 'Menu',
      shop_title: 'Boosters', shop_coins: 'Coins: {n}', shop_next: 'Next', shop_rv: 'Video: +{n} coins',
      spawn_btn: 'Egg: {n}',
      hud_level: 'Level {n}', hud_income: '+{n}/s',
      goal_title: 'Goals',
      tut_drag: 'Drag a monster onto a matching one — they merge into a new friend!',
      tut_spawn: 'Tap the egg to summon a new monster.',
      tut_goal: 'Complete the goals above for levels and heaps of coins.',
      levelup: 'Level {n}! +{c} coins',
      merge_to: '{name}!',
      item_gem: 'Growth gem', item_gem_d: 'Random monster +1 tier',
      item_wild: 'Joker', item_wild_d: 'Merges with any monster',
      item_clear: 'Broom', item_clear_d: 'Remove the weakest (+coins)',
      item_gust: 'Gust', item_gust_d: 'Shuffles everyone on the board',
      full_warn: 'Board is almost full!',
      revive_done: 'Board cleared!',
      mons: ['Sprout', 'Droplet', 'Hornlet', 'Earling', 'Puff', 'Lampy',
             'Spike', 'Imp', 'Winglet', 'Moth', 'King', 'Angel',
             'Glowbug', 'Drake', 'Puffball', 'Wyrm King']
    }
  };
})(window.GAME);
