// Предопределенные цветовые пары (насыщенный и менее насыщенный)
const COLOR_PAIRS = [
    { main: '#e53e3e', extra: '#fc8181' },  // Красный
    { main: '#3182ce', extra: '#63b3ed' },  // Синий
    { main: '#38a169', extra: '#68d391' },  // Зеленый
    { main: '#d69e2e', extra: '#f6e05e' },  // Желтый
    { main: '#805ad5', extra: '#b794f4' },  // Фиолетовый
    { main: '#dd6b20', extra: '#f6ad55' },  // Оранжевый
    { main: '#c53030', extra: '#f56565' },  // Темно-красный
    { main: '#2c5282', extra: '#4299e1' },  // Темно-синий
    { main: '#276749', extra: '#48bb78' },  // Темно-зеленый
    { main: '#975a16', extra: '#ecc94b' },  // Темно-желтый
    { main: '#553c9a', extra: '#9f7aea' },  // Темно-фиолетовый
    { main: '#9c4221', extra: '#ed8936' },  // Темно-оранжевый
    { main: '#e91e63', extra: '#f48fb1' },  // Розовый
    { main: '#00bcd4', extra: '#80deea' },  // Голубой
    { main: '#4caf50', extra: '#a5d6a7' },  // Светло-зеленый
    { main: '#ff9800', extra: '#ffcc80' },  // Янтарный
    { main: '#9e9e9e', extra: '#e0e0e0' },  // Серый
    { main: '#795548', extra: '#bcaaa4' },  // Коричневый
    { main: '#607d8b', extra: '#b0bec5' },  // Сине-серый
    { main: '#8e24aa', extra: '#ce93d8' }   // Пурпурный
];

// Класс для точек на поле
class Point {
    constructor(x, y, id) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.radius = 15;
        this.color = '#4a5568';
        this.hoverColor = '#2d3748';
        this.isHovered = false;
        this.chip = null;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isHovered ? this.hoverColor : this.color;
        ctx.fill();
        ctx.strokeStyle = '#1a202c';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    containsPoint(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    attachChip(chip) {
        this.chip = chip;
        chip.x = this.x;
        chip.y = this.y;
        chip.attachedPoint = this;
    }

    detachChip() {
        if (this.chip) {
            this.chip.attachedPoint = null;
            this.chip = null;
        }
    }
}

// Класс для фишек
class Chip {
    constructor(x, y, color, id, isMain = false, player = null, image = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.id = id;
        this.radius = isMain ? 35 : 25;
        this.isMain = isMain;
        this.isDragging = false;
        this.attachedPoint = null;
        this.player = player;
        this.hp = isMain ? 10 : 5;
        this.maxHp = isMain ? 10 : 5;
        this.image = null;
        
        // Загружаем изображение если оно есть
        if (image) {
            this.image = new Image();
            this.image.src = image;
        }
    }

    draw(ctx) {
        // Рисуем цветной круг
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = this.isMain ? 4 : 3;
        ctx.stroke();
        
        // Рисуем изображение персонажа поверх круга
        if (this.image && this.image.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius - 3, 0, Math.PI * 2);
            ctx.clip();
            
            const imgSize = (this.radius - 3) * 2;
            ctx.drawImage(
                this.image,
                this.x - (this.radius - 3),
                this.y - (this.radius - 3),
                imgSize,
                imgSize
            );
            
            ctx.restore();
        }
        
        // Внутренняя обводка для визуального эффекта
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius - 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    containsPoint(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
}

// Основной класс игрового поля
class GameBoard {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this.chips = [];
        this.draggedChip = null;
        this.snapDistance = 80;
        this.hpPanel = null;
        this.playerRole = null; // 'player1', 'player2', или 'spectator'
        this.userId = localStorage.getItem('userId');
        this.username = localStorage.getItem('username');
        
        // Проверка авторизации
        if (!this.userId || !this.username) {
            alert('Необходима авторизация!');
            window.location.href = 'auth.html';
            return;
        }
        
        // WebSocket подключение
        this.socket = io();
        this.roomCode = sessionStorage.getItem('roomCode');
        this.isInitialized = false;
        
        // Загружаем фоновое изображение
        this.backgroundImage = new Image();
        this.backgroundImage.onload = () => this.draw();
        
        // Загружаем настройки из localStorage
        this.loadGameSettings();
        
        this.setupEventListeners();
        this.setupSocketListeners();
        this.draw();
    }

    loadGameSettings() {
        // Настройки будут загружены с сервера при подключении к комнате
        this.settings = null;
        
        // Подключаемся к комнате только если код есть
        if (this.roomCode) {
            console.log('Подключаемся к комнате:', this.roomCode);
            
            // ВАЖНО: Сначала отправляем авторизацию, затем подключаемся к комнате
            this.socket.emit('user-auth', {
                userId: this.userId,
                username: this.username
            });
            
            // Небольшая задержка, чтобы авторизация прошла первой
            setTimeout(() => {
                this.socket.emit('join-room', this.roomCode);
                // Запрашиваем фоновое изображение с сервера
                this.socket.emit('request-background');
            }, 100);
        } else {
            alert('Код комнаты не найден! Перенаправление на страницу настроек...');
            window.location.href = 'setup.html';
        }
    }

    setupSocketListeners() {
        // Комната создана (создатель комнаты)
        this.socket.on('room-created', (data) => {
            console.log('Комната создана:', data.roomCode);
            this.playerRole = data.playerRole || 'player1';
            
            if (!this.isInitialized) {
                // Создаем фишки для новой комнаты
                this.createPlayerChips(this.settings);
                this.isInitialized = true;
            }
            
            // ВАЖНО: Запрашиваем колоды ПОСЛЕ создания комнаты
            if (window.cardManager) {
                console.log('Запрос колод после создания комнаты');
                window.cardManager.requestDecks();
            }
            
            // Обновляем UI после небольшой задержки
            setTimeout(() => {
                this.updatePlayerRoleUI();
            }, 100);
        });

        // Успешное подключение к комнате
        this.socket.on('room-joined', (data) => {
            console.log('Подключились к комнате:', data.roomCode);
            this.playerRole = data.playerRole;
            console.log('Роль игрока:', this.playerRole);
            
            // Сохраняем настройки с сервера
            this.settings = data.settings;
            
            // Загружаем точки
            if (this.settings.points) {
                this.loadPointsFromJSON(this.settings.points);
            }
            
            // Если есть сохраненные фишки, загружаем их
            if (data.chips && data.chips.length > 0) {
                this.loadChipsFromServer(data.chips);
            } else if (!this.isInitialized) {
                // Если фишек нет, создаем их (первый игрок)
                this.createPlayerChips(this.settings);
                this.isInitialized = true;
            }
            
            // ВАЖНО: Запрашиваем колоды ПОСЛЕ подключения к комнате
            if (window.cardManager) {
                console.log('Запрос колод после подключения к комнате');
                window.cardManager.requestDecks();
                
                // Устанавливаем цвета полей персонажей
                if (this.settings.player1.character && this.settings.player2.character) {
                    window.cardManager.setCharacterColors(
                        this.settings.player1.character,
                        this.settings.player2.character
                    );
                }
            }
            
            // Обновляем UI после небольшой задержки, чтобы DOM был готов
            setTimeout(() => {
                this.updatePlayerRoleUI();
            }, 100);
        });
        
        // Получение фонового изображения с сервера
        this.socket.on('background-image', (imageData) => {
            if (imageData) {
                this.backgroundImage.src = imageData;
                console.log('Фоновое изображение загружено с сервера');
            }
        });
        
        // Ошибка подключения к комнате
        this.socket.on('room-error', (message) => {
            console.error('Ошибка комнаты:', message);
            alert('Ошибка: ' + message);
        });

        // Другой игрок присоединился
        this.socket.on('player-joined', (playerId) => {
            console.log('Игрок присоединился:', playerId);
        });

        // Другой игрок покинул комнату
        this.socket.on('player-left', (playerId) => {
            console.log('Игрок покинул комнату:', playerId);
        });

        // Синхронизация перемещения фишки
        this.socket.on('chip-moved', (data) => {
            const chip = this.chips.find(c => c.id === data.chipId);
            if (chip) {
                chip.x = data.x;
                chip.y = data.y;
                
                // Отсоединяем от старой точки
                if (chip.attachedPoint) {
                    chip.attachedPoint.detachChip();
                }
                
                // Присоединяем к новой точке
                if (data.attachedPointId !== null) {
                    const point = this.points.find(p => p.id === data.attachedPointId);
                    if (point) {
                        point.attachChip(chip);
                    }
                }
                
                this.draw();
            }
        });

        // Синхронизация изменения HP
        this.socket.on('hp-changed', (data) => {
            const chip = this.chips.find(c => c.id === data.chipId);
            if (chip) {
                chip.hp = data.hp;
                if (this.hpPanel) {
                    this.hpPanel.renderChips();
                }
            }
        });

        // Синхронизация инициализации фишек
        this.socket.on('chips-initialized', (chips) => {
            this.loadChipsFromServer(chips);
        });

        // Синхронизация очистки поля
        this.socket.on('board-cleared', () => {
            this.chips = [];
            this.points.forEach(point => point.chip = null);
            if (this.hpPanel) {
                this.hpPanel.renderChips();
            }
            this.draw();
        });
    }

