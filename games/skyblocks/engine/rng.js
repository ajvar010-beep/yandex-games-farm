/* engine/rng.js — детерминированный RNG. Один seed -> одна игра. Math.random в игровой логике ЗАПРЁЩЕН. */
window.Engine = window.Engine || {};
(function (E) {
  'use strict';
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedFromString(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function Rng(seed) {
    if (typeof seed === 'string') seed = seedFromString(seed);
    this.seed = seed >>> 0;
    this._next = mulberry32(this.seed);
  }
  Rng.prototype.float = function () { return this._next(); };
  Rng.prototype.range = function (a, b) { return a + (b - a) * this._next(); };
  Rng.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this._next() * arr.length) % arr.length]; };
  Rng.prototype.chance = function (p) { return this._next() < p; };
  Rng.prototype.angle = function () { return this._next() * Math.PI * 2; };
  Rng.prototype.subSeed = function (n) { return (this.seed ^ Math.imul((n | 0) + 1, 2654435761)) >>> 0; };
  E.Rng = Rng;
  E.seedFromString = seedFromString;
})(window.Engine);
