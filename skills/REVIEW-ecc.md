# REVIEW — everything-claude-code (worldflowai/everything-claude-code)

Источник: https://github.com/worldflowai/everything-claude-code (клонирован 2026-11-05, shallow).
Установлено 11 скилов в skills/<name>/ (SKILL.md + ресурсы).

## Результат сканирования
Grep по инъекциям/эксфильтрации (ignore previous, system prompt, curl/wget, eval, base64,
ключи, токены, ssh, rm -rf, fetch/XHR): **совпадений в инструкциях НЕТ** — все хиты
являются примерами кода внутри SKILL.md (JWT-валидация, CSRF-токены, bcrypt и т.п. в
backend-patterns / security-review / clickhouse-io — это учебные сниппеты, не команды агенту).

## Состав (11 скилов)
- backend-patterns, frontend-patterns — паттерны кода (React/Node), сниппеты.
- clickhouse-io — работа с ClickHouse (SQL, вставки).
- coding-standards — стиль/линт/ревью.
- security-review — чеклист безопасности (секреты, JWT, CSRF, CORS).
- tdd-workflow — TDD, 80%+ покрытие.
- verification-loop — цикл verify-перед-done.
- eval-harness — оценка качества сессии.
- continuous-learning — извлечение паттернов из сессии (config.json + evaluate-session.sh — Stop-hook, НЕ активирован).
- strategic-compact — управление контекстом/компактностью (suggest-compact.sh — НЕ активирован).
- project-guidelines-example — пример CLAUDE.md.

## Не установлено / не активировано
- Хуки (Stop/UserPromptSubmit) и .sh-скрипты НЕ подключены к settings.json — лежат как файлы.
- Ничего не добавлено в PATH/автозапуск. Нет сетевых вызовов на этапе установки.

## Вывод
Скиллы — статические плейбуки (markdown), безопасны. Исполняемые .sh не активируются без явной настройки хуков.
