const COLOR_PAIRS = [
    { main: '#e53e3e', extra: '#fc8181' },
    { main: '#3182ce', extra: '#63b3ed' },
    { main: '#38a169', extra: '#68d391' },
    { main: '#d69e2e', extra: '#f6e05e' },
    { main: '#805ad5', extra: '#b794f4' },
    { main: '#dd6b20', extra: '#f6ad55' },
    { main: '#c53030', extra: '#f56565' },
    { main: '#2c5282', extra: '#4299e1' },
    { main: '#276749', extra: '#48bb78' },
    { main: '#975a16', extra: '#ecc94b' },
    { main: '#553c9a', extra: '#9f7aea' },
    { main: '#9c4221', extra: '#ed8936' },
    { main: '#e91e63', extra: '#f48fb1' },
    { main: '#00bcd4', extra: '#80deea' },
    { main: '#4caf50', extra: '#a5d6a7' },
    { main: '#ff9800', extra: '#ffcc80' },
    { main: '#795548', extra: '#bcaaa4' },
    { main: '#607d8b', extra: '#b0bec5' },
    { main: '#8e24aa', extra: '#ce93d8' }
];

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

    containsPoint(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
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
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius - 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    containsPoint(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
}

class GameBoard {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this.chips = [];
        this.draggedChip = null;
        this.snapDistance = 80;
        this.hpPanel = null;
        
        this.roomId = null;
        this.myPlayer = null;
        this.isHost = false;
        
        this.backgroundImage = new Image();
        this.backgroundImage.onload = () => this.draw();
        
        this.initSocket();
    }

    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('roomCreated', (data) => {
            this.roomId = data.roomId;
            this.myPlayer = data.player;
            this.isHost = true;
            document.getElementById('roomInfo').style.display = 'block';
            document.getElementById('roomCode').textContent = data.roomId;
            document.getElementById('copyLink').onclick = () => this.copyInviteLink(data.roomId);
            this.initGame();
        });
        
        this.socket.on('roomJoined', (data) => {
            this.roomId = data.roomId;
            this.myPlayer = data.player;
            document.getElementById('roomInfo').style.display = 'block';
            document.getElementById('roomCode').textContent = data.roomId;
            document.getElementById('copyLink').onclick = () => this.copyInviteLink(data.roomId);
            this.applyGameState(data.gameState);
        });
        
        this.socket.on('error', (data) => {
            alert(data.message);
            window.location.href = 'setup.html';
        });
        
        this.socket.on('playerJoined', (data) => {
            document.getElementById('playerCount').textContent = data.players.length;
        });
        
        this.socket.on('playerLeft', (data) => {
            document.getElementById('playerCount').textContent = '1';
            alert('Другой игрок покинул игру');
        });
        
        this.socket.on('backgroundUpdated', (imageData) => {
            if (imageData) {
                this.backgroundImage.src = imageData;
            }
        });
        
        this.socket.on('pointsUpdated', (points) => {
            this.points = points.map(p => new Point(p.x, p.y, p.id));
            this.draw();
        });
        
        this.socket.on('chipMoved', (data) => {
            let chip = this.chips.find(c => c.id === data.chipId);
            if (chip) {
                chip.x = data.x;
                chip.y = data.y;
                if (data.pointId !== undefined) {
                    const point = this.points.find(p => p.id === data.pointId);
                    if (point && !point.chip) {
                        point.attachChip(chip);
                        chip.attachedPoint = point;
                    }
                }
            }
            this.draw();
        });
        
        this.socket.on('chipAttached', (data) => {
            const chip = this.chips.find(c => c.id === data.chipId);
            const point = this.points.find(p => p.id === data.pointId);
            if (chip && point) {
                point.attachChip(chip);
            }
            this.draw();
        });
        
        this.socket.on('chipDetached', (data) => {
            const chip = this.chips.find(c => c.id === data.chipId);
            if (chip && chip.attachedPoint) {
                chip.attachedPoint.detachChip();
            }
            this.draw();
        });
        
        this.socket.on('hpUpdated', (data) => {
            const chip = this.chips.find(c => c.id === data.chipId);
            if (chip) {
                chip.hp = data.hp;
                if (this.hpPanel) {
                    this.hpPanel.renderChips();
                }
            }
        });
        
        this.socket.on('gameReset', () => {
            this.chips = [];
            this.points.forEach(p => p.chip = null);
            this.draw();
            if (this.hpPanel) {
                this.hpPanel.renderChips();
            }
        });
    }

    copyInviteLink(roomId) {
        const url = `${window.location.origin}?room=${roomId}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Ссылка скопирована! Отправьте её второму игроку.');
        });
    }

    initGame() {
        const params = new URLSearchParams(window.location.search);
        const bgImage = sessionStorage.getItem('gameBackgroundImage');
        const pointsData = sessionStorage.getItem('gamePoints');
        
        if (bgImage) {
            this.backgroundImage.src = bgImage;
            this.socket.emit('setBackground', this.roomId, bgImage);
        }
        
        if (pointsData) {
            const points = JSON.parse(pointsData);
            this.points = points.map(p => new Point(p.x, p.y, p.id));
            this.socket.emit('setPoints', this.roomId, points);
        } else {
            this.createDefaultPoints();
        }
        
        this.createPlayerChips();
    }

    createDefaultPoints() {
        const centerX = 600;
        const centerY = 400;
        const rows = [0, 80, 160, 240];
        const counts = [1, 4, 6, 4];
        
        let id = 0;
        const points = [];
        rows.forEach((offsetY, rowIndex) => {
            const count = counts[rowIndex];
            const spacing = 120;
            const startX = centerX - ((count - 1) * spacing) / 2;
            
            for (let i = 0; i < count; i++) {
                points.push({ id: id++, x: startX + i * spacing, y: centerY + offsetY - 120 });
            }
        });
        
        this.points = points.map(p => new Point(p.x, p.y, p.id));
        this.socket.emit('setPoints', this.roomId, points);
    }

    createPlayerChips() {
        const settings = JSON.parse(sessionStorage.getItem('gameSettings') || '{}');
        const freePoints = this.points.filter(p => !p.chip);
        let pointIndex = 0;
        
        const colors = COLOR_PAIRS[Math.floor(Math.random() * COLOR_PAIRS.length)];
        const colors2 = COLOR_PAIRS[(COLOR_PAIRS.indexOf(colors) + 1) % COLOR_PAIRS.length];
        
        sessionStorage.setItem('playerColors', JSON.stringify({
            player1: colors,
            player2: colors2
        }));
        
        if (pointIndex < freePoints.length) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, colors.main, 0, true, 'player1');
            this.chips.push(chip);
            point.attachChip(chip);
            this.socket.emit('chipMoved', this.roomId, {
                chipId: 0,
                x: point.x,
                y: point.y,
                color: colors.main,
                player: 'player1',
                isMain: true,
                pointId: point.id
            });
        }
        
        for (let i = 0; i < 2 && pointIndex < freePoints.length; i++) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, colors.extra, this.chips.length, false, 'player1');
            this.chips.push(chip);
            point.attachChip(chip);
            this.socket.emit('chipMoved', this.roomId, {
                chipId: chip.id,
                x: point.x,
                y: point.y,
                color: colors.extra,
                player: 'player1',
                isMain: false,
                pointId: point.id
            });
        }
        
        if (pointIndex < freePoints.length) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, colors2.main, this.chips.length, true, 'player2');
            this.chips.push(chip);
            point.attachChip(chip);
            this.socket.emit('chipMoved', this.roomId, {
                chipId: chip.id,
                x: point.x,
                y: point.y,
                color: colors2.main,
                player: 'player2',
                isMain: true,
                pointId: point.id
            });
        }
        
        for (let i = 0; i < 2 && pointIndex < freePoints.length; i++) {
            const point = freePoints[pointIndex++];
            const chip = new Chip(point.x, point.y, colors2.extra, this.chips.length, false, 'player2');
            this.chips.push(chip);
            point.attachChip(chip);
            this.socket.emit('chipMoved', this.roomId, {
                chipId: chip.id,
                x: point.x,
                y: point.y,
                color: colors2.extra,
                player: 'player2',
                isMain: false,
                pointId: point.id
            });
        }
        
        this.draw();
        if (this.hpPanel) this.hpPanel.renderChips();
    }

    applyGameState(gameState) {
        if (gameState.backgroundImage) {
            this.backgroundImage.src = gameState.backgroundImage;
        }
        
        if (gameState.points && gameState.points.length > 0) {
            this.points = gameState.points.map(p => new Point(p.x, p.y, p.id));
        }
        
        if (gameState.chips) {
            this.chips = gameState.chips.map(c => {
                const chip = new Chip(c.x, c.y, c.color, c.id, c.isMain, c.player);
                chip.hp = c.hp;
                chip.maxHp = c.maxHp;
                return chip;
            });
            
            this.points.forEach(point => {
                const chip = this.chips.find(c => c.pointId === point.id);
                if (chip) {
                    point.attachChip(chip);
                }
            });
        }
        
        this.draw();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        document.getElementById('clearBoard').addEventListener('click', () => {
            this.chips = [];
            this.points.forEach(p => p.chip = null);
            this.draw();
            this.socket.emit('resetGame', this.roomId);
            if (this.hpPanel) this.hpPanel.renderChips();
        });
        
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
        
        for (let i = this.chips.length - 1; i >= 0; i--) {
            if (this.chips[i].containsPoint(pos.x, pos.y)) {
                this.draggedChip = this.chips[i];
                this.draggedChip.isDragging = true;
                
                if (this.draggedChip.attachedPoint) {
                    this.draggedChip.attachedPoint.detachChip();
                    this.socket.emit('chipDetached', this.roomId, { chipId: this.draggedChip.id });
                }
                
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
            
            this.points.forEach(point => {
                point.isHovered = point.containsPoint(pos.x, pos.y);
            });
            
            this.draw();
        } else {
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
        if (!this.draggedChip) return;
        
        const pos = this.getMousePos(e);
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
            this.socket.emit('chipAttached', this.roomId, {
                chipId: this.draggedChip.id,
                pointId: closestPoint.id,
                x: this.draggedChip.x,
                y: this.draggedChip.y
            });
        }
        
        this.draggedChip.isDragging = false;
        this.draggedChip = null;
        
        this.points.forEach(point => point.isHovered = false);
        this.draw();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.backgroundImage.complete) {
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#f5f5f5';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.points.forEach(point => point.draw(this.ctx));
        this.chips.forEach(chip => chip.draw(this.ctx));
    }
}

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
                this.gameBoard.socket.emit('updateHP', this.gameBoard.roomId, {
                    chipId: chip.id,
                    hp: chip.hp
                });
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
                this.gameBoard.socket.emit('updateHP', this.gameBoard.roomId, {
                    chipId: chip.id,
                    hp: chip.hp
                });
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
        hpElement.style.color = chip.hp === 0 ? '#e53e3e' : '#2d3748';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const gameBoard = new GameBoard('gameCanvas');
    gameBoard.hpPanel = new HPPanel(gameBoard);
    gameBoard.setupEventListeners();
});