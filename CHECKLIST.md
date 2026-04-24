# 📋 Чеклист развертывания на VPS

## ✅ Подготовка (выполнено)

- [x] Dockerfile создан
- [x] docker-compose.yml создан
- [x] .dockerignore создан
- [x] deploy.sh создан и исполняемый
- [x] Документация написана
- [x] README.md обновлен
- [x] Все функции реализованы и протестированы

## 📦 Файлы для развертывания

Убедитесь, что следующие файлы присутствуют:

```
✓ Dockerfile
✓ docker-compose.yml
✓ .dockerignore
✓ deploy.sh
✓ package.json
✓ package-lock.json
✓ server.js
✓ auth.html, auth.js, auth.css
✓ setup.html, setup.js, setup.css
✓ index.html, game.js, style.css
✓ editor.html, editor.js, editor.css
✓ background.png (или другие ресурсы)
```

## 🚀 Шаги развертывания на VPS

### 1. Подготовка локальной машины

```bash
cd /home/nikita/Python/unmatched_js_table

# Создаем архив (исключая ненужные файлы)
tar -czf unmatched-game.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.gitignore' \
  .

# Проверяем размер архива
ls -lh unmatched-game.tar.gz
```

### 2. Загрузка на VPS

```bash
# Замените YOUR_VPS_IP и user на ваши данные
scp unmatched-game.tar.gz user@YOUR_VPS_IP:~/
```

### 3. Подключение к VPS

```bash
ssh user@YOUR_VPS_IP
```

### 4. Развертывание на VPS

```bash
# Создаем директорию
mkdir -p ~/unmatched-game
cd ~/unmatched-game

# Распаковываем
tar -xzf ~/unmatched-game.tar.gz

# Делаем скрипт исполняемым (если нужно)
chmod +x deploy.sh

# Запускаем автоматическое развертывание
./deploy.sh
```

### 5. Проверка

```bash
# Проверяем статус контейнера
docker-compose ps

# Проверяем логи
docker-compose logs

# Проверяем доступность
curl http://localhost:3000/auth.html
```

### 6. Открываем в браузере

```
http://YOUR_VPS_IP:3000/auth.html
```

## 🔧 Настройка firewall (важно!)

```bash
# Разрешаем порт 3000
sudo ufw allow 3000/tcp

# Проверяем статус
sudo ufw status
```

## 🌐 Настройка домена (опционально)

### Если у вас есть домен:

1. **Настройте DNS:**
   - Добавьте A-запись: `your-domain.com` → `YOUR_VPS_IP`

2. **Установите Nginx:**
   ```bash
   sudo apt update
   sudo apt install nginx -y
   ```

3. **Создайте конфигурацию:**
   ```bash
   sudo nano /etc/nginx/sites-available/unmatched-game
   ```
   
   Вставьте конфигурацию из DEPLOYMENT.md

4. **Активируйте:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/unmatched-game /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Установите SSL:**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d your-domain.com
   ```

## 📊 Мониторинг

```bash
# Просмотр логов в реальном времени
docker-compose logs -f

# Использование ресурсов
docker stats unmatched-game

# Статус контейнера
docker-compose ps
```

## 🔄 Обновление приложения

```bash
cd ~/unmatched-game

# Останавливаем контейнер
docker-compose down

# Загружаем новые файлы (через scp или git pull)
# ...

# Пересобираем и запускаем
docker-compose up -d --build
```

## 🛑 Остановка приложения

```bash
docker-compose down
```

## 🔥 Полная очистка (если нужно начать заново)

```bash
docker-compose down
docker system prune -a --volumes
rm -rf ~/unmatched-game
```

## ✅ Финальная проверка

После развертывания проверьте:

- [ ] Приложение доступно по `http://YOUR_VPS_IP:3000/auth.html`
- [ ] Можно войти и создать комнату
- [ ] Второй игрок может присоединиться
- [ ] Карты работают корректно
- [ ] Перемешивание колоды работает
- [ ] Сброс и возврат карт работает
- [ ] Увеличенный просмотр работает
- [ ] Видимость карт работает правильно
- [ ] Перезагрузка страницы сохраняет сессию
- [ ] Логи не показывают ошибок

## 📞 Поддержка

Если что-то не работает:

1. **Проверьте логи:**
   ```bash
   docker-compose logs
   ```

2. **Проверьте порты:**
   ```bash
   sudo netstat -tulpn | grep 3000
   ```

3. **Проверьте firewall:**
   ```bash
   sudo ufw status
   ```

4. **Перезапустите контейнер:**
   ```bash
   docker-compose restart
   ```

## 🎉 Готово!

Ваше приложение развернуто и готово к использованию!

**Доступ:** `http://YOUR_VPS_IP:3000/auth.html`

---

**Дата:** 24 апреля 2026  
**Версия:** 1.0.0  
**Статус:** Готово к production ✅