    updatePlayerRoleUI() {
        // Обновляем UI в зависимости от роли игрока
        const player1Area = document.querySelector('.card-area.player-area:nth-of-type(2)');
        const player2Area = document.querySelector('.card-area.player-area:nth-of-type(3)');
        
        // Отображаем информацию о пользователе
        const usernameElement = document.getElementById('currentUsername');
        const roleElement = document.getElementById('currentRole');
        
        console.log('Обновление UI для роли:', this.playerRole);
        console.log('Username element:', usernameElement);
        console.log('Role element:', roleElement);
        
        if (usernameElement) {
            usernameElement.textContent = `Игрок: ${this.username}`;
        } else {
            console.error('Элемент currentUsername не найден!');
        }
        
        if (roleElement) {
            const roleNames = {
                'player1': 'Игрок 1',
                'player2': 'Игрок 2',
                'spectator': 'Наблюдатель'
            };
            roleElement.textContent = `Роль: ${roleNames[this.playerRole] || 'Неизвестно'}`;
        } else {
            console.error('Элемент currentRole не найден!');
        }
        
        // Отображаем код комнаты
        const roomCodeText = document.getElementById('roomCodeText');
        if (roomCodeText && this.roomCode) {
            roomCodeText.textContent = `Комната: ${this.roomCode}`;
        }
        
        // Обработчик выхода (добавляем только один раз)
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn && !logoutBtn.hasAttribute('data-listener')) {
            logoutBtn.setAttribute('data-listener', 'true');
            logoutBtn.addEventListener('click', () => {
                if (confirm('Вы уверены, что хотите выйти?')) {
                    localStorage.removeItem('username');
                    localStorage.removeItem('userId');
                    localStorage.removeItem('loginTime');
                    sessionStorage.clear();
                    window.location.href = 'auth.html';
                }
            });
        }
        
        console.log('Player1 area:', player1Area);
        console.log('Player2 area:', player2Area);
        
        if (this.playerRole === 'player1') {
            // Игрок 1 видит свои карты, но не видит карты игрока 2
            if (player1Area) {
                player1Area.classList.remove('hidden-cards');
                const h3 = player1Area.querySelector('h3');
                if (h3) h3.textContent = 'Ваше поле (Игрок 1)';
            }
            if (player2Area) {
                player2Area.classList.add('hidden-cards');
                const h3 = player2Area.querySelector('h3');
                if (h3) h3.textContent = 'Поле противника (Игрок 2)';
            }
        } else if (this.playerRole === 'player2') {
            // Игрок 2 видит свои карты, но не видит карты игрока 1
            if (player1Area) {
                player1Area.classList.add('hidden-cards');
                const h3 = player1Area.querySelector('h3');
                if (h3) h3.textContent = 'Поле противника (Игрок 1)';
            }
            if (player2Area) {
                player2Area.classList.remove('hidden-cards');
                const h3 = player2Area.querySelector('h3');
                if (h3) h3.textContent = 'Ваше поле (Игрок 2)';
            }
        } else {
            // Наблюдатель видит все
            if (player1Area) player1Area.classList.remove('hidden-cards');
            if (player2Area) player2Area.classList.remove('hidden-cards');
        }
        
        console.log('UI обновлен для роли:', this.playerRole);
    }

    loadChipsFromServer(chipsData) {
        this.chips = [];
        this.points.forEach(point => point.chip = null);
        
        console.log('Загрузка фишек с сервера:', chipsData.length);
        
        chipsData.forEach(chipData => {
            const chip = new Chip(
                chipData.x,
                chipData.y,
                chipData.color,
                chipData.id,
                chipData.isMain,
                chipData.player,
                chipData.image || null
            );
            chip.hp = chipData.hp;
            this.chips.push(chip);
            
            // Присоединяем к точке если есть
            if (chipData.attachedPointId !== null) {
                const point = this.points.find(p => p.id === chipData.attachedPointId);
                if (point) {
                    point.attachChip(chip);
                }
            }
        });
        
        console.log('Загружено фишек с сервера:', this.chips.length);
        
        // Инициализируем панель HP если она еще не создана
        if (!this.hpPanel) {
            this.hpPanel = new HPPanel(this);
        } else {
            this.hpPanel.renderChips();
        }
        
        // Перерисовываем canvas
        this.draw();
    }

    createPlayerChips(settings) {
        const freePoints = this.points.filter(p => !p.chip);
        let pointIndex = 0;
        
        console.log('Создание фишек игроков. Свободных точек:', freePoints.length);
        console.log('Настройки:', settings);
        
        // Получаем данные персонажей
        const char1 = settings.player1.character;
        const char2 = settings.player2.character;
        
        // Создаем главную фишку игрока 1
        if (pointIndex < freePoints.length && char1) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(
                point.x, 
                point.y, 
                char1.mainToken.color, 
                this.chips.length, 
                true, 
                'player1',
                char1.mainToken.image
            );
            chip.hp = char1.mainToken.hp;
            chip.maxHp = char1.mainToken.hp;
            this.chips.push(chip);
            point.attachChip(chip);
            console.log('Создана главная фишка игрока 1');
        }
        
