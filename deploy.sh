#!/bin/bash

# Скрипт для быстрого развертывания на VPS

set -e

echo "🚀 Начинаем развертывание Unmatched Game..."

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Устанавливаем..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker установлен"
fi

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Устанавливаем..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose установлен"
fi

# Останавливаем старый контейнер если есть
if [ "$(docker ps -q -f name=unmatched-game)" ]; then
    echo "🛑 Останавливаем старый контейнер..."
    docker-compose down
fi

# Собираем и запускаем
echo "🔨 Собираем Docker образ..."
docker-compose build

echo "🚀 Запускаем приложение..."
docker-compose up -d

# Ждем запуска
echo "⏳ Ожидаем запуска приложения..."
sleep 5

# Проверяем статус
if [ "$(docker ps -q -f name=unmatched-game)" ]; then
    echo "✅ Приложение успешно запущено!"
    echo ""
    echo "📍 Доступ к приложению:"
    echo "   http://$(hostname -I | awk '{print $1}'):3000/auth.html"
    echo ""
    echo "📊 Просмотр логов:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 Остановка приложения:"
    echo "   docker-compose down"
else
    echo "❌ Ошибка запуска. Проверьте логи:"
    echo "   docker-compose logs"
    exit 1
fi
