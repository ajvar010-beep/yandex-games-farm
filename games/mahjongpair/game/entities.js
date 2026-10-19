/* game/entities.js — данные «Парного Маджонга»: плитки, раскладки, генерация.
   Standalone: window.GAME.entities. */

window.GAME = window.GAME || {};
(function (G) {
  'use strict';

  var ENT = G.entities = {};

  /* ---------- Типы плиток: 36 символов, 4 копии каждого ---------- */
  // Категории: бамбук 1-9, круги 1-9, иероглифы 1-9, ветра 4, драконы 3, цветы 4
  var TILE_TYPES = [
    // бамбук (sticks)
    { id: 'b1', sym: '1', cat: 'bamboo', color: '#4a9e4a' },
    { id: 'b2', sym: '2', cat: 'bamboo', color: '#4a9e4a' },
    { id: 'b3', sym: '3', cat: 'bamboo', color: '#4a9e4a' },
    { id: 'b4', sym: '4', cat: 'bamboo', color: '#4a9e4a' },
    { id: 'b5', sym: '5', cat: 'bamboo', color: '#4a9e4a' },
    { id: 'b6', sym: '6', cat: 'bamboo', color: '#4a9e4a' },
    { id: 'b7', sym: '7', cat: 'bamboo', color: '#4a9e4a' },
    { id: 'b8', sym: '8', cat: 'bamboo', color: '#4a9e4a' },
    { id: 'b9', sym: '9', cat: 'bamboo', color: '#4a9e4a' },
    // круги (dots)
    { id: 'd1', sym: '1', cat: 'dots', color: '#4a7ab8' },
    { id: 'd2', sym: '2', cat: 'dots', color: '#4a7ab8' },
    { id: 'd3', sym: '3', cat: 'dots', color: '#4a7ab8' },
    { id: 'd4', sym: '4', cat: 'dots', color: '#4a7ab8' },
    { id: 'd5', sym: '5', cat: 'dots', color: '#4a7ab8' },
    { id: 'd6', sym: '6', cat: 'dots', color: '#4a7ab8' },
    { id: 'd7', sym: '7', cat: 'dots', color: '#4a7ab8' },
    { id: 'd8', sym: '8', cat: 'dots', color: '#4a7ab8' },
    { id: 'd9', sym: '9', cat: 'dots', color: '#4a7ab8' },
    // иероглифы (chars)
    { id: 'c1', sym: '一', cat: 'char', color: '#b84a4a' },
    { id: 'c2', sym: '二', cat: 'char', color: '#b84a4a' },
    { id: 'c3', sym: '三', cat: 'char', color: '#b84a4a' },
    { id: 'c4', sym: '四', cat: 'char', color: '#b84a4a' },
    { id: 'c5', sym: '五', cat: 'char', color: '#b84a4a' },
    { id: 'c6', sym: '六', cat: 'char', color: '#b84a4a' },
    { id: 'c7', sym: '七', cat: 'char', color: '#b84a4a' },
    { id: 'c8', sym: '八', cat: 'char', color: '#b84a4a' },
    { id: 'c9', sym: '九', cat: 'char', color: '#b84a4a' },
    // ветра (winds)
    { id: 'wE', sym: '東', cat: 'wind', color: '#8a6f4d' },
    { id: 'wS', sym: '南', cat: 'wind', color: '#8a6f4d' },
    { id: 'wW', sym: '西', cat: 'wind', color: '#8a6f4d' },
    { id: 'wN', sym: '北', cat: 'wind', color: '#8a6f4d' },
    // драконы (dragons)
    { id: 'rR', sym: '中', cat: 'dragon', color: '#c84a4a' },
    { id: 'rG', sym: '發', cat: 'dragon', color: '#4a8a4a' },
    { id: 'rB', sym: '白', cat: 'dragon', color: '#4a6a8a' },
    // цветы (flowers)
    { id: 'f1', sym: '梅', cat: 'flower', color: '#c84a8a' },
    { id: 'f2', sym: '蘭', cat: 'flower', color: '#8a4ac8' },
    { id: 'f3', sym: '竹', cat: 'flower', color: '#4a8a6a' },
    { id: 'f4', sym: '菊', cat: 'flower', color: '#c88a4a' }
  ];

  ENT.TILE_TYPES = TILE_TYPES;

  /* ---------- Раскладки: 20 паттернов ---------- */
  // Каждая раскладка — массив {x, y, z} (z = слой, 0 = низ).
  // Координаты в условных клетках; рендер масштабирует под экран.
  function makeLayout(name, lv) {
    var typesCount = Math.min(G.config.tiles.typesMax, G.config.tiles.typesBase + (lv - 1) * G.config.tiles.typesPerLevel);
    var layers = Math.min(G.config.tiles.layersMax, G.config.tiles.layersBase + Math.floor((lv - 1) / 4));
    var totalTiles = typesCount * 4;
    var cells = [];

    // Генерируем паттерн по имени
    var pattern = LAYOUT_PATTERNS[name] || LAYOUT_PATTERNS.turtle;
    var positions = pattern(layers);

    // Если позиций больше, чем нужно — обрезаем; если меньше — повторяем центр
    while (positions.length < totalTiles) {
      positions = positions.concat(pattern(layers));
    }
    positions = positions.slice(0, totalTiles);

    return { name: name, positions: positions, typesCount: typesCount, layers: layers };
  }

  var LAYOUT_PATTERNS = {
    turtle: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        var w = 8 - z * 2, h = 6 - z;
        var ox = z, oy = z * 0.5;
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) {
            if ((y === 0 || y === h - 1 || x === 0 || x === w - 1 || z > 0)) {
              p.push({ x: x + ox, y: y + oy, z: z });
            }
          }
        }
      }
      return p;
    },
    bridge: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        var w = 10 - z * 2;
        for (var x = 0; x < w; x++) {
          p.push({ x: x + z, y: 2 + z * 0.5, z: z });
          if (x < w / 2 - 1 || x > w / 2) {
            p.push({ x: x + z, y: 0 + z * 0.5, z: z });
            p.push({ x: x + z, y: 4 + z * 0.5, z: z });
          }
        }
      }
      return p;
    },
    pyramid: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        var w = 7 - z * 2;
        for (var y = 0; y < w; y++) {
          for (var x = 0; x < w - y; x++) {
            p.push({ x: x + y * 0.5 + z, y: y * 0.7 + z, z: z });
          }
        }
      }
      return p;
    },
    fortress: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        var s = 6 - z;
        for (var y = 0; y < s; y++) {
          for (var x = 0; x < s; x++) {
            if (x === 0 || x === s - 1 || y === 0 || y === s - 1 || (x + y) % 2 === 0) {
              p.push({ x: x + z * 0.5, y: y + z * 0.5, z: z });
            }
          }
        }
      }
      return p;
    },
    dragon: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        for (var i = 0; i < 12 - z * 2; i++) {
          var t = i / (12 - z * 2) * Math.PI * 2;
          var r = 3 - z * 0.5;
          p.push({ x: 4 + Math.cos(t) * r, y: 3 + Math.sin(t) * r * 0.6, z: z });
        }
      }
      return p;
    },
    butterfly: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        for (var y = 0; y < 5 - z; y++) {
          for (var x = 0; x < 8 - z; x++) {
            var dx = Math.abs(x - 3.5 + z * 0.5);
            var dy = Math.abs(y - 2 + z * 0.5);
            if (dx + dy < 3.5 - z * 0.5) {
              p.push({ x: x + z * 0.5, y: y + z * 0.5, z: z });
            }
          }
        }
      }
      return p;
    },
    cathedral: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        var w = 6 - z;
        for (var y = 0; y < 5 - z; y++) {
          for (var x = 0; x < w; x++) {
            if (y === 0 || y === 4 - z || x === 0 || x === w - 1 || (x === y && z > 0)) {
              p.push({ x: x + z, y: y + z * 0.5, z: z });
            }
          }
        }
      }
      return p;
    },
    arena: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        var r = 4 - z * 0.5;
        for (var a = 0; a < 12; a++) {
          var t = a / 12 * Math.PI * 2;
          p.push({ x: 4 + Math.cos(t) * r, y: 3 + Math.sin(t) * r, z: z });
        }
        if (z > 0) p.push({ x: 4, y: 3, z: z });
      }
      return p;
    },
    spiral: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        var n = 10 - z * 2;
        for (var i = 0; i < n; i++) {
          var t = i / n * Math.PI * 4;
          var r = 0.5 + i * 0.3;
          p.push({ x: 4 + Math.cos(t) * r, y: 3 + Math.sin(t) * r * 0.7, z: z });
        }
      }
      return p;
    },
    crown: function (layers) {
      var p = [];
      for (var z = 0; z < layers; z++) {
        for (var x = 0; x < 7 - z; x++) {
          var h = (x === 0 || x === 6 - z) ? 3 : (x === 3 - z * 0.5 ? 5 : 4);
          for (var y = 0; y < h - z; y++) {
            p.push({ x: x + z * 0.5, y: y + z * 0.5, z: z });
          }
        }
      }
      return p;
    }
  };
  // Дублируем с суффиксом 2 для разнообразия
  LAYOUT_PATTERNS.turtle2 = LAYOUT_PATTERNS.turtle;
  LAYOUT_PATTERNS.bridge2 = LAYOUT_PATTERNS.bridge;
  LAYOUT_PATTERNS.pyramid2 = LAYOUT_PATTERNS.pyramid;
  LAYOUT_PATTERNS.fortress2 = LAYOUT_PATTERNS.fortress;
  LAYOUT_PATTERNS.dragon2 = LAYOUT_PATTERNS.dragon;
  LAYOUT_PATTERNS.butterfly2 = LAYOUT_PATTERNS.butterfly;
  LAYOUT_PATTERNS.cathedral2 = LAYOUT_PATTERNS.cathedral;
  LAYOUT_PATTERNS.arena2 = LAYOUT_PATTERNS.arena;
  LAYOUT_PATTERNS.spiral2 = LAYOUT_PATTERNS.spiral;
  LAYOUT_PATTERNS.crown2 = LAYOUT_PATTERNS.crown;

  /* ---------- Генерация уровня: раскладка + плитки ---------- */
  // Возвращает { layout, tiles: [{id, typeId, x, y, z, active, removed}] }
  ENT.makeLevel = function (lv, rng) {
    var layoutName = G.config.layouts[(lv - 1) % G.config.layouts.length];
    var layout = makeLayout(layoutName, lv);

    // Выбираем типы плиток для этого уровня
    var typeIds = [];
    for (var i = 0; i < layout.typesCount; i++) {
      typeIds.push(TILE_TYPES[i % TILE_TYPES.length].id);
    }
    // Перемешиваем типы
    for (var i = typeIds.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = typeIds[i]; typeIds[i] = typeIds[j]; typeIds[j] = t;
    }

    // Каждый тип встречается 4 раза
    var pool = [];
    for (var i = 0; i < typeIds.length; i++) {
      for (var k = 0; k < 4; k++) pool.push(typeIds[i]);
    }
    // Перемешиваем пул
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }

    // Раскладываем плитки по позициям
    var tiles = [];
    for (var i = 0; i < layout.positions.length && i < pool.length; i++) {
      var pos = layout.positions[i];
      tiles.push({
        id: i,
        typeId: pool[i],
        x: pos.x, y: pos.y, z: pos.z,
        active: true,
        removed: false,
        selected: false,
        hinted: false
      });
    }

    return { layout: layout, tiles: tiles, level: lv };
  };

  /* ---------- Проверка доступности плитки ---------- */
  // Плитка доступна, если нет плитки НАД ней (z+1, перекрытие по x/y)
  // и нет плитки СЛЕВА или СПРАВА на том же слое (свободный бок).
  function isFree(tiles, t) {
    if (t.removed) return false;
    var halfW = 0.5, halfH = 0.5;
    var hasAbove = false, hasLeft = false, hasRight = false;
    for (var i = 0; i < tiles.length; i++) {
      var o = tiles[i];
      if (o.removed || o.id === t.id) continue;
      if (o.z === t.z + 1 && Math.abs(o.x - t.x) < halfW && Math.abs(o.y - t.y) < halfH) hasAbove = true;
      if (o.z === t.z && Math.abs(o.y - t.y) < halfH) {
        if (o.x < t.x && t.x - o.x < halfW * 2) hasLeft = true;
        if (o.x > t.x && o.x - t.x < halfW * 2) hasRight = true;
      }
    }
    return !hasAbove && (!hasLeft || !hasRight);
  }
  ENT.isFree = isFree;

  /* ---------- Поиск доступной пары ---------- */
  ENT.findPair = function (tiles) {
    var free = [];
    for (var i = 0; i < tiles.length; i++) {
      if (!tiles[i].removed && isFree(tiles, tiles[i])) free.push(tiles[i]);
    }
    for (var i = 0; i < free.length; i++) {
      for (var j = i + 1; j < free.length; j++) {
        if (free[i].typeId === free[j].typeId) return [free[i], free[j]];
      }
    }
    return null;
  };

  /* ---------- Подсказка: показать пару ---------- */
  ENT.hint = function (tiles) {
    var pair = ENT.findPair(tiles);
    if (pair) {
      pair[0].hinted = true;
      pair[1].hinted = true;
      return pair;
    }
    return null;
  };

  /* ---------- Перемешивание оставшихся ---------- */
  ENT.shuffle = function (tiles, rng) {
    var active = [];
    for (var i = 0; i < tiles.length; i++) {
      if (!tiles[i].removed) active.push(tiles[i]);
    }
    var typeIds = active.map(function (t) { return t.typeId; });
    for (var i = typeIds.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = typeIds[i]; typeIds[i] = typeIds[j]; typeIds[j] = t;
    }
    for (var i = 0; i < active.length; i++) {
      active[i].typeId = typeIds[i];
      active[i].hinted = false;
      active[i].selected = false;
    }
    return active.length;
  };

  /* ---------- Проверка завершения ---------- */
  ENT.isComplete = function (tiles) {
    for (var i = 0; i < tiles.length; i++) {
      if (!tiles[i].removed) return false;
    }
    return true;
  };

  /* ---------- Проверка тупика ---------- */
  ENT.isStuck = function (tiles) {
    return !ENT.findPair(tiles);
  };

  /* ---------- Тип по id ---------- */
  ENT.typeById = function (id) {
    for (var i = 0; i < TILE_TYPES.length; i++) {
      if (TILE_TYPES[i].id === id) return TILE_TYPES[i];
    }
    return TILE_TYPES[0];
  };
})(window.GAME);