        // Создаем дополнительные фишки игрока 1
        if (char1 && char1.extraTokens) {
            for (let i = 0; i < char1.extraTokens.length && pointIndex < freePoints.length; i++) {
                const point = freePoints[pointIndex++];
                const extraToken = char1.extraTokens[i];
                const chip = new Chip(
                    point.x, 
                    point.y, 
                    extraToken.color, 
                    this.chips.length, 
                    false, 
                    'player1',
                    extraToken.image
                );
                chip.hp = char1.extraTokenHP;
                chip.maxHp = char1.extraTokenHP;
                this.chips.push(chip);
                point.attachChip(chip);
                console.log(`Создана дополнительная фишка игрока 1 #${i+1}`);
            }
        }
        
        // Создаем главную фишку игрока 2
        if (pointIndex < freePoints.length && char2) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(
                point.x, 
                point.y, 
                char2.mainToken.color, 
                this.chips.length, 
                true, 
                'player2',
                char2.mainToken.image
            );
            chip.hp = char2.mainToken.hp;
            chip.maxHp = char2.mainToken.hp;
            this.chips.push(chip);
            point.attachChip(chip);
            console.log('Создана главная фишка игрока 2');
        }
        
        // Создаем дополнительные фишки игрока 2
        if (char2 && char2.extraTokens) {
            for (let i = 0; i < char2.extraTokens.length && pointIndex < freePoints.length; i++) {
                const point = freePoints[pointIndex++];
                const extraToken = char2.extraTokens[i];
                const chip = new Chip(
                    point.x, 
                    point.y, 
                    extraToken.color, 
                    this.chips.length, 
                    false, 
                    'player2',
                    extraToken.image
                );
                chip.hp = char2.extraTokenHP;
                chip.maxHp = char2.extraTokenHP;
                this.chips.push(chip);
                point.attachChip(chip);
                console.log(`Создана дополнительная фишка игрока 2 #${i+1}`);
            }
        }
        
        console.log('Всего создано фишек:', this.chips.length);
        
        // Инициализируем панель HP
        this.hpPanel = new HPPanel(this);
        
        // Отправляем фишки на сервер
        this.syncChipsToServer();
        
        this.draw();
    }

    loadPointsFromJSON(pointsData) {
        // Очищаем существующие точки
        this.points = [];
        
        // Загружаем новые точки
        pointsData.forEach((data, index) => {
            this.points.push(new Point(data.x, data.y, index));
        });
        
        this.draw();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        document.getElementById('clearBoard').addEventListener('click', () => this.clearBoard());
        
        document.getElementById('backToSetup').addEventListener('click', () => {
            window.location.href = 'setup.html';
        });
        
        // Кнопка копирования кода комнаты
        document.getElementById('copyRoomCode').addEventListener('click', () => {
            if (this.roomCode) {
                navigator.clipboard.writeText(this.roomCode).then(() => {
                    const btn = document.getElementById('copyRoomCode');
                    const originalText = btn.textContent;
                    btn.textContent = '✓';
                    btn.style.background = '#38a169';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '#3182ce';
                    }, 2000);
                }).catch(err => {
                    alert('Не удалось скопировать код комнаты');
                });
            }
        });
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        
        // Проверяем, нажали ли на фишку (в обратном порядке, чтобы верхние были приоритетнее)
        for (let i = this.chips.length - 1; i >= 0; i--) {
            if (this.chips[i].containsPoint(pos.x, pos.y)) {
                this.draggedChip = this.chips[i];
                this.draggedChip.isDragging = true;
                
                // Отсоединяем от точки
                if (this.draggedChip.attachedPoint) {
                    this.draggedChip.attachedPoint.detachChip();
                }
                
                // Перемещаем фишку в конец массива (на передний план)
                this.chips.splice(i, 1);
                this.chips.push(this.draggedChip);
                break;
            }
        }
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        
        if (this.draggedChip) {
            this.draggedChip.x = pos.x;
            this.draggedChip.y = pos.y;
            
            // Подсвечиваем ближайшую точку
            this.points.forEach(point => {
                point.isHovered = point.containsPoint(pos.x, pos.y);
            });
            
            this.draw();
        } else {
            // Проверяем наведение на точки
            let needsRedraw = false;
            this.points.forEach(point => {
                const wasHovered = point.isHovered;
                point.isHovered = point.containsPoint(pos.x, pos.y);
                if (wasHovered !== point.isHovered) needsRedraw = true;
            });
            if (needsRedraw) this.draw();
        }
    }

    handleMouseUp(e) {
        if (this.draggedChip) {
            const pos = this.getMousePos(e);
            
            // Ищем ближайшую точку для прикрепления
            let closestPoint = null;
            let minDistance = this.snapDistance;
            
            this.points.forEach(point => {
                if (!point.chip) {
                    const dx = point.x - pos.x;
                    const dy = point.y - pos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestPoint = point;
                    }
                }
            });
            
            if (closestPoint) {
                closestPoint.attachChip(this.draggedChip);
            }
            
            // Отправляем обновление на сервер
            this.socket.emit('chip-moved', {
                chipId: this.draggedChip.id,
                x: this.draggedChip.x,
                y: this.draggedChip.y,
                attachedPointId: this.draggedChip.attachedPoint ? this.draggedChip.attachedPoint.id : null,
                color: this.draggedChip.color,
                isMain: this.draggedChip.isMain,
                player: this.draggedChip.player,
                hp: this.draggedChip.hp
            });
            
            this.draggedChip.isDragging = false;
            this.draggedChip = null;
            
            // Убираем подсветку со всех точек
            this.points.forEach(point => point.isHovered = false);
            
            this.draw();
        }
    }

    // addRandomChip() {
    //     const colors = ['#e53e3e', '#3182ce', '#38a169', '#d69e2e', '#805ad5', '#dd6b20'];
    //     const color = colors[Math.floor(Math.random() * colors.length)];
        
    //     // Находим свободную точку
    //     const freePoints = this.points.filter(p => !p.chip);
    //     if (freePoints.length > 0) {
    //         const randomPoint = freePoints[Math.floor(Math.random() * freePoints.length)];
    //         const chip = new Chip(randomPoint.x, randomPoint.y, color, this.chips.length);
    //         this.chips.push(chip);
    //         randomPoint.attachChip(chip);
    //         this.draw();
    //     } else {
    //         alert('Нет свободных точек!');
    //     }
    // }

    clearBoard() {
        this.chips = [];
        this.points.forEach(point => point.chip = null);
        
        // Отправляем событие очистки на сервер
        this.socket.emit('board-cleared');
        
        if (this.hpPanel) {
            this.hpPanel.renderChips();
        }
        this.draw();
    }

    syncChipsToServer() {
        // Отправляем созданные фишки на сервер
        const chipsData = this.chips.map(chip => ({
            id: chip.id,
            x: chip.x,
            y: chip.y,
            color: chip.color,
            isMain: chip.isMain,
            player: chip.player,
            hp: chip.hp,
            image: chip.image ? chip.image.src : null,
            attachedPointId: chip.attachedPoint ? chip.attachedPoint.id : null
        }));
        
        this.socket.emit('chips-initialized', chipsData);
    }

    draw() {
        // Очищаем canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем фоновое изображение, если оно загружено
        if (this.backgroundImage.complete) {
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Запасной фон, если изображение еще не загрузилось
            this.ctx.fillStyle = '#f5f5f5';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Рисуем точки
        this.points.forEach(point => point.draw(this.ctx));
        
        // Рисуем фишки
        this.chips.forEach(chip => chip.draw(this.ctx));
    }

    addPlayerChip(color, isMain = false) {
        // Находим свободную точку
        const freePoints = this.points.filter(p => !p.chip);
        if (freePoints.length > 0) {
            const randomPoint = freePoints[Math.floor(Math.random() * freePoints.length)];
            const chip = new Chip(randomPoint.x, randomPoint.y, color, this.chips.length, isMain);
            this.chips.push(chip);
            randomPoint.attachChip(chip);
            this.draw();
            return true;
        }
        return false;
    }
}

