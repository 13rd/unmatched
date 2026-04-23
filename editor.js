class PointEditor {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this.backgroundImage = null;
        this.mode = 'add'; // 'add' или 'delete'
        
        this.setupEventListeners();
        this.draw();
    }

    setupEventListeners() {
        // Загрузка изображения
        document.getElementById('imageUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('fileName').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.backgroundImage = new Image();
                    this.backgroundImage.onload = () => this.draw();
                    this.backgroundImage.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // Клик по canvas
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Переключение режимов
        document.getElementById('addMode').addEventListener('click', () => {
            this.mode = 'add';
            this.canvas.style.cursor = 'crosshair';
            document.getElementById('addMode').classList.add('active');
            document.getElementById('deleteMode').classList.remove('active');
        });

        document.getElementById('deleteMode').addEventListener('click', () => {
            this.mode = 'delete';
            this.canvas.style.cursor = 'pointer';
            document.getElementById('deleteMode').classList.add('active');
            document.getElementById('addMode').classList.remove('active');
        });

        // Очистка всех точек
        document.getElementById('clearAll').addEventListener('click', () => {
            if (confirm('Удалить все точки?')) {
                this.points = [];
                this.updatePointCount();
                this.draw();
            }
        });

        // Экспорт в JSON
        document.getElementById('exportJSON').addEventListener('click', () => {
            this.exportToJSON();
        });

        // Экспорт в JS
        document.getElementById('exportJS').addEventListener('click', () => {
            this.exportToJS();
        });

        // Наведение мыши для подсветки точек в режиме удаления
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.mode === 'delete') {
                const pos = this.getMousePos(e);
                let needsRedraw = false;
                
                this.points.forEach(point => {
                    const wasHovered = point.isHovered;
                    point.isHovered = this.isPointNear(pos.x, pos.y, point);
                    if (wasHovered !== point.isHovered) needsRedraw = true;
                });
                
                if (needsRedraw) this.draw();
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

    handleCanvasClick(e) {
        const pos = this.getMousePos(e);

        if (this.mode === 'add') {
            // Добавляем новую точку
            this.points.push({
                x: Math.round(pos.x),
                y: Math.round(pos.y),
                id: this.points.length,
                isHovered: false
            });
            this.updatePointCount();
            this.draw();
        } else if (this.mode === 'delete') {
            // Удаляем точку, если кликнули рядом
            const pointIndex = this.points.findIndex(point => 
                this.isPointNear(pos.x, pos.y, point)
            );
            
            if (pointIndex !== -1) {
                this.points.splice(pointIndex, 1);
                // Обновляем ID точек
                this.points.forEach((point, index) => {
                    point.id = index;
                });
                this.updatePointCount();
                this.draw();
            }
        }
    }

    isPointNear(x, y, point, radius = 15) {
        const dx = x - point.x;
        const dy = y - point.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    }

    updatePointCount() {
        document.getElementById('pointCount').textContent = this.points.length;
    }

    draw() {
        // Очищаем canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Рисуем фон
        if (this.backgroundImage && this.backgroundImage.complete) {
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#f5f5f5';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Рисуем точки
        this.points.forEach((point, index) => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 15, 0, Math.PI * 2);
            
            if (point.isHovered) {
                this.ctx.fillStyle = '#e53e3e';
            } else {
                this.ctx.fillStyle = '#4a5568';
            }
            
            this.ctx.fill();
            this.ctx.strokeStyle = '#1a202c';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Рисуем номер точки
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(index, point.x, point.y);
        });
    }

    exportToJSON() {
        if (this.points.length === 0) {
            alert('Нет точек для экспорта!');
            return;
        }

        const data = this.points.map(point => ({
            x: point.x,
            y: point.y
        }));

        const jsonString = JSON.stringify(data, null, 2);
        this.downloadFile('points.json', jsonString, 'application/json');
    }

    exportToJS() {
        if (this.points.length === 0) {
            alert('Нет точек для экспорта!');
            return;
        }

        const pointsArray = this.points.map(point => 
            `        {x: ${point.x}, y: ${point.y}}`
        ).join(',\n');

        const jsCode = `// Координаты точек для игрового поля
const pointsData = [
${pointsArray}
];

// Использование в GameBoard:
// initializePoints() {
//     pointsData.forEach((data, index) => {
//         this.points.push(new Point(data.x, data.y, index));
//     });
// }`;

        this.downloadFile('points.js', jsCode, 'text/javascript');
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Инициализация редактора
window.addEventListener('DOMContentLoaded', () => {
    new PointEditor('editorCanvas');
});
