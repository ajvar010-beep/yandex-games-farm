/* game/config.js — данные «Слово-Сетки»: палитра, 12 уровней, 12 тем со словами RU/EN.
   Здесь только данные: никакой логики и никаких обращений к Engine.
   Слова 4–9 букв, только строчные, без Ё/Ь/Ъ в русском списке (алфавит сетки их не знает). */
window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  G.id = 'wordgrid';
  G.version = '1.0.0';

  G.config = {
    palette: {
      paper: '#f4ead4', paper2: '#ecdfc2', paperDark: '#ddcaa3',
      ink: '#2c2a32', inkSoft: '#5d5866', inkFaint: '#9c917b',
      grid: '#b8a684', cell: '#fbf6e8', cellAlt: '#f7efdc',
      accent: '#b4492f', accent2: '#2f6b5e',
      gold: '#d8a33a', coin: '#e0a93b',
      good: '#4f8a5b', bad: '#b4492f', hl: '#f3d487',
      panel: '#f9f1dd', panelEdge: '#c9b693',
      shade: 'rgba(38,32,26,0.52)', shadow: 'rgba(88,66,38,0.22)'
    },

    board: { minLen: 4, maxLen: 9 },

    /* Уровень: тема, размер сетки, сколько слов искать, время в секундах. */
    levels: [
      { n: 1,  theme: 'sea',     size: 8,  words: 5, time: 95  },
      { n: 2,  theme: 'forest',  size: 8,  words: 5, time: 100 },
      { n: 3,  theme: 'space',   size: 8,  words: 6, time: 105 },
      { n: 4,  theme: 'kitchen', size: 8,  words: 6, time: 110 },
      { n: 5,  theme: 'sport',   size: 10, words: 6, time: 115 },
      { n: 6,  theme: 'music',   size: 10, words: 7, time: 120 },
      { n: 7,  theme: 'garden',  size: 10, words: 7, time: 125 },
      { n: 8,  theme: 'city',    size: 10, words: 7, time: 130 },
      { n: 9,  theme: 'winter',  size: 12, words: 7, time: 135 },
      { n: 10, theme: 'school',  size: 12, words: 8, time: 140 },
      { n: 11, theme: 'party',   size: 12, words: 8, time: 145 },
      { n: 12, theme: 'travel',  size: 12, words: 8, time: 150 }
    ],

    /* Тема: ключ названия (i18n), чернильный акцент и два списка слов. */
    themes: {
      sea: {
        name: 'theme_sea', accent: '#2d6f8e',
        ru: ['вода', 'волна', 'берег', 'парус', 'рыба', 'краб', 'чайка', 'лодка',
             'скала', 'песок', 'шторм', 'маяк', 'медуза', 'бухта'],
        en: ['water', 'wave', 'shore', 'sail', 'fish', 'crab', 'gull', 'boat',
             'rock', 'sand', 'storm', 'beacon', 'jelly', 'shell', 'tide', 'coral']
      },
      forest: {
        name: 'theme_forest', accent: '#3f7a44',
        ru: ['дерево', 'шишка', 'белка', 'лиса', 'волк', 'тропа', 'грибы', 'сова',
             'куст', 'корни', 'овраг', 'ягода', 'ветка', 'поляна'],
        en: ['tree', 'pine', 'acorn', 'squirrel', 'wolf', 'trail', 'mushroom', 'bush',
             'stump', 'berry', 'branch', 'grove', 'fern', 'deer', 'moss']
      },
      space: {
        name: 'theme_space', accent: '#5b4b8a',
        ru: ['звезда', 'луна', 'орбита', 'ракета', 'комета', 'планета', 'солнце', 'метеор',
             'спутник', 'небо', 'вакуум', 'галактика'],
        en: ['star', 'moon', 'orbit', 'rocket', 'comet', 'planet', 'meteor', 'satellite',
             'galaxy', 'space', 'lunar', 'cosmos', 'nova']
      },
      kitchen: {
        name: 'theme_kitchen', accent: '#b3612f',
        ru: ['каша', 'торт', 'вилка', 'ложка', 'чашка', 'плита', 'соус', 'тесто',
             'мука', 'сахар', 'перец', 'кастрюля'],
        en: ['soup', 'cake', 'fork', 'spoon', 'stove', 'sauce', 'dough', 'oven',
             'flour', 'salt', 'sugar', 'pepper', 'kettle', 'recipe', 'plate']
      },
      sport: {
        name: 'theme_sport', accent: '#a83a3a',
        ru: ['футбол', 'теннис', 'лыжи', 'плавание', 'прыжок', 'финиш', 'тренер', 'кубок',
             'матч', 'очки', 'команда', 'победа'],
        en: ['ball', 'goal', 'football', 'tennis', 'swim', 'jump', 'finish', 'coach',
             'trophy', 'match', 'team', 'race', 'medal', 'score']
      },
      music: {
        name: 'theme_music', accent: '#7a3f6e',
        ru: ['нота', 'песня', 'скрипка', 'гитара', 'флейта', 'ритм', 'аккорд', 'сцена',
             'труба', 'барабан', 'темп', 'мелодия', 'джаз'],
        en: ['note', 'song', 'violin', 'guitar', 'piano', 'flute', 'rhythm', 'chord',
             'stage', 'trumpet', 'drum', 'tempo', 'melody', 'jazz', 'opera']
      },
      garden: {
        name: 'theme_garden', accent: '#5c7d2f',
        ru: ['грядка', 'репа', 'морковка', 'капуста', 'тыква', 'огурец', 'помидор', 'горох',
             'редис', 'укроп', 'салат', 'лейка', 'забор', 'клумба'],
        en: ['garden', 'seed', 'carrot', 'cabbage', 'onion', 'pumpkin', 'cucumber', 'tomato',
             'radish', 'dill', 'salad', 'fence', 'shovel', 'flower']
      },
      city: {
        name: 'theme_city', accent: '#4a5a72',
        ru: ['улица', 'метро', 'автобус', 'трамвай', 'фонтан', 'парк', 'мост', 'башня',
             'музей', 'театр', 'рынок', 'кафе', 'район', 'вокзал', 'двор'],
        en: ['street', 'square', 'metro', 'tram', 'fountain', 'park', 'bridge', 'tower',
             'museum', 'theater', 'market', 'cafe', 'district', 'station', 'yard', 'plaza']
      },
      winter: {
        name: 'theme_winter', accent: '#3d7d94',
        ru: ['снег', 'мороз', 'санки', 'шуба', 'варежка', 'елка', 'зима', 'сугроб',
             'лыжи', 'каток', 'шарф', 'шапка', 'холод', 'свеча'],
        en: ['snow', 'frost', 'sled', 'coat', 'mitten', 'winter', 'blizzard', 'drift',
             'skates', 'scarf', 'cold', 'candle', 'chimney', 'snowman']
      },
      school: {
        name: 'theme_school', accent: '#6a4a2f',
        ru: ['парта', 'ручка', 'доска', 'урок', 'класс', 'задача', 'пенал', 'книга',
             'звонок', 'перемена', 'оценка', 'пример', 'карта', 'глобус'],
        en: ['desk', 'board', 'lesson', 'class', 'task', 'notebook', 'pencil', 'book',
             'bell', 'break', 'grade', 'teacher', 'example', 'globe', 'chalk']
      },
      party: {
        name: 'theme_party', accent: '#b4522f',
        ru: ['торт', 'свеча', 'шарик', 'подарок', 'танец', 'песня', 'фейерверк', 'гирлянда',
             'сюрприз', 'ленты', 'игра', 'конфеты', 'улыбка', 'флажки'],
        en: ['cake', 'candle', 'balloon', 'gift', 'guest', 'dance', 'song', 'fireworks',
             'garland', 'surprise', 'ribbon', 'game', 'candy', 'smile', 'party']
      },
      travel: {
        name: 'theme_travel', accent: '#4d6b5a',
        ru: ['карта', 'билет', 'поезд', 'самолет', 'рюкзак', 'пляж', 'турне', 'компас',
             'маршрут', 'багаж', 'виза', 'город', 'палатка', 'дорога'],
        en: ['ticket', 'train', 'plane', 'backpack', 'hotel', 'beach', 'tour', 'compass',
             'route', 'luggage', 'visa', 'city', 'tent', 'road', 'voyage']
      }
    },

    economy: {
      startCoins: 60,
      wordBase: 3, wordPerLen: 1,      // монеты за найденное слово = 3 + длина
      winBase: 40, winPerLevel: 10,    // награда за уровень
      timeBonus: 1,                    // монеты за каждую оставшуюся секунду
      rvCoins: 60,                     // монет за рекламу в лавке
      hintPrice: 30,                   // подсказка: мигнуть первой буквой
      shufflePrice: 45,                // перемешать: переложить оставшиеся слова
      timePrice: 60,                   // +30 секунд
      priceGrowth: 1.15,               // каждая покупка того же товара дороже
      timeAdd: 30
    },

    ads: { interstitialEvery: 2 }
  };
})(window.GAME);
