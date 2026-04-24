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
    constructor(x, y, color, id, isMain = false, player = null) {
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
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = this.isMain ? 4 : 3;
        ctx.stroke();
        
        // Внутренний круг для визуального эффекта
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius - 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
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
        // Пробуем получить настройки из sessionStorage
        const settingsJson = sessionStorage.getItem('gameSettings');
        
        if (!settingsJson) {
            alert('Настройки игры не найдены! Перенаправление на страницу настроек...');
            window.location.href = 'setup.html';
            return;
        }

        this.settings = JSON.parse(settingsJson);
        
        // Загружаем фон
        if (this.settings.backgroundImage) {
            this.backgroundImage.src = this.settings.backgroundImage;
        }
        
        // Загружаем точки
        if (this.settings.points) {
            this.loadPointsFromJSON(this.settings.points);
        }
        
        // Подключаемся к комнате только если код есть
        if (this.roomCode) {
            console.log('Подключаемся к комнате:', this.roomCode);
            this.socket.emit('join-room', this.roomCode);
        } else {
            console.error('Код комнаты не найден!');
        }
    }

    setupSocketListeners() {
        // Комната создана (создатель комнаты)
        this.socket.on('room-created', (data) => {
            console.log('Комната создана:', data.roomCode);
            
            if (!this.isInitialized) {
                // Создаем фишки для новой комнаты
                this.createPlayerChips(this.settings);
                this.isInitialized = true;
            }
        });

        // Успешное подключение к комнате
        this.socket.on('room-joined', (data) => {
            console.log('Подключились к комнате:', data.roomCode);
            
            // Если есть сохраненные фишки, загружаем их
            if (data.chips && data.chips.length > 0) {
                this.loadChipsFromServer(data.chips);
            } else if (!this.isInitialized) {
                // Если фишек нет, создаем их (первый игрок)
                this.createPlayerChips(this.settings);
                this.isInitialized = true;
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

    loadChipsFromServer(chipsData) {
        this.chips = [];
        this.points.forEach(point => point.chip = null);
        
        chipsData.forEach(chipData => {
            const chip = new Chip(
                chipData.x,
                chipData.y,
                chipData.color,
                chipData.id,
                chipData.isMain,
                chipData.player
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
        
        this.draw();
    }

    createPlayerChips(settings) {
        const freePoints = this.points.filter(p => !p.chip);
        let pointIndex = 0;
        
        // Создаем главную фишку игрока 1
        if (pointIndex < freePoints.length) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, settings.player1.mainColor, this.chips.length, true, 'player1');
            chip.hp = settings.player1.mainHP;
            chip.maxHp = settings.player1.mainHP;
            this.chips.push(chip);
            point.attachChip(chip);
        }
        
        // Создаем дополнительные фишки игрока 1
        for (let i = 0; i < settings.player1.extraCount && pointIndex < freePoints.length; i++) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, settings.player1.extraColor, this.chips.length, false, 'player1');
            chip.hp = settings.player1.extraHP;
            chip.maxHp = settings.player1.extraHP;
            this.chips.push(chip);
            point.attachChip(chip);
        }
        
        // Создаем главную фишку игрока 2
        if (pointIndex < freePoints.length) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, settings.player2.mainColor, this.chips.length, true, 'player2');
            chip.hp = settings.player2.mainHP;
            chip.maxHp = settings.player2.mainHP;
            this.chips.push(chip);
            point.attachChip(chip);
        }
        
        // Создаем дополнительные фишки игрока 2
        for (let i = 0; i < settings.player2.extraCount && pointIndex < freePoints.length; i++) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, settings.player2.extraColor, this.chips.length, false, 'player2');
            chip.hp = settings.player2.extraHP;
            chip.maxHp = settings.player2.extraHP;
            this.chips.push(chip);
            point.attachChip(chip);
        }
        
        console.log('Создано фишек:', this.chips.length);
        
        // Отправляем созданные фишки на сервер
        const chipsData = this.chips.map(chip => ({
            id: chip.id,
            x: chip.x,
            y: chip.y,
            color: chip.color,
            isMain: chip.isMain,
            player: chip.player,
            hp: chip.hp,
            attachedPointId: chip.attachedPoint ? chip.attachedPoint.id : null
        }));
        
        this.socket.emit('chips-initialized', chipsData);
        
        // Инициализируем панель HP если она еще не создана
        if (!this.hpPanel) {
            this.hpPanel = new HPPanel(this);
        } else {
            this.hpPanel.renderChips();
        }
        
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
    constructor(id, text, owner, image = null) {
        this.id = id;
        this.text = text;
        this.owner = owner; // 'player1', 'player2', или null для общих карт
        this.image = image; // URL изображения карты
        this.isFlipped = false; // false = рубашка, true = лицевая сторона
        this.element = null;
        this.currentField = null; // 'shared', 'player1', 'player2'
    }

    createElement() {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.cardId = this.id;
        
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
        cardBack.textContent = '🎴';
        
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
        
        // Колоды будут загружены с сервера
        this.player1Deck = null;
        this.player2Deck = null;
        this.decksLoaded = false;
        
        this.draggedCard = null;
        this.currentPlayer = null;
        
        this.setupEventListeners();
        this.setupSocketListeners();
        
        // Запрашиваем колоды с сервера
        this.requestDecks();
    }

    requestDecks() {
        // Запрашиваем колоды у сервера
        this.gameBoard.socket.emit('request-decks');
    }

    loadDecks(decksData) {
        // Загружаем колоды с сервера
        this.player1Deck = new Deck('player1', decksData.player1);
        this.player2Deck = new Deck('player2', decksData.player2);
        this.decksLoaded = true;
        console.log('Колоды загружены с сервера');
    }

    setupEventListeners() {
        // Кнопки взятия карт
        document.getElementById('drawCardPlayer1').addEventListener('click', () => {
            this.drawCard('player1');
        });

        document.getElementById('drawCardPlayer2').addEventListener('click', () => {
            this.drawCard('player2');
        });

        // Drag and drop для полей
        [this.sharedField, this.player1Field, this.player2Field].forEach(field => {
            field.addEventListener('dragover', (e) => this.handleDragOver(e));
            field.addEventListener('drop', (e) => this.handleDrop(e));
        });
    }

    setupSocketListeners() {
        const socket = this.gameBoard.socket;

        // Получение колод с сервера
        socket.on('decks-data', (decksData) => {
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

        // Загрузка карт при подключении к комнате
        socket.on('room-joined', (data) => {
            if (data.cards && data.cards.length > 0) {
                data.cards.forEach(cardData => {
                    this.createCardFromServer(cardData);
                });
            }
        });
    }

    drawCard(player) {
        // Проверяем, загружены ли колоды
        if (!this.decksLoaded) {
            alert('Колоды еще загружаются, подождите...');
            return;
        }

        const deck = player === 'player1' ? this.player1Deck : this.player2Deck;
        const cardData = deck.drawCard();
        
        if (!cardData) {
            alert('Колода пуста!');
            return;
        }

        const card = new Card(cardData.id, cardData.text, player, cardData.image);
        this.cards.set(card.id, card);
        
        const targetField = player === 'player1' ? this.player1Field : this.player2Field;
        card.currentField = player;
        
        const cardElement = card.createElement();
        this.setupCardDragAndDrop(cardElement, card);
        targetField.appendChild(cardElement);

        // Синхронизируем с сервером
        this.gameBoard.socket.emit('card-created', {
            id: card.id,
            text: card.text,
            owner: card.owner,
            field: card.currentField,
            isFlipped: card.isFlipped,
            image: card.image
        });

        console.log(`Карта взята: ${cardData.text}, осталось в колоде: ${deck.getCardsCount()}`);
    }

    createCardFromServer(data) {
        // Проверяем, не существует ли уже карта
        if (this.cards.has(data.id)) {
            return;
        }

        const card = new Card(data.id, data.text, data.owner, data.image);
        card.isFlipped = data.isFlipped;
        card.currentField = data.field;
        this.cards.set(card.id, card);

        const targetField = this.getFieldElement(data.field);
        const cardElement = card.createElement();
        this.setupCardDragAndDrop(cardElement, card);
        targetField.appendChild(cardElement);

        if (card.isFlipped) {
            card.setFlipped(true);
        }
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
