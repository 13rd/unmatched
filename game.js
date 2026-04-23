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
        
        // Загружаем фоновое изображение
        this.backgroundImage = new Image();
        this.backgroundImage.onload = () => this.draw();
        
        // Загружаем настройки из localStorage
        this.loadGameSettings();
        
        this.setupEventListeners();
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

        const settings = JSON.parse(settingsJson);
        
        // Загружаем фон
        if (settings.backgroundImage) {
            this.backgroundImage.src = settings.backgroundImage;
        }
        
        // Загружаем точки
        if (settings.points) {
            this.loadPointsFromJSON(settings.points);
        }
        
        // Создаем фишки игроков
        this.createPlayerChips(settings);
    }

    createPlayerChips(settings) {
        const freePoints = this.points.filter(p => !p.chip);
        let pointIndex = 0;
        
        // Создаем главную фишку игрока 1
        if (pointIndex < freePoints.length) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, settings.player1.mainColor, this.chips.length, true, 'player1');
            this.chips.push(chip);
            point.attachChip(chip);
        }
        
        // Создаем дополнительные фишки игрока 1
        for (let i = 0; i < settings.player1.extraCount && pointIndex < freePoints.length; i++) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, settings.player1.extraColor, this.chips.length, false, 'player1');
            this.chips.push(chip);
            point.attachChip(chip);
        }
        
        // Создаем главную фишку игрока 2
        if (pointIndex < freePoints.length) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, settings.player2.mainColor, this.chips.length, true, 'player2');
            this.chips.push(chip);
            point.attachChip(chip);
        }
        
        // Создаем дополнительные фишки игрока 2
        for (let i = 0; i < settings.player2.extraCount && pointIndex < freePoints.length; i++) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, settings.player2.extraColor, this.chips.length, false, 'player2');
            this.chips.push(chip);
            point.attachChip(chip);
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
            
            this.draggedChip.isDragging = false;
            this.draggedChip = null;
            
            // Убираем подсветку со всех точек
            this.points.forEach(point => point.isHovered = false);
            
            this.draw();
        }
    }

    addRandomChip() {
        const colors = ['#e53e3e', '#3182ce', '#38a169', '#d69e2e', '#805ad5', '#dd6b20'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Находим свободную точку
        const freePoints = this.points.filter(p => !p.chip);
        if (freePoints.length > 0) {
            const randomPoint = freePoints[Math.floor(Math.random() * freePoints.length)];
            const chip = new Chip(randomPoint.x, randomPoint.y, color, this.chips.length);
            this.chips.push(chip);
            randomPoint.attachChip(chip);
            this.draw();
        } else {
            alert('Нет свободных точек!');
        }
    }

    clearBoard() {
        this.chips = [];
        this.points.forEach(point => point.chip = null);
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
            if (chip.hp < chip.maxHp) {
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
    }
}

// Инициализация игры
window.addEventListener('DOMContentLoaded', () => {
    const gameBoard = new GameBoard('gameCanvas');
    gameBoard.hpPanel = new HPPanel(gameBoard);
});