// Класс для управления панелью HP
class HPPanel {
    constructor(gameBoard) {
        this.gameBoard = gameBoard;
        this.player1Container = document.getElementById('player1-chips');
        this.player2Container = document.getElementById('player2-chips');
        
        this.renderChips();
    }

    renderChips() {
        this.player1Container.innerHTML = '';
        this.player2Container.innerHTML = '';
        
        this.gameBoard.chips.forEach((chip, index) => {
            const chipItem = this.createChipHPItem(chip, index);
            
            if (chip.player === 'player1') {
                this.player1Container.appendChild(chipItem);
            } else if (chip.player === 'player2') {
                this.player2Container.appendChild(chipItem);
            }
        });
    }

    createChipHPItem(chip, index) {
        const item = document.createElement('div');
        item.className = 'chip-hp-item';
        
        const chipInfo = document.createElement('div');
        chipInfo.className = 'chip-info';
        
        const colorIndicator = document.createElement('div');
        colorIndicator.className = 'chip-color-indicator';
        colorIndicator.style.backgroundColor = chip.color;
        
        const label = document.createElement('span');
        label.className = 'chip-label';
        label.textContent = chip.isMain ? 'Главная' : `Фишка ${index + 1}`;
        
        chipInfo.appendChild(colorIndicator);
        chipInfo.appendChild(label);
        
        const hpControls = document.createElement('div');
        hpControls.className = 'hp-controls';
        
        const minusBtn = document.createElement('button');
        minusBtn.className = 'hp-btn minus';
        minusBtn.textContent = '-';
        minusBtn.addEventListener('click', () => {
            if (chip.hp > 0) {
                chip.hp--;
                this.updateHP(chip, hpValue);
            }
        });
        
        const hpValue = document.createElement('span');
        hpValue.className = 'hp-value';
        hpValue.textContent = chip.hp;
        
        const plusBtn = document.createElement('button');
        plusBtn.className = 'hp-btn plus';
        plusBtn.textContent = '+';
        plusBtn.addEventListener('click', () => {
            if (chip.hp < 20) {
                chip.hp++;
                this.updateHP(chip, hpValue);
            }
        });
        
        hpControls.appendChild(minusBtn);
        hpControls.appendChild(hpValue);
        hpControls.appendChild(plusBtn);
        
        item.appendChild(chipInfo);
        item.appendChild(hpControls);
        
        return item;
    }

    updateHP(chip, hpElement) {
        hpElement.textContent = chip.hp;
        
        if (chip.hp === 0) {
            hpElement.style.color = '#e53e3e';
        } else {
            hpElement.style.color = '#2d3748';
        }
        
        // Отправляем обновление HP на сервер
        this.gameBoard.socket.emit('hp-changed', {
            chipId: chip.id,
            hp: chip.hp
        });
    }
}

// Класс для карты
class Card {
    constructor(id, text, owner, image = null, backImage = null) {
        this.id = id;
        this.text = text;
        this.owner = owner; // 'player1', 'player2', или null для общих карт
        this.image = image; // URL изображения карты
        this.backImage = backImage; // URL рубашки карты
        this.isFlipped = false; // false = рубашка, true = лицевая сторона
        this.element = null;
        this.currentField = null; // 'shared', 'player1', 'player2'
    }

    createElement() {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.cardId = this.id;
        card.draggable = true;
        
        // Добавляем обработчики drag and drop
        card.addEventListener('dragstart', (e) => {
            if (window.cardManager) {
                window.cardManager.draggedCard = this;
                card.classList.add('dragging');
            }
        });
        
        card.addEventListener('dragend', (e) => {
            card.classList.remove('dragging');
            if (window.cardManager) {
                window.cardManager.draggedCard = null;
            }
        });
        
        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';
        
        // Лицевая сторона
        const cardFront = document.createElement('div');
        cardFront.className = 'card-face card-front';
        
        if (this.image) {
            const img = document.createElement('img');
            img.src = this.image;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '6px';
            cardFront.appendChild(img);
        } else {
            cardFront.textContent = this.text;
        }
        
        // Рубашка
        const cardBack = document.createElement('div');
        cardBack.className = 'card-face card-back';
        
        if (this.backImage) {
            const img = document.createElement('img');
            img.src = this.backImage;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '6px';
            cardBack.appendChild(img);
        } else {
            cardBack.textContent = '🎴';
        }
        
        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        card.appendChild(cardInner);
        
        // Кнопки управления
        const controls = document.createElement('div');
        controls.className = 'card-controls';
        
        const flipBtn = document.createElement('button');
        flipBtn.className = 'card-control-btn';
        flipBtn.textContent = '↻';
        flipBtn.title = 'Перевернуть';
        flipBtn.onclick = (e) => {
            e.stopPropagation();
            this.flip();
        };
        
        controls.appendChild(flipBtn);
        card.appendChild(controls);
        
        this.element = card;
        return card;
    }

    flip() {
        this.isFlipped = !this.isFlipped;
        if (this.element) {
            if (this.isFlipped) {
                this.element.classList.add('flipped');
            } else {
                this.element.classList.remove('flipped');
            }
        }
        
        // Синхронизируем с сервером
        if (window.cardManager) {
            window.cardManager.syncCardFlip(this.id, this.isFlipped);
        }
    }

    setFlipped(flipped) {
        this.isFlipped = flipped;
        if (this.element) {
            if (this.isFlipped) {
                this.element.classList.add('flipped');
            } else {
                this.element.classList.remove('flipped');
            }
        }
    }
}

// Класс для колоды
class Deck {
    constructor(owner, customDeck = null) {
        this.owner = owner; // 'player1' или 'player2'
        this.cards = [];
        this.nextCardId = 0;
        
        if (customDeck) {
            this.loadCustomDeck(customDeck);
        } else {
            this.initializeDefaultDeck();
        }
    }

    initializeDefaultDeck() {
        // Создаем стандартную колоду из 30 карт
        const cardTypes = [
            'Атака', 'Защита', 'Движение', 'Особая способность', 'Лечение', 'Уклонение'
        ];
        
        for (let i = 0; i < 30; i++) {
            const type = cardTypes[i % cardTypes.length];
            const cardText = `${type} ${Math.floor(i / cardTypes.length) + 1}`;
            this.cards.push({
                text: cardText,
                id: `${this.owner}_card_${this.nextCardId++}`,
                image: null // Для стандартной колоды нет изображений
            });
        }
    }

    loadCustomDeck(customDeck) {
        // Загружаем пользовательскую колоду
        if (customDeck.cards && customDeck.cards.length === 30) {
            this.cards = customDeck.cards.map((card, index) => ({
                text: card.text || `Карта ${index + 1}`,
                id: `${this.owner}_card_${this.nextCardId++}`,
                image: card.image || null
            }));
        } else {
            console.error('Неверный формат колоды, используется стандартная');
            this.initializeDefaultDeck();
        }
    }

