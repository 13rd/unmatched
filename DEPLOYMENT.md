# Развертывание на VPS с Docker

## Требования

- VPS с Ubuntu 20.04+ (или другой Linux дистрибутив)
- Docker и Docker Compose установлены
- Открытый порт 3000 (или другой по вашему выбору)
- Минимум 512MB RAM, 1GB рекомендуется

## Быстрый старт

### 1. Установка Docker (если не установлен)

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавляем пользователя в группу docker
sudo usermod -aG docker $USER

# Устанавливаем Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Перезагружаем сессию
newgrp docker
```

### 2. Загрузка проекта на VPS

```bash
# Создаем директорию для проекта
mkdir -p ~/unmatched-game
cd ~/unmatched-game

# Загружаем файлы проекта (используйте один из методов)

# Метод 1: Через Git
git clone <your-repo-url> .

# Метод 2: Через SCP с локальной машины
# На локальной машине выполните:
# scp -r /home/nikita/Python/unmatched_js_table/* user@your-vps-ip:~/unmatched-game/

# Метод 3: Через rsync (рекомендуется)
# rsync -avz --exclude 'node_modules' /home/nikita/Python/unmatched_js_table/ user@your-vps-ip:~/unmatched-game/
```

### 3. Запуск приложения

```bash
# Переходим в директорию проекта
cd ~/unmatched-game

# Собираем и запускаем контейнер
docker-compose up -d

# Проверяем статус
docker-compose ps

# Просмотр логов
docker-compose logs -f
```

### 4. Проверка работы

```bash
# Проверяем, что контейнер запущен
docker ps

# Проверяем доступность приложения
curl http://localhost:3000

# Или откройте в браузере
# http://YOUR_VPS_IP:3000/auth.html
```

## Управление приложением

### Остановка
```bash
docker-compose down
```

### Перезапуск
```bash
docker-compose restart
```

### Обновление приложения
```bash
# Останавливаем контейнер
docker-compose down

# Загружаем новые файлы (git pull или scp)
git pull

# Пересобираем и запускаем
docker-compose up -d --build
```

### Просмотр логов
```bash
# Все логи
docker-compose logs

# Последние 100 строк
docker-compose logs --tail=100

# В реальном времени
docker-compose logs -f
```

## Настройка порта

Если хотите использовать другой порт (например, 80 или 8080):

1. Отредактируйте `docker-compose.yml`:
```yaml
ports:
  - "80:3000"  # Внешний:Внутренний
```

2. Перезапустите:
```bash
docker-compose down
docker-compose up -d
```

## Настройка Nginx (опционально, для production)

Для использования доменного имени и SSL:

### 1. Установка Nginx
```bash
sudo apt install nginx -y
```

### 2. Создание конфигурации
```bash
sudo nano /etc/nginx/sites-available/unmatched-game
```

Добавьте:
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 3. Активация конфигурации
```bash
sudo ln -s /etc/nginx/sites-available/unmatched-game /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Установка SSL (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Настройка Firewall

```bash
# Разрешаем порт 3000 (если используете напрямую)
sudo ufw allow 3000/tcp

# Или разрешаем Nginx (если используете)
sudo ufw allow 'Nginx Full'

# Включаем firewall
sudo ufw enable
```

## Автозапуск при перезагрузке

Docker Compose автоматически настроен на автозапуск (`restart: unless-stopped`).

Проверка:
```bash
# Перезагружаем VPS
sudo reboot

# После перезагрузки проверяем
docker ps
```

## Мониторинг

### Использование ресурсов
```bash
docker stats unmatched-game
```

### Проверка здоровья
```bash
# Проверка работы приложения
curl http://localhost:3000/auth.html

# Проверка логов на ошибки
docker-compose logs | grep -i error
```

## Резервное копирование

```bash
# Создаем backup директорию
mkdir -p ~/backups

# Копируем важные файлы
tar -czf ~/backups/unmatched-game-$(date +%Y%m%d).tar.gz ~/unmatched-game

# Автоматическое резервное копирование (cron)
crontab -e

# Добавьте строку (backup каждый день в 3:00)
0 3 * * * tar -czf ~/backups/unmatched-game-$(date +\%Y\%m\%d).tar.gz ~/unmatched-game
```

## Решение проблем

### Контейнер не запускается
```bash
# Проверяем логи
docker-compose logs

# Проверяем порт
sudo netstat -tulpn | grep 3000

# Пересобираем контейнер
docker-compose down
docker-compose up -d --build --force-recreate
```

### Порт занят
```bash
# Находим процесс
sudo lsof -i :3000

# Останавливаем процесс
sudo kill -9 <PID>
```

### Недостаточно памяти
```bash
# Проверяем использование памяти
free -h

# Добавляем swap (если нужно)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Безопасность

### 1. Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Настройка SSH (рекомендуется)
```bash
# Отключаем вход по паролю, используем только ключи
sudo nano /etc/ssh/sshd_config

# Измените:
# PasswordAuthentication no
# PermitRootLogin no

sudo systemctl restart sshd
```

### 3. Fail2ban (защита от брутфорса)
```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Производительность

### Оптимизация для production

1. Отредактируйте `docker-compose.yml`:
```yaml
services:
  unmatched-game:
    # ... существующие настройки ...
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

2. Перезапустите:
```bash
docker-compose down
docker-compose up -d
```

## Доступ к приложению

После успешного развертывания:

- **Прямой доступ:** `http://YOUR_VPS_IP:3000/auth.html`
- **С Nginx:** `http://your-domain.com/auth.html`
- **С SSL:** `https://your-domain.com/auth.html`

## Полезные команды

```bash
# Просмотр всех контейнеров
docker ps -a

# Удаление всех остановленных контейнеров
docker container prune

# Удаление неиспользуемых образов
docker image prune -a

# Полная очистка Docker
docker system prune -a --volumes

# Вход в контейнер
docker exec -it unmatched-game sh

# Копирование файлов из контейнера
docker cp unmatched-game:/app/logs ./logs
```

## Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs`
2. Проверьте статус: `docker-compose ps`
3. Проверьте порты: `sudo netstat -tulpn | grep 3000`
4. Проверьте firewall: `sudo ufw status`

---

**Готово!** Ваше приложение теперь доступно по IP адресу VPS на порту 3000.
