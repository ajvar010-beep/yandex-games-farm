/* game/i18n.js — словари RU/EN. Все строки игры берутся только через E.i18n.t(). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.i18n = {
    ru: {
      title: 'Латунный Порядок',
      subtitle: 'Пятнашки из старой мастерской',
      cover_tag: '12 досок · латунь и кедр',
      play: 'Играть',
      shop_title: 'Магазин',
      sound_on: 'Звук: вкл',
      sound_off: 'Звук: выкл',
      back: 'Назад',
      close: 'Закрыть',

      level_n: 'Доска {n}',
      moves_n: 'Ходы {n} / {max}',
      par_n: 'Пар {n}',
      size_n: '{n}×{n}',
      solved_n: 'Собрано {n} из {total}',
      locked: 'Доска ещё закрыта',
      footer: 'Мастерская «Латунь и порядок»',

      paused: 'Пауза',
      pause_resume: 'Продолжить',
      pause_restart: 'Заново',
      pause_menu: 'В меню',

      win_title: 'Порядок!',
      win_sub: 'Доска собрана за {n} ходов',
      won_coins: '+{n} монет',
      next_level: 'Дальше',
      double_coins: '×2 монеты',
      to_menu: 'В меню',

      over_title: 'Ходы кончились',
      over_sub: 'Доска почти собрана — ещё попытка',
      second_chance: 'Продолжить',
      retry: 'Заново',

      hint: 'Подсказка',
      undo: 'Отмена',
      shuffle: 'Перемешать',
      hint_on: 'Ход подсвечен',
      undo_done: 'Ход отменён',
      shuffle_done: 'Доска перемешана',
      no_charges: 'Нет зарядов — загляни в магазин',
      not_enough: 'Не хватает монет',

      buy: 'Купить',
      shop_hint_name: 'Подсказка ×3',
      shop_hint_desc: 'Подсвечивает следующий верный ход',
      shop_undo_name: 'Отмена ×3',
      shop_undo_desc: 'Возвращает доску на ход назад',
      shop_shuffle_name: 'Перемешать',
      shop_shuffle_desc: 'Новая раскладка, счётчик с нуля',

      ad_fail: 'Реклама не загрузилась',
      free_moves: '+{n} ходов',

      rules_title: 'Как играть',
      rules_1: 'Тапни плитку рядом с пустой клеткой — она сдвинется.',
      rules_2: 'Собери номера по порядку, пустая клетка — в правом нижнем углу.',
      rules_3: 'Успей до лимита ходов. Подсказки и отмены продаются в магазине.'
    },
    en: {
      title: 'Brass Order',
      subtitle: 'Sliding tiles from an old workshop',
      cover_tag: '12 boards · brass and cedar',
      play: 'Play',
      shop_title: 'Shop',
      sound_on: 'Sound: on',
      sound_off: 'Sound: off',
      back: 'Back',
      close: 'Close',

      level_n: 'Board {n}',
      moves_n: 'Moves {n} / {max}',
      par_n: 'Par {n}',
      size_n: '{n}×{n}',
      solved_n: 'Solved {n} of {total}',
      locked: 'Board still locked',
      footer: 'The Brass & Order workshop',

      paused: 'Paused',
      pause_resume: 'Resume',
      pause_restart: 'Restart',
      pause_menu: 'Menu',

      win_title: 'In Order!',
      win_sub: 'Board solved in {n} moves',
      won_coins: '+{n} coins',
      next_level: 'Next',
      double_coins: '×2 coins',
      to_menu: 'Menu',

      over_title: 'Out of moves',
      over_sub: 'So close — one more try',
      second_chance: 'Continue',
      retry: 'Restart',

      hint: 'Hint',
      undo: 'Undo',
      shuffle: 'Reshuffle',
      hint_on: 'Move highlighted',
      undo_done: 'Move undone',
      shuffle_done: 'Board reshuffled',
      no_charges: 'No charges — visit the shop',
      not_enough: 'Not enough coins',

      buy: 'Buy',
      shop_hint_name: 'Hints ×3',
      shop_hint_desc: 'Highlights the next good move',
      shop_undo_name: 'Undos ×3',
      shop_undo_desc: 'Takes the board one move back',
      shop_shuffle_name: 'Reshuffle',
      shop_shuffle_desc: 'Fresh scramble, counter reset',

      ad_fail: 'The ad did not load',
      free_moves: '+{n} moves',

      rules_title: 'How to play',
      rules_1: 'Tap a tile next to the empty slot to slide it.',
      rules_2: 'Put the numbers in order, empty slot in the bottom-right corner.',
      rules_3: 'Beat the move limit. Hints and undos are sold in the shop.'
    }
  };
})(window.GAME);
