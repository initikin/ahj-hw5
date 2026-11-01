# Чат

[![Build and deploy](https://github.com/initikin/ahj-hw5/actions/workflows/deploy.yml/badge.svg)](https://github.com/initikin/ahj-hw5/actions/workflows/deploy.yml)

WebSocket-чат. Задание без звёздочки.

[GitHub Pages](https://initikin.github.io/ahj-hw5/) — после подключения сервера.

Запуск: `npm ci`, затем `npm run server` и `npm start` в двух терминалах.

Проверка: `npm run lint`. Сборка: `npm run build`.

Сервер: `render.yaml`. Для GitHub Pages задайте переменную `CHAT_API_URL` с HTTPS-адресом сервера и выберите Source → GitHub Actions.

Публикация запускается после настройки `CHAT_API_URL`.
