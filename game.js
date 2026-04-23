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
    constructor(x, y, color, id) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.id = id;
        this.radius = 20;
        this.isDragging = false;
        this.attachedPoint = null;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
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
        this.snapDistance = 60;
        
        // Загружаем фоновое изображение
        this.backgroundImage = new Image();
        this.backgroundImage.onload = () => this.draw();
        
        this.initializePoints();
        this.setupEventListeners();
        this.draw();
    }

    initializePoints() {
        // Создаем сетку точек по умолчанию
        const cols = 8;
        const rows = 6;
        const marginX = 100;
        const marginY = 75;
        const spacingX = (this.canvas.width - 2 * marginX) / (cols - 1);
        const spacingY = (this.canvas.height - 2 * marginY) / (rows - 1);

        let id = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = marginX + col * spacingX;
                const y = marginY + row * spacingY;
                this.points.push(new Point(x, y, id++));
            }
        }
    }

    loadPointsFromJSON(pointsData) {
        // Очищаем существующие точки и фишки
        this.points = [];
        this.chips = [];
        
        // Загружаем новые точки
        pointsData.forEach((data, index) => {
            this.points.push(new Point(data.x, data.y, index));
        });
        
        this.draw();
    }

    loadBackgroundImage(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            this.backgroundImage = new Image();
            this.backgroundImage.onload = () => this.draw();
            this.backgroundImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        document.getElementById('addChip').addEventListener('click', () => this.addRandomChip());
        document.getElementById('clearBoard').addEventListener('click', () => this.clearBoard());
        
        // Загрузка фонового изображения
        document.getElementById('backgroundUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadBackgroundImage(file);
            }
        });
        
        // Загрузка точек из JSON
        document.getElementById('pointsUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const pointsData = JSON.parse(event.target.result);
                        this.loadPointsFromJSON(pointsData);
                    } catch (error) {
                        alert('Ошибка при загрузке JSON: ' + error.message);
                    }
                };
                reader.readAsText(file);
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
}

// Инициализация игры
window.addEventListener('DOMContentLoaded', () => {
    new GameBoard('gameCanvas');
});
