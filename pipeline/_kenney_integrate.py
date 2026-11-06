import io

# ---------- config: 5 цветов под Kenney ----------
p = 'C:/GameFactory/games/parkingescape/game/config.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("tileColors: ['#e03131', '#1c7ed6', '#f59f00', '#37b24d', '#7048e8', '#f06595', '#e9ecef'],",
              "tileColors: ['#e03131', '#1c7ed6', '#f59f00', '#37b24d', '#343a40'],")
s = s.replace("colors: lv < 5 ? 3 : lv < 10 ? 4 : lv < 18 ? 5 : 6,",
              "colors: lv < 5 ? 3 : lv < 10 ? 4 : 5,")
io.open(p, 'w', encoding='utf-8').write(s)

# ---------- logic: variant per car ----------
p = 'C:/GameFactory/games/parkingescape/game/logic.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("grid[r2][c] = { t: 'arrow', dir: d, color: rng.int(0, spec.colors - 1), special: 0, frozen: 0 };",
              "grid[r2][c] = { t: 'arrow', dir: d, color: rng.int(0, spec.colors - 1), special: 0, frozen: 0, variant: rng.int(1, 5) };")
s = s.replace("var g = [[{ t: 'arrow', dir: 0, color: 0, special: 0, frozen: 0 }]];",
              "var g = [[{ t: 'arrow', dir: 0, color: 0, special: 0, frozen: 0, variant: 1 }]];")
io.open(p, 'w', encoding='utf-8').write(s)

# ---------- art: drop procedural cars, load Kenney sprites ----------
p = 'C:/GameFactory/games/parkingescape/game/art.js'
s = io.open(p, encoding='utf-8').read()
start = s.index('  /* ---------- машины: чистый top-down')
end = s.index('  /* эвакуатор: жёлтый тягач')
car_block = r'''  /* ---------- машины: официальный Kenney Racing Pack (CC0) ----------
     5 цветов × 5 кузовов, PNG лежат локально в assets/cars/.
     Спрайты смотрят носом вверх; drawTile поворачивает по dir. */
  var CAR_COLORS = ['red', 'blue', 'yellow', 'green', 'black'];
  var CAR_VARIANTS = 5;

  function carFallback(ctx, color, size) {
    ctx.fillStyle = color;
    rr(ctx, -size * 0.24, -size * 0.46, size * 0.48, size * 0.92, size * 0.10); ctx.fill();
    ctx.fillStyle = 'rgba(160,205,235,0.9)';
    rr(ctx, -size * 0.17, -size * 0.22, size * 0.34, size * 0.16, size * 0.03); ctx.fill();
    rr(ctx, -size * 0.17, size * 0.06, size * 0.34, size * 0.12, size * 0.03); ctx.fill();
  }

'''
s = s[:start] + car_block + s[end:]

# init: image rows instead of makeCar
old = """  ART.init = function () {
    if (ART.tiles) return;
    var cols = G.config.palette.tileColors;
    ART.tiles = [];
    for (var i = 0; i < cols.length; i++) ART.tiles.push(makeCar(cols[i], STYLES[i % STYLES.length]));
    ART.bomb = makeTow();
    ART.wall = makeWall();
    ART.crate = makeBlock();
  };"""
new = """  ART.init = function () {
    if (ART.cars) return;
    ART.cars = []; ART.tiles = [];
    for (var c = 0; c < CAR_COLORS.length; c++) {
      var row = [];
      for (var v = 1; v <= CAR_VARIANTS; v++) {
        var im = new Image();
        im.src = 'assets/cars/car_' + CAR_COLORS[c] + '_' + v + '.png';
        row.push(im);
      }
      ART.cars.push(row);
      ART.tiles.push(row[0]);
    }
    ART.bomb = makeTow();
    ART.wall = makeWall();
    ART.crate = makeBlock();
  };

  /* дождаться загрузки всех PNG (для промо и первого кадра) */
  ART.preload = function () {
    ART.init();
    var waits = [];
    for (var c = 0; c < ART.cars.length; c++) {
      for (var v = 0; v < ART.cars[c].length; v++) {
        (function (im) {
          waits.push(new Promise(function (res) {
            if (im.complete && im.naturalWidth) { res(); return; }
            im.onload = res; im.onerror = res;
          }));
        })(ART.cars[c][v]);
      }
    }
    return Promise.all(waits);
  };"""
assert old in s, 'init'
s = s.replace(old, new)

old = """  ART.drawTile = function (ctx, colorIdx, x, y, size, dir, special, alpha, scale) {
    if (!ART.tiles) ART.init();
    var img = (special === 'bomb') ? ART.bomb : ART.tiles[colorIdx % ART.tiles.length];
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y);
    if (scale && scale !== 1) ctx.scale(scale, scale);
    if (special !== 'bomb') ctx.rotate(dir * Math.PI / 2);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  };"""
new = """  ART.drawTile = function (ctx, colorIdx, x, y, size, dir, special, alpha, scale, variant) {
    if (!ART.cars) ART.init();
    var img = null;
    if (special === 'bomb') img = ART.bomb;
    else {
      var row = ART.cars[colorIdx % ART.cars.length];
      img = row[((variant || 1) - 1) % row.length];
      if (!img || !img.complete || !img.naturalWidth) img = null;
    }
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y);
    if (scale && scale !== 1) ctx.scale(scale, scale);
    if (special !== 'bomb') ctx.rotate(dir * Math.PI / 2);
    if (special === 'bomb') {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else if (img) {
      var hh = size * 0.94;
      var ww = hh * img.naturalWidth / img.naturalHeight;
      ctx.drawImage(img, -ww / 2, -hh / 2, ww, hh);
    } else {
      carFallback(ctx, G.config.palette.tileColors[colorIdx % 5], size);
    }
    ctx.restore();
  };"""
assert old in s, 'drawTile'
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8').write(s)

# ---------- scenes: pass variant ----------
p = 'C:/GameFactory/games/parkingescape/game/scenes.js'
s = io.open(p, encoding='utf-8').read()
s = s.replace("G.art.drawTile(ctx, cell.color, x, y, this.cell * 0.92, cell.dir, cell.special, 1, 1);",
              "G.art.drawTile(ctx, cell.color, x, y, this.cell * 0.92, cell.dir, cell.special, 1, 1, cell.variant);")
s = s.replace("G.art.drawTile(ctx, gh.color, gh.x + dx, gh.y + dy, gh.size * (1 + k * 0.25), gh.dir, gh.special, 1 - k, 1);",
              "G.art.drawTile(ctx, gh.color, gh.x + dx, gh.y + dy, gh.size * (1 + k * 0.25), gh.dir, gh.special, 1 - k, 1, gh.variant);")
# ghosts carry variant (two creation sites)
s = s.replace("x: px, y: py, size: self.cell * 0.92, color: e.cell.color, dir: dir,\n            special: e.cell.special, t: -e.step * 0.05, life: 0.5",
              "x: px, y: py, size: self.cell * 0.92, color: e.cell.color, dir: dir,\n            special: e.cell.special, variant: e.cell.variant, t: -e.step * 0.05, life: 0.5")
s = s.replace("self.ghosts.push({ x: px, y: py, size: self.cell * 0.92, color: e.cell.color, dir: 0, special: 'bomb', t: 0, life: 0.45 });",
              "self.ghosts.push({ x: px, y: py, size: self.cell * 0.92, color: e.cell.color, dir: 0, special: 'bomb', variant: e.cell.variant, t: 0, life: 0.45 });")
io.open(p, 'w', encoding='utf-8').write(s)
print('kenney integrated')
