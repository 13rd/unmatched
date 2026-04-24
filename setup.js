// Предопределенные цветовые пары
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
    { main: '#9e9e9e', extra: '#e0e0e0' },
    { main: '#795548', extra: '#bcaaa4' },
    { main: '#607d8b', extra: '#b0bec5' },
    { main: '#8e24aa', extra: '#ce93d8' }
];

class GameSetup {
    constructor() {
        this.backgroundImage = null;
        this.backgroundImageData = null;
        this.pointsData = null;
        this.canvas = document.getElementById('previewCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.settings = {
            player1: { mainColor: null, mainHP: 14, extraColor: null, extraHP: 1, extraCount: 3 },
            player2: { mainColor: null, mainHP: 14, extraColor: null, extraHP: 1, extraCount: 3 }
        };
        
        this.socket = io();
        this.roomCode = null;
        this.isCreator = false;
        this.isJoining = false;
        
        this.initializeColorPickers();
        this.setupEventListeners();
        this.setupSocketListeners();
    }

    initializeColorPickers() {
        this.createColorPicker('setup-player1-main-colors', 'player1', true);
        this.createColorPicker('setup-player1-extra-colors', 'player1', false);
        this.createColorPicker('setup-player2-main-colors', 'player2', true);
        this.createColorPicker('setup-player2-extra-colors', 'player2', false);
    }

    createColorPicker(elementId, player, isMain) {
        const container = document.getElementById(elementId);
        
        COLOR_PAIRS.forEach((pair, index) => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-option';
            colorDiv.style.backgroundColor = isMain ? pair.main : pair.extra;
            colorDiv.dataset.pairIndex = index;
            
            colorDiv.addEventListener('click', () => {
                this.selectColor(elementId, colorDiv, pair, player, isMain);
            });
            
            container.appendChild(colorDiv);
        });
    }

    selectColor(elementId, selectedDiv, pair, player, isMain) {
        const container = document.getElementById(elementId);
        container.querySelectorAll('.color-option').forEach(div => {
            div.classList.remove('selected');
        });
        
        selectedDiv.classList.add('selected');
        
        if (isMain) {
            this.settings[player].mainColor = pair.main;
        } else {
            this.settings[player].extraColor = pair.extra;
        }
    }

    setupEventListeners() {
        // Кнопки выбора режима
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.isCreator = true;
            this.isJoining = false;
            document.getElementById('joinRoomSection').style.display = 'none';
            alert('Настройте игру и нажмите "Начать игру" для создания комнаты');
        });

        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.isJoining = true;
            this.isCreator = false;
            document.getElementById('joinRoomSection').style.display = 'block';
        });

        document.getElementById('joinRoomConfirm').addEventListener('click', () => {
            const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
            if (roomCode.length === 6) {
                this.joinRoom(roomCode);
            } else {
                alert('Введите корректный код комнаты (6 символов)');
            }
        });

        // Загрузка фона
        document.getElementById('setupBackgroundUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('backgroundFileName').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.backgroundImageData = event.target.result;
                    this.backgroundImage = new Image();
                    this.backgroundImage.onload = () => this.drawPreview();
                    this.backgroundImage.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        // Загрузка точек
        document.getElementById('setupPointsUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('pointsFileName').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        this.pointsData = JSON.parse(event.target.result);
                        this.drawPreview();
                    } catch (error) {
                        alert('Ошибка при загрузке JSON: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        });

        // Обновление количества фишек
        document.getElementById('setup-player1-extra-count').addEventListener('change', (e) => {
            this.settings.player1.extraCount = parseInt(e.target.value);
        });

        document.getElementById('setup-player2-extra-count').addEventListener('change', (e) => {
            this.settings.player2.extraCount = parseInt(e.target.value);
        });

        document.getElementById('setup-player1-main-hp').addEventListener('change', (e) => {
            this.settings.player1.mainHP = parseInt(e.target.value);
        });

        document.getElementById('setup-player1-extra-hp').addEventListener('change', (e) => {
            this.settings.player1.extraHP = parseInt(e.target.value);
        });

        document.getElementById('setup-player2-main-hp').addEventListener('change', (e) => {
            this.settings.player2.mainHP = parseInt(e.target.value);
        });

        document.getElementById('setup-player2-extra-hp').addEventListener('change', (e) => {
            this.settings.player2.extraHP = parseInt(e.target.value);
        });

        // Кнопка старта игры
        document.getElementById('startGame').addEventListener('click', () => {
            this.startGame();
        });
    }

    setupSocketListeners() {
        this.socket.on('room-created', (data) => {
            this.roomCode = data.roomCode;
            document.getElementById('currentRoomCode').textContent = data.roomCode;
            document.getElementById('roomCodeDisplay').style.display = 'block';
            
            // Сохраняем настройки и переходим к игре
            sessionStorage.setItem('gameSettings', JSON.stringify(data.settings));
            sessionStorage.setItem('roomCode', data.roomCode);
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        });

        this.socket.on('room-joined', (data) => {
            this.roomCode = data.roomCode;
            
            // Сохраняем настройки полученные от сервера
            sessionStorage.setItem('gameSettings', JSON.stringify(data.settings));
            sessionStorage.setItem('roomCode', data.roomCode);
            
            alert('Успешно подключились к комнате!');
            window.location.href = 'index.html';
        });

        this.socket.on('room-error', (message) => {
            alert('Ошибка: ' + message);
        });
    }

    joinRoom(roomCode) {
        this.socket.emit('join-room', roomCode);
    }

    drawPreview() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем фон
        if (this.backgroundImage && this.backgroundImage.complete) {
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#f5f5f5';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Рисуем точки (масштабированные для превью)
        if (this.pointsData) {
            const scaleX = this.canvas.width / 1200;
            const scaleY = this.canvas.height / 800;
            
            this.pointsData.forEach(point => {
                this.ctx.beginPath();
                this.ctx.arc(point.x * scaleX, point.y * scaleY, 10, 0, Math.PI * 2);
                this.ctx.fillStyle = '#4a5568';
                this.ctx.fill();
                this.ctx.strokeStyle = '#1a202c';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            });
        }
    }

    startGame() {
        // Если пользователь присоединяется к комнате, не нужно создавать новую
        if (this.isJoining) {
            alert('Используйте кнопку "Подключиться" для входа в комнату');
            return;
        }

        // Проверяем, что все настройки заполнены (только для создателя)
        if (this.isCreator) {
            if (!this.backgroundImageData) {
                alert('Загрузите фоновое изображение!');
                return;
            }

            if (!this.pointsData) {
                alert('Загрузите точки!');
                return;
            }

            if (!this.settings.player1.mainColor || !this.settings.player1.extraColor) {
                alert('Выберите цвета для Игрока 1!');
                return;
            }

            if (!this.settings.player2.mainColor || !this.settings.player2.extraColor) {
                alert('Выберите цвета для Игрока 2!');
                return;
            }

            // Создаем объект настроек
            const gameSettings = {
                backgroundImage: this.backgroundImageData,
                points: this.pointsData,
                player1: this.settings.player1,
                player2: this.settings.player2
            };

            // Отправляем запрос на создание комнаты
            this.socket.emit('create-room', gameSettings);
        } else {
            alert('Выберите режим игры: создать комнату или присоединиться к существующей');
        }
    }
}

// Инициализация
window.addEventListener('DOMContentLoaded', () => {
    new GameSetup();
});