    drawCard() {
        if (this.cards.length === 0) {
            return null;
        }
        return this.cards.shift();
    }

    getCardsCount() {
        return this.cards.length;
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
        console.log('Колода перемешана');
    }
}

// Класс для управления карточными полями
class CardManager {
    constructor(gameBoard) {
        this.gameBoard = gameBoard;
        this.cards = new Map(); // id -> Card
        this.sharedField = document.getElementById('sharedCardField');
        this.player1Field = document.getElementById('player1CardField');
        this.player2Field = document.getElementById('player2CardField');
        
        // Устанавливаем атрибуты для полей игроков
        this.player1Field.setAttribute('data-player', 'player1');
        this.player2Field.setAttribute('data-player', 'player2');
        
        // Колоды будут загружены с сервера
        this.player1Deck = null;
        this.player2Deck = null;
        this.decksLoaded = false;
        
        // Рубашки колод
        this.player1DeckBack = null;
        this.player2DeckBack = null;
        
        // Сброшенные карты
        this.player1Discard = [];
        this.player2Discard = [];
        
        this.draggedCard = null;
        this.currentPlayer = null;
        this.currentDiscardPlayer = null;
        
        this.setupEventListeners();
        this.setupSocketListeners();
        this.setupDragAndDrop();
        
        // НЕ запрашиваем колоды здесь - они будут запрошены после подключения к комнате
        console.log('CardManager инициализирован, ожидание подключения к комнате для загрузки колод');
    }

    setupDragAndDrop() {
        // Настройка drag and drop для полей
        [this.sharedField, this.player1Field, this.player2Field].forEach(field => {
            field.addEventListener('dragover', (e) => {
                e.preventDefault();
                field.classList.add('drag-over');
            });
            
            field.addEventListener('dragleave', (e) => {
                field.classList.remove('drag-over');
            });
            
            field.addEventListener('drop', (e) => {
                e.preventDefault();
                field.classList.remove('drag-over');
                
                if (this.draggedCard) {
                    this.moveCardToField(this.draggedCard, field);
                }
            });
        });
    }

