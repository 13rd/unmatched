# 🚀 Быстрое развертывание на VPS

## Шаг 1: Подготовка файлов

На вашей локальной машине упакуйте проект:

```bash
cd /home/nikita/Python/unmatched_js_table
tar -czf unmatched-game.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.log' \
  .
```

## Шаг 2: Загрузка на VPS

```bash
# Замените YOUR_VPS_IP на IP адрес вашего VPS
scp unmatched-game.tar.gz user@YOUR_VPS_IP:~/
```

## Шаг 3: Подключение к VPS

```bash
ssh user@YOUR_VPS_IP
```

## Шаг 4: Распаковка и развертывание

```bash
# Создаем директорию
mkdir -p ~/unmatched-game
cd ~/unmatched-game

# Распаковываем
tar -xzf ~/unmatched-game.tar.gz

# Запускаем автоматическое развертывание
chmod +x deploy.sh
./deploy.sh
```

## Шаг 5: Проверка

После успешного развертывания откройте в браузере:

```
http://YOUR_VPS_IP:3000/auth.html
```

## Альтернативный метод (через Git)

Если проект в Git репозитории:

```bash
# На VPS
git clone YOUR_REPO_URL ~/unmatched-game
cd ~/unmatched-game
./deploy.sh
```

## Управление приложением

```bash
# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Обновление
git pull  # если используете Git
docker-compose down
docker-compose up -d --build
```

## Настройка домена (опционально)

1. Укажите A-запись домена на IP вашего VPS
2. Установите Nginx и настройте reverse proxy (см. DEPLOYMENT.md)
3. Установите SSL сертификат через Let's Encrypt

## Готово! 🎉

Ваше приложение теперь доступно по адресу:
- `http://YOUR_VPS_IP:3000/auth.html`

Для production рекомендуется:
- Настроить Nginx
- Установить SSL сертификат
- Настроить firewall
- Настроить автоматические backup
