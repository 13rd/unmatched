# Unmatched Game - Multiplayer Card Game

Многопользовательская карточная игра с поддержкой WebSocket синхронизации.

## Возможности

- 🎮 Многопользовательский режим (2 игрока + наблюдатели)
- 🔀 Перемешивание колоды
- ↩️ Возврат карт из сброса
- 🔍 Увеличенный просмотр карт
- 👁️ Скрытие карт противника
- 💾 Сохранение сессии при перезагрузке
- 🔐 Система авторизации пользователей
- 🎨 Настраиваемые колоды и игровое поле

## Быстрый старт (локально)

```bash
# Установка зависимостей
npm install

# Запуск сервера
npm start

# Откройте в браузере
http://localhost:3000/auth.html
```

## Развертывание на VPS с Docker

### Требования
- VPS с Ubuntu 20.04+
- Docker и Docker Compose
- Открытый порт 3000

### Автоматическое развертывание

```bash
# 1. Загрузите проект на VPS
scp -r /path/to/unmatched_js_table user@your-vps-ip:~/

# 2. Подключитесь к VPS
ssh user@your-vps-ip

# 3. Перейдите в директорию проекта
cd ~/unmatched_js_table

# 4. Запустите скрипт развертывания
./deploy.sh
```

### Ручное развертывание

```bash
# Сборка и запуск
docker-compose up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

## Доступ к приложению

После развертывания приложение доступно по адресу:
- **Локально:** `http://localhost:3000/auth.html`
- **VPS:** `http://YOUR_VPS_IP:3000/auth.html`

## Структура проекта

```
unmatched_js_table/
├── auth.html              # Страница авторизации
├── auth.js                # Логика авторизации
├── auth.css               # Стили авторизации
├── setup.html             # Настройки игры
├── setup.js               # Логика настроек
├── setup.css              # Стили настроек
├── index.html             # Игровое поле
├── game.js                # Игровая логика
├── style.css              # Стили игры
├── server.js              # Серверная логика
├── editor.html            # Редактор колод
├── editor.js              # Логика редактора
├── Dockerfile             # Docker конфигурация
├── docker-compose.yml     # Docker Compose конфигурация
├── deploy.sh              # Скрипт развертывания
└── package.json           # Зависимости Node.js
```

## Документация

- [DEPLOYMENT.md](DEPLOYMENT.md) - Подробная инструкция по развертыванию
- [AUTH.md](AUTH.md) - Документация по системе авторизации
- [VISIBILITY.md](VISIBILITY.md) - Документация по видимости карт
- [SUMMARY.md](SUMMARY.md) - Итоговое резюме функций

## Технологии

- **Backend:** Node.js, Express, Socket.IO
- **Frontend:** Vanilla JavaScript, HTML5 Canvas
- **Deployment:** Docker, Docker Compose
- **Storage:** localStorage, sessionStorage

## Управление Docker контейнером

```bash
# Просмотр логов
docker-compose logs -f

# Перезапуск
docker-compose restart

# Обновление приложения
docker-compose down
docker-compose up -d --build

# Просмотр статуса
docker-compose ps

# Использование ресурсов
docker stats unmatched-game
```

## Настройка порта

Для изменения порта отредактируйте `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # Внешний:Внутренний
```

## Настройка с Nginx (опционально)

Для использования доменного имени и SSL см. [DEPLOYMENT.md](DEPLOYMENT.md)

## Безопасность

- Настройте firewall: `sudo ufw allow 3000/tcp`
- Используйте SSL сертификаты для production
- Регулярно обновляйте зависимости: `npm audit fix`

## Решение проблем

### Порт занят
```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

### Контейнер не запускается
```bash
docker-compose logs
docker-compose down
docker-compose up -d --build --force-recreate
```

### Проблемы с авторизацией
Очистите localStorage в браузере и попробуйте снова.

## Разработка

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm start

# Просмотр логов
tail -f logs/app.log
```

## Лицензия

MIT

## Автор

Разработано для игры Unmatched

## Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs`
2. Проверьте статус: `docker-compose ps`
3. Проверьте порты: `sudo netstat -tulpn | grep 3000`

---

**Готово к использованию!** 🎉