    setCharacterColors(player1Character, player2Character) {
        // Устанавливаем цвета полей на основе персонажей
        if (player1Character && player1Character.mainToken) {
            const color = player1Character.mainToken.color;
            const rgb = this.hexToRgb(color);
            this.player1Field.style.background = `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05) 100%)`;
            this.player1Field.style.borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
        }
        
        if (player2Character && player2Character.mainToken) {
            const color = player2Character.mainToken.color;
            const rgb = this.hexToRgb(color);
            this.player2Field.style.background = `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05) 100%)`;
            this.player2Field.style.borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    moveCardToField(card, targetField) {
        // Проверяем, может ли игрок перемещать эту карту
        if (!this.canControlPlayer(card.owner) && card.owner !== null) {
            // Нельзя перемещать карты противника
            return;
        }
        
        // Перемещаем карту в другое поле
        const oldField = card.currentField;
        
        // Определяем новое поле
        let newFieldName = null;
        if (targetField === this.sharedField) {
            newFieldName = 'shared';
        } else if (targetField === this.player1Field) {
            newFieldName = 'player1';
        } else if (targetField === this.player2Field) {
            newFieldName = 'player2';
        }
        
        // Проверяем, может ли игрок перемещать карту в поле противника
        if (newFieldName === 'player1' && !this.canControlPlayer('player1')) {
            return;
        }
        if (newFieldName === 'player2' && !this.canControlPlayer('player2')) {
            return;
        }
        
        if (newFieldName && oldField !== newFieldName) {
            card.currentField = newFieldName;
            targetField.appendChild(card.element);
            
            // Синхронизируем с сервером
            this.gameBoard.socket.emit('card-moved', {
                cardId: card.id,
                fromField: oldField,
                toField: newFieldName
            });
        }
    }

    requestDecks() {
        // Запрашиваем колоды у сервера
        console.log('Запрос колод с сервера...');
        this.gameBoard.socket.emit('request-decks');
    }

    loadDecks(decksData) {
        // Загружаем колоды с сервера
        console.log('Получены колоды с сервера:', decksData);
        
        // Сохраняем рубашки колод
        if (decksData.player1 && decksData.player1.backImage) {
            this.player1DeckBack = decksData.player1.backImage;
        }
        if (decksData.player2 && decksData.player2.backImage) {
            this.player2DeckBack = decksData.player2.backImage;
        }
        
        // Создаем колоды из данных персонажей
        this.player1Deck = new Deck('player1', decksData.player1);
        this.player2Deck = new Deck('player2', decksData.player2);
        
        // Перемешиваем колоды
        this.player1Deck.shuffle();
        this.player2Deck.shuffle();
        
        this.decksLoaded = true;
        this.updateDeckCounts();
        
        // Обновляем информацию о персонажах
        this.updateCharacterInfo('player1', decksData.player1Character);
        this.updateCharacterInfo('player2', decksData.player2Character);
        
        console.log('Колоды загружены и перемешаны');
    }

    updateCharacterInfo(player, characterData) {
        if (!characterData) return;
        
        const prefix = player === 'player1' ? 'player1' : 'player2';
        
        // Обновляем скорость
        const speedEl = document.getElementById(`${prefix}Speed`);
        if (speedEl && characterData.speed) {
            speedEl.textContent = characterData.speed;
        }
        
        // Обновляем изображение персонажа
        const imageEl = document.getElementById(`${prefix}CharacterImage`);
        if (imageEl && characterData.characterImage) {
            imageEl.src = characterData.characterImage;
            imageEl.style.display = 'block';
            
            // Добавляем обработчик клика для увеличения изображения
            imageEl.addEventListener('click', () => {
                this.showCharacterImagePreview(characterData.characterImage, characterData.name);
            });
        }
        
        // Обновляем тип атаки главного токена
        const mainAttackEl = document.getElementById(`${prefix}MainAttack`);
        if (mainAttackEl && characterData.mainToken && characterData.mainToken.attackType) {
            const attackType = characterData.mainToken.attackType === 'melee' ? 'Ближняя' : 'Дальняя';
            mainAttackEl.textContent = attackType;
        }
        
        // Обновляем типы атак дополнительных токенов
        const extraAttacksEl = document.getElementById(`${prefix}ExtraAttacks`);
        if (extraAttacksEl && characterData.extraTokens && characterData.extraTokens.length > 0) {
            extraAttacksEl.innerHTML = '';
            characterData.extraTokens.forEach((token, index) => {
                if (token.attackType) {
                    const attackType = token.attackType === 'melee' ? 'Ближняя' : 'Дальняя';
                    const div = document.createElement('div');
                    div.className = 'stat-item';
                    div.innerHTML = `<span class="stat-label">Доп. токен ${index + 1}:</span><span class="stat-value">${attackType}</span>`;
                    extraAttacksEl.appendChild(div);
                }
            });
        }
        
        // Инициализируем счётчики персонажа
        this.initializeCounters(player, characterData);
    }

    initializeCounters(player, characterData) {
        if (!characterData || !characterData.counters || characterData.counters.length === 0) {
            return;
        }
        
        const prefix = player === 'player1' ? 'player1' : 'player2';
        const countersContainer = document.getElementById(`${prefix}Counters`);
        
        if (!countersContainer) return;
        
        countersContainer.innerHTML = '';
        
        // Получаем цвет персонажа для счётчиков
        const characterColor = characterData.mainToken ? characterData.mainToken.color : '#3182ce';
        
        characterData.counters.forEach((counter, index) => {
            const counterItem = document.createElement('div');
            counterItem.className = 'counter-item';
            counterItem.dataset.player = player;
            counterItem.dataset.counterIndex = index;
            
            const counterHeader = document.createElement('div');
            counterHeader.className = 'counter-header';
            
            const counterName = document.createElement('span');
            counterName.className = 'counter-name';
            counterName.textContent = counter.name;
            
            const counterValue = document.createElement('span');
            counterValue.className = 'counter-value';
            counterValue.id = `${prefix}Counter${index}Value`;
            counterValue.textContent = `${counter.currentValue}/${counter.maxValue}`;
            
            counterHeader.appendChild(counterName);
            counterHeader.appendChild(counterValue);
            
            const barContainer = document.createElement('div');
            barContainer.className = 'counter-bar-container';
            
            const bar = document.createElement('div');
            bar.className = 'counter-bar';
            bar.id = `${prefix}Counter${index}Bar`;
            bar.style.backgroundColor = characterColor;
            
            const percentage = ((counter.currentValue - counter.minValue) / (counter.maxValue - counter.minValue)) * 100;
            bar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
            
            barContainer.appendChild(bar);
            
            const controls = document.createElement('div');
            controls.className = 'counter-controls';
            
            const minusBtn = document.createElement('button');
            minusBtn.className = 'counter-btn minus';
            minusBtn.textContent = '-';
            minusBtn.addEventListener('click', () => {
                this.updateCounter(player, index, -1);
            });
            
            const plusBtn = document.createElement('button');
            plusBtn.className = 'counter-btn plus';
            plusBtn.textContent = '+';
            plusBtn.addEventListener('click', () => {
                this.updateCounter(player, index, 1);
            });
            
            controls.appendChild(minusBtn);
            controls.appendChild(plusBtn);
            
            counterItem.appendChild(counterHeader);
            counterItem.appendChild(barContainer);
            counterItem.appendChild(controls);
            
            countersContainer.appendChild(counterItem);
        });
    }

    updateCounter(player, counterIndex, delta) {
        // Отправляем обновление счётчика на сервер
        this.gameBoard.socket.emit('counter-changed', {
            player: player,
            counterIndex: counterIndex,
            delta: delta
        });
    }

    updateCounterFromServer(data) {
        const { player, counterIndex, newValue, minValue, maxValue } = data;
        const prefix = player === 'player1' ? 'player1' : 'player2';
        
        const valueEl = document.getElementById(`${prefix}Counter${counterIndex}Value`);
        const barEl = document.getElementById(`${prefix}Counter${counterIndex}Bar`);
        
        if (valueEl && barEl) {
            valueEl.textContent = `${newValue}/${maxValue}`;
            
            const percentage = ((newValue - minValue) / (maxValue - minValue)) * 100;
            barEl.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        }
    }

    showCharacterImagePreview(imageSrc, characterName) {
        // Создаем оверлей для превью
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            cursor: pointer;
        `;

        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        `;

        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.cssText = `
            max-width: 600px;
            max-height: 800px;
            width: auto;
            height: auto;
            border-radius: 8px;
        `;
        
        if (characterName) {
            const title = document.createElement('div');
            title.textContent = characterName;
            title.style.cssText = `
                font-size: 24px;
                font-weight: bold;
                color: #2d3748;
                margin-bottom: 15px;
                text-align: center;
            `;
            previewContainer.appendChild(title);
        }
        
        previewContainer.appendChild(img);
        overlay.appendChild(previewContainer);
        document.body.appendChild(overlay);

        // Закрытие по клику
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    }

    updateDeckCounts() {
        if (this.player1Deck) {
            document.getElementById('deckCountPlayer1').textContent = `Колода: ${this.player1Deck.getCardsCount()}`;
        }
        if (this.player2Deck) {
            document.getElementById('deckCountPlayer2').textContent = `Колода: ${this.player2Deck.getCardsCount()}`;
        }
    }

    updateDiscardCounts() {
        document.getElementById('discardPilePlayer1').textContent = `Сброс: ${this.player1Discard.length}`;
        document.getElementById('discardPilePlayer2').textContent = `Сброс: ${this.player2Discard.length}`;
    }

    setupEventListeners() {
        // Кнопки взятия карт - только для своего игрока
        document.getElementById('drawCardPlayer1').addEventListener('click', () => {
            if (this.canControlPlayer('player1')) {
                this.drawCard('player1');
            } else {
                alert('Вы не можете брать карты за другого игрока!');
            }
        });

        document.getElementById('drawCardPlayer2').addEventListener('click', () => {
            if (this.canControlPlayer('player2')) {
                this.drawCard('player2');
            } else {
                alert('Вы не можете брать карты за другого игрока!');
            }
        });

        // Кнопки перемешивания колоды - только для своего игрока
        document.getElementById('shuffleDeckPlayer1').addEventListener('click', () => {
            if (this.canControlPlayer('player1')) {
                this.shuffleDeck('player1');
            } else {
                alert('Вы не можете перемешивать колоду противника!');
            }
        });

        document.getElementById('shuffleDeckPlayer2').addEventListener('click', () => {
            if (this.canControlPlayer('player2')) {
                this.shuffleDeck('player2');
            } else {
                alert('Вы не можете перемешивать колоду противника!');
            }
        });

        // Кнопки просмотра сброса - только для своего игрока
        document.getElementById('discardPilePlayer1').addEventListener('click', () => {
            if (this.canControlPlayer('player1')) {
                this.showDiscardPile('player1');
            } else {
                alert('Вы не можете просматривать сброс противника!');
            }
        });

        document.getElementById('discardPilePlayer2').addEventListener('click', () => {
            if (this.canControlPlayer('player2')) {
                this.showDiscardPile('player2');
            } else {
                alert('Вы не можете просматривать сброс противника!');
            }
        });

        // Закрытие модального окна
        document.querySelector('.modal-close').addEventListener('click', () => {
            document.getElementById('discardModal').style.display = 'none';
        });

        document.getElementById('discardModal').addEventListener('click', (e) => {
            if (e.target.id === 'discardModal') {
                document.getElementById('discardModal').style.display = 'none';
            }
        });

        // Drag and drop для полей
        [this.sharedField, this.player1Field, this.player2Field].forEach(field => {
            field.addEventListener('dragover', (e) => this.handleDragOver(e));
            field.addEventListener('drop', (e) => this.handleDrop(e));
        });
    }

    canControlPlayer(player) {
        // Проверяем, может ли текущий пользователь управлять этим игроком
        return this.gameBoard.playerRole === player || this.gameBoard.playerRole === 'spectator';
    }

    shuffleDeck(player) {
        if (!this.decksLoaded) {
            alert('Колоды еще загружаются, подождите...');
            return;
        }

        const deck = player === 'player1' ? this.player1Deck : this.player2Deck;
        deck.shuffle();
        alert('Колода перемешана!');
        
        // Синхронизируем с сервером
        this.gameBoard.socket.emit('deck-shuffled', { player: player });
    }

    showDiscardPile(player) {
        const discardPile = player === 'player1' ? this.player1Discard : this.player2Discard;
        const modal = document.getElementById('discardModal');
        const grid = document.getElementById('discardGrid');
        grid.innerHTML = '';
        
        // Сохраняем текущего игрока для возврата карт
        this.currentDiscardPlayer = player;

        if (discardPile.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #718096;">Сброс пуст</p>';
        } else {
            discardPile.forEach((card, index) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'discard-card';
                cardDiv.dataset.cardIndex = index;
                
                if (card.image) {
                    const img = document.createElement('img');
                    img.src = card.image;
                    cardDiv.appendChild(img);
                } else {
                    const text = document.createElement('div');
                    text.className = 'discard-card-text';
                    text.textContent = card.text;
                    cardDiv.appendChild(text);
                }
                
                // Кнопка возврата карты в руку
                const returnBtn = document.createElement('button');
                returnBtn.className = 'return-card-btn';
                returnBtn.textContent = '↩';
                returnBtn.title = 'Вернуть в руку';
                returnBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.returnCardFromDiscard(player, index);
                };
                cardDiv.appendChild(returnBtn);
                
                // Клик для увеличенного просмотра
                cardDiv.addEventListener('click', () => {
                    this.showCardPreview(card);
                });
                
                grid.appendChild(cardDiv);
            });
        }

        modal.style.display = 'flex';
    }

