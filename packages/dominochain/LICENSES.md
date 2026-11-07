# LICENSES — dominochain

Внешних ассетов нет.

- Вся графика рисуется кодом (`games/dominochain/game/art.js`), ни одного PNG,
  SVG, шрифта или звукового файла в билде.
- Звук — процедурный WebAudio (`engine/audio.js`, собственный код фабрики).
- Шрифты — системные (`Georgia`, `system-ui`), не распространяются.
- `engine/` — копия 1:1 из `games/parkingescape/engine`, собственный код фабрики.
- Ноль сетевых запросов в рантайме; игра работает с `file://` через `sdk-stub.js`.
