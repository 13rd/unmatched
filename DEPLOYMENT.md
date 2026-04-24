# Руководство по развертыванию

## Локальное развертывание

### Требования
- Node.js 14+ 
- npm 6+

### Установка
```bash
npm install
npm start
```

Игра будет доступна на `http://localhost:3000/setup.html`

## Развертывание на сервере

### 1. Использование PM2 (рекомендуется)

```bash
# Установка PM2
npm install -g pm2

# Запуск приложения
pm2 start server.js --name "unmatched-game"

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Просмотр логов
pm2 logs unmatched-game

# Остановка
pm2 stop unmatched-game

# Перезапуск
pm2 restart unmatched-game
```

### 2. Использование systemd (Linux)

Создайте файл `/etc/systemd/system/unmatched-game.service`:

```ini
[Unit]
Description=Unmatched Multiplayer Game
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/unmatched_js_table
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl daemon-reload
sudo systemctl enable unmatched-game
sudo systemctl start unmatched-game
sudo systemctl status unmatched-game
```

### 3. Использование Docker

Создайте `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

Создайте `docker-compose.yml`:

```yaml
version: '3.8'

services:
  game:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

Запуск:
```bash
docker-compose up -d
```

## Настройка Nginx (обратный прокси)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket поддержка
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## SSL/HTTPS с Let's Encrypt

```bash
# Установка certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автообновление
sudo certbot renew --dry-run
```

## Переменные окружения

Создайте файл `.env`:

```env
PORT=3000
NODE_ENV=production
MAX_BUFFER_SIZE=100000000
PING_TIMEOUT=60000
```

Обновите `server.js`:

```javascript
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const MAX_BUFFER_SIZE = process.env.MAX_BUFFER_SIZE || 1e8;
```

## Мониторинг

### Логирование
```bash
# PM2
pm2 logs unmatched-game

# systemd
journalctl -u unmatched-game -f

# Docker
docker-compose logs -f
```

### Метрики
```bash
# PM2
pm2 monit

# Установка PM2 web dashboard
pm2 install pm2-server-monit
```

## Безопасность

### 1. Firewall
```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Ограничение подключений
Добавьте в `server.js`:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100 // максимум 100 запросов
});

app.use(limiter);
```

### 3. Helmet для безопасности заголовков
```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

## Резервное копирование

Комнаты хранятся в памяти. Для сохранения состояния рассмотрите:
- Redis для хранения комнат
- MongoDB для истории игр
- Регулярные снапшоты состояния

## Масштабирование

Для нескольких серверов используйте Redis adapter:

```bash
npm install @socket.io/redis-adapter redis
```

```javascript
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const pubClient = createClient({ host: "localhost", port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

## Производительность

- Используйте Node.js кластеризацию
- Настройте CDN для статических файлов
- Включите gzip сжатие
- Оптимизируйте изображения перед загрузкой

## Поддержка

При возникновении проблем проверьте:
1. Логи сервера
2. Консоль браузера
3. Сетевые запросы (вкладка Network в DevTools)
4. Статус WebSocket соединения
