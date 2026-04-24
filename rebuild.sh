#!/bin/bash

# Скрипт для пересборки и перезапуска Docker контейнера

echo "🛑 Останавливаем контейнер..."
docker-compose down

echo "🔨 Пересобираем образ..."
docker-compose build --no-cache

echo "🚀 Запускаем контейнер..."
docker-compose up -d

echo "⏳ Ожидаем запуска..."
sleep 3

echo "📊 Статус контейнера:"
docker-compose ps

echo ""
echo "✅ Готово! Проверьте логи:"
echo "   docker-compose logs -f"