    discardCard(cardId) {
        const card = this.cards.get(cardId);
        if (!card) return;

        const discardPile = card.owner === 'player1' ? this.player1Discard : this.player2Discard;
        discardPile.push({
            text: card.text,
            image: card.image
        });

        this.updateDiscardCounts();

        // Синхронизируем с сервером
        this.gameBoard.socket.emit('card-discarded', {
            cardId: cardId,
            player: card.owner,
            card: {
                text: card.text,
                image: card.image
            }
        });
    }

    returnCardFromDiscard(player, cardIndex) {
        const discardPile = player === 'player1' ? this.player1Discard : this.player2Discard;
        
        if (cardIndex < 0 || cardIndex >= discardPile.length) {
            return;
        }

        const cardData = discardPile.splice(cardIndex, 1)[0];
        
        // Создаем карту и добавляем в руку игрока
        const cardId = `${player}_returned_${Date.now()}_${Math.random()}`;
        const card = new Card(cardId, cardData.text, player, cardData.image);
        this.cards.set(card.id, card);
        
        const targetField = player === 'player1' ? this.player1Field : this.player2Field;
        card.currentField = player;
        
        const cardElement = card.createElement();
        
        // Проверяем, должна ли карта быть скрыта
        const shouldHide = this.shouldHideCard(card);
        if (shouldHide) {
            cardElement.classList.add('hidden-card');
        }
        
        this.setupCardDragAndDrop(cardElement, card);
        targetField.appendChild(cardElement);

        // Добавляем кнопку сброса к карте
        this.addDiscardButton(cardElement, card.id);

        this.updateDiscardCounts();
        
        // Обновляем отображение сброса
        this.showDiscardPile(player);

        // Синхронизируем с сервером
        this.gameBoard.socket.emit('card-returned-from-discard', {
            player: player,
            cardIndex: cardIndex,
            card: {
                id: card.id,
                text: card.text,
                owner: card.owner,
                field: card.currentField,
                isFlipped: card.isFlipped,
                image: card.image
            }
        });
    }

