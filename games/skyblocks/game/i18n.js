/* game/i18n.js — ВСЕ строки «Скайблоков». EN — настоящий перевод RU (8.2).
   Имена островов живут здесь (5.1.3): игра и материалы берут их из этого словаря. */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';
  G.i18n = {
    ru: {
      title: 'Скайблоки',
      menu_play: 'Играть',
      menu_best: 'Рекорд: уровень {n}',
      menu_auth: 'Яндекс ID',
      menu_auth_ok: 'Сохранения в облаке',
      menu_hint: 'Тапайте по облакам, открывайте острова, качайте их!',
      snd_on: 'Звук: вкл', snd_off: 'Звук: выкл', lang_btn: 'English',
      pause_title: 'Пауза', pause_resume: 'Продолжить', pause_restart: 'Заново', pause_menu: 'В меню',
      over_title: 'Архипелаг построен!',
      over_score: 'Уровень: {n}', over_best: 'Рекорд: {n}', over_newbest: 'Новый рекорд!',  over_restart: 'Заново', over_menu: 'В меню',
      shop_title: 'Улучшения', shop_coins: 'Кристаллы: {n}', shop_next: 'Далее', shop_rv: 'Видео: +{n} кристаллов',
      tap_power: 'Сила тапа: {n}',
      hud_level: 'Уровень {n}', hud_income: '+{n}/с',
      goal_title: 'Цели',
      goal_earn: 'Накопить {n}', goal_buy: 'Островов: {n}', goal_taps: 'Тапов: {n}',
      tut_tap: 'Тапайте по облакам — из них сыплются кристаллы!',
      tut_buy: 'Покупайте острова — они дают кристаллы каждую секунду.',
      tut_goal: 'Выполняйте цели сверху — за них уровни и горы кристаллов.',
      levelup: 'Уровень {n}! +{c} кристаллов',
      buy_to: '{name}!',
      item_power: 'Сила тапа',
      item_magnet: 'Магнит',
      item_storm: 'Гроза',
      item_harvest: 'Урожай',
      harvest_done: '+{n} кристаллов с островов!',
      tut_golden: 'Золотое облако! В нём в 8 раз больше кристаллов.',
      isles: ['Роща', 'Башня', 'Мельница', 'Пики', 'Дирижабль', 'Дворец']
    },
    en: {
      title: 'Sky Blocks',
      menu_play: 'Play',
      menu_best: 'Best: level {n}',
      menu_auth: 'Yandex ID',
      menu_auth_ok: 'Cloud saves on',
      menu_hint: 'Tap the clouds, unlock islands, upgrade them!',
      snd_on: 'Sound: on', snd_off: 'Sound: off', lang_btn: 'Русский',
      pause_title: 'Paused', pause_resume: 'Resume', pause_restart: 'Restart', pause_menu: 'Menu',
      over_title: 'Archipelago complete!',
      over_score: 'Level: {n}', over_best: 'Best: {n}', over_newbest: 'New record!',  over_restart: 'Restart', over_menu: 'Menu',
      shop_title: 'Upgrades', shop_coins: 'Crystals: {n}', shop_next: 'Next', shop_rv: 'Video: +{n} crystals',
      tap_power: 'Tap power: {n}',
      hud_level: 'Level {n}', hud_income: '+{n}/s',
      goal_title: 'Goals',
      goal_earn: 'Earn {n}', goal_buy: 'Islands: {n}', goal_taps: 'Taps: {n}',
      tut_tap: 'Tap the clouds — crystals rain from them!',
      tut_buy: 'Buy islands — they produce crystals every second.',
      tut_goal: 'Complete the goals above for levels and heaps of crystals.',
      levelup: 'Level {n}! +{c} crystals',
      buy_to: '{name}!',
      item_power: 'Tap power',
      item_magnet: 'Magnet',
      item_storm: 'Storm',
      item_harvest: 'Harvest',
      harvest_done: '+{n} crystals from the islands!',
      tut_golden: 'A golden cloud! It holds 8× more crystals.',
      isles: ['Grove', 'Tower', 'Windmill', 'Peaks', 'Airship', 'Palace']
    }
  };
})(window.GAME);