    showCardPreview(card) {
        // Создаем модальное окно для увеличенного просмотра
        const previewModal = document.createElement('div');
        previewModal.className = 'card-preview-modal';
        previewModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            cursor: pointer;
        `;

        const previewCard = document.createElement('div');
        previewCard.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        `;

        if (card.image) {
            const img = document.createElement('img');
            img.src = card.image;
            img.style.cssText = `
                max-width: 600px;
                max-height: 800px;
                width: 100%;
                height: auto;
                border-radius: 8px;
            `;
            previewCard.appendChild(img);
        } else {
            const text = document.createElement('div');
            text.style.cssText = `
                font-size: 32px;
                font-weight: bold;
                color: #2d3748;
                padding: 40px;
                text-align: center;
                min-width: 300px;
                min-height: 400px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            text.textContent = card.text;
            previewCard.appendChild(text);
        }

        previewModal.appendChild(previewCard);
        document.body.appendChild(previewModal);

        // Закрытие по клику
        previewModal.addEventListener('click', () => {
            previewModal.remove();
        });
    }

    setupSocketListeners() {
        const socket = this.gameBoard.socket;

        // Получение колод с сервера
        socket.on('decks-data', (decksData) => {
            console.log('Событие decks-data получено:', decksData);
            this.loadDecks(decksData);
        });

        // Синхронизация создания карты
        socket.on('card-created', (data) => {
            this.createCardFromServer(data);
        });

        // Синхронизация перемещения карты
        socket.on('card-moved', (data) => {
            this.moveCardFromServer(data.cardId, data.targetField);
        });

        // Синхронизация переворачивания карты
        socket.on('card-flipped', (data) => {
            const card = this.cards.get(data.cardId);
            if (card) {
                card.setFlipped(data.isFlipped);
            }
        });

        // Синхронизация удаления карты
        socket.on('card-removed', (data) => {
            this.removeCardFromServer(data.cardId);
        });

        // Синхронизация сброса карты
        socket.on('card-discarded', (data) => {
            const discardPile = data.player === 'player1' ? this.player1Discard : this.player2Discard;
            discardPile.push({
                text: data.card.text,
                image: data.card.image
            });
            this.updateDiscardCounts();
        });

        // Синхронизация возврата карты из сброса
        socket.on('card-returned-from-discard', (data) => {
            const discardPile = data.player === 'player1' ? this.player1Discard : this.player2Discard;
            discardPile.splice(data.cardIndex, 1);
            this.updateDiscardCounts();
            this.createCardFromServer(data.card);
        });

        // Синхронизация перемешивания колоды
        socket.on('deck-shuffled', (data) => {
            const deck = data.player === 'player1' ? this.player1Deck : this.player2Deck;
            if (deck) {
                deck.shuffle();
            }
        });

        // Загрузка карт при подключении к комнате
        socket.on('room-joined', (data) => {
            if (data.cards && data.cards.length > 0) {
                data.cards.forEach(cardData => {
                    this.createCardFromServer(cardData);
                });
            }
            
            // Загружаем сброшенные карты если они есть
            if (data.discardPiles) {
                this.player1Discard = data.discardPiles.player1 || [];
                this.player2Discard = data.discardPiles.player2 || [];
                this.updateDiscardCounts();
            }
        });

        // Синхронизация изменения счётчиков
        socket.on('counter-updated', (data) => {
            this.updateCounterFromServer(data);
        });
    }

    drawCard(player) {
        // Проверяем, загружены ли колоды
        if (!this.decksLoaded) {
            alert('Колоды еще загружаются, подождите...');
            return;
        }

        const deck = player === 'player1' ? this.player1Deck : this.player2Deck;
        const deckBack = player === 'player1' ? this.player1DeckBack : this.player2DeckBack;
        const cardData = deck.drawCard();
        
        if (!cardData) {
            alert('Колода пуста!');
            return;
        }

        const card = new Card(cardData.id, cardData.text, player, cardData.image, deckBack);
        this.cards.set(card.id, card);
        
        const targetField = player === 'player1' ? this.player1Field : this.player2Field;
        card.currentField = player;
        
        const cardElement = card.createElement();
        
        // Проверяем, должна ли карта быть скрыта
        const shouldHide = this.shouldHideCard(card);
        if (shouldHide) {
            cardElement.classList.add('hidden-card');
        }
        
        this.setupCardDragAndDrop(cardElement, card);
        targetField.appendChild(cardElement);

        // Добавляем кнопку сброса к карте
        this.addDiscardButton(cardElement, card.id);

        // Синхронизируем с сервером
        this.gameBoard.socket.emit('card-created', {
            id: card.id,
            text: card.text,
            owner: card.owner,
            field: card.currentField,
            isFlipped: card.isFlipped,
            image: card.image,
            backImage: deckBack
        });

        this.updateDeckCounts();
        console.log(`Карта взята: ${cardData.text}, осталось в колоде: ${deck.getCardsCount()}`);
    }

    addDiscardButton(cardElement, cardId) {
        const card = this.cards.get(cardId);
        
        // Проверяем, может ли игрок управлять этой картой
        if (!card || !this.canControlPlayer(card.owner)) {
            return; // Не добавляем кнопку сброса для карт противника
        }
        
        const discardBtn = document.createElement('button');
        discardBtn.className = 'card-control-btn';
        discardBtn.textContent = '🗑️';
        discardBtn.title = 'Сбросить карту';
        discardBtn.style.position = 'absolute';
        discardBtn.style.top = '30px';
        discardBtn.style.left = '0px';
        discardBtn.onclick = (e) => {
            e.stopPropagation();
            this.discardCard(cardId);
            // Удаляем карту локально
            cardElement.remove();
            this.cards.delete(cardId);
            // Отправляем событие удаления на сервер
            this.gameBoard.socket.emit('card-removed', { cardId: cardId });
        };
        
        const controls = cardElement.querySelector('.card-controls');
        if (controls) {
            controls.appendChild(discardBtn);
        
    
            // Отправляем событие удаления на сервер
            this.gameBoard.socket.emit('card-removed', { cardId: cardId });
        };
        
        // const controls = cardElement.querySelector('.card-controls');
        // if (controls) {
        //     controls.appendChild(discardBtn);
        // }
    }
    

    createCardFromServer(data) {
        // Проверяем, не существует ли уже карта
        if (this.cards.has(data.id)) {
            return;
        }

        const card = new Card(data.id, data.text, data.owner, data.image, data.backImage);
        card.isFlipped = data.isFlipped;
        card.currentField = data.field;
        this.cards.set(card.id, card);

        const targetField = this.getFieldElement(data.field);
        const cardElement = card.createElement();
        
        // Проверяем, должна ли карта быть скрыта для текущего игрока
        const shouldHide = this.shouldHideCard(card);
        if (shouldHide) {
            cardElement.classList.add('hidden-card');
        }
        
        this.setupCardDragAndDrop(cardElement, card);
        targetField.appendChild(cardElement);
        
        // Добавляем кнопку сброса
        this.addDiscardButton(cardElement, card.id);
    
        
        
        this.setupCardDragAndDrop(cardElement, card);
        targetField.appendChild(cardElement);

        if (card.isFlipped) {
            card.setFlipped(true);
        }
    }

    shouldHideCard(card) {
        const playerRole = this.gameBoard.playerRole;
        
        // Если карта на общем поле, все видят
        if (card.currentField === 'shared') {
            return false;
        }
        
        // Если игрок 1, скрываем карты игрока 2
        if (playerRole === 'player1' && card.currentField === 'player2') {
            return true;
        }
        
        // Если игрок 2, скрываем карты игрока 1
        if (playerRole === 'player2' && card.currentField === 'player1') {
            return true;
        }
        
        // Наблюдатели видят все
        return false;
    }

    setupCardDragAndDrop(element, card) {
        element.draggable = true;

        element.addEventListener('dragstart', (e) => {
            this.draggedCard = card;
            element.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
            this.draggedCard = null;
        });

        // Клик для увеличенного просмотра
        element.addEventListener('click', (e) => {
            // Проверяем, что клик не был на кнопке управления
            if (!e.target.classList.contains('card-control-btn')) {
                this.showCardPreview(card);
            }
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDrop(e) {
        e.preventDefault();
        
        if (!this.draggedCard) return;

        const targetField = e.currentTarget;
        const targetFieldName = this.getFieldName(targetField);

        // Проверяем права на перемещение
        if (!this.canMoveCard(this.draggedCard, targetFieldName)) {
            alert('Вы не можете переместить эту карту сюда!');
            return;
        }

        // Перемещаем карту
        this.moveCard(this.draggedCard.id, targetFieldName);
    }

    canMoveCard(card, targetField) {
        // Из личного поля можно перемещать только на общее поле
        if (card.currentField === 'player1' || card.currentField === 'player2') {
            return targetField === 'shared';
        }
        
        // С общего поля можно перемещать обратно в свое личное поле
        if (card.currentField === 'shared') {
            return targetField === card.owner;
        }

        return false;
    }

    moveCard(cardId, targetField) {
        const card = this.cards.get(cardId);
        if (!card || !card.element) return;

        const targetFieldElement = this.getFieldElement(targetField);
        targetFieldElement.appendChild(card.element);
        card.currentField = targetField;

        // Синхронизируем с сервером
        this.gameBoard.socket.emit('card-moved', {
            cardId: cardId,
            targetField: targetField
        });
    }

    moveCardFromServer(cardId, targetField) {
        const card = this.cards.get(cardId);
        if (!card || !card.element) return;

        const targetFieldElement = this.getFieldElement(targetField);
        targetFieldElement.appendChild(card.element);
        card.currentField = targetField;
        
        // Обновляем видимость карты при перемещении
        const shouldHide = this.shouldHideCard(card);
        if (shouldHide) {
            card.element.classList.add('hidden-card');
        } else {
            card.element.classList.remove('hidden-card');
        }
    }

    syncCardFlip(cardId, isFlipped) {
        this.gameBoard.socket.emit('card-flipped', {
            cardId: cardId,
            isFlipped: isFlipped
        });
    }

    removeCardFromServer(cardId) {
        const card = this.cards.get(cardId);
        if (card && card.element) {
            card.element.remove();
        }
        this.cards.delete(cardId);
    }

    getFieldElement(fieldName) {
        switch (fieldName) {
            case 'shared': return this.sharedField;
            case 'player1': return this.player1Field;
            case 'player2': return this.player2Field;
            default: return this.sharedField;
        }
    }

    getFieldName(fieldElement) {
        if (fieldElement === this.sharedField) return 'shared';
        if (fieldElement === this.player1Field) return 'player1';
        if (fieldElement === this.player2Field) return 'player2';
        return 'shared';
    }
}

// Инициализация игры
window.addEventListener('DOMContentLoaded', () => {
    const gameBoard = new GameBoard('gameCanvas');
    // Панель HP будет инициализирована автоматически после создания/загрузки фишек
    
    // Инициализируем карточный менеджер
    window.cardManager = new CardManager(gameBoard);
});
