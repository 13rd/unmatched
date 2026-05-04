const socket = io();

class GameSetup {
    constructor() {
        this.backgroundImage = null;
        this.backgroundImageData = null;
        this.pointsData = null;
        this.canvas = document.getElementById('previewCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.settings = {
            player1: { 
                character: null // Выбранный персонаж
            },
            player2: { 
                character: null // Выбранный персонаж
            }
        };
        
        this.availableCharacters = [];
        this.selectedCharacter1 = null;
        this.selectedCharacter2 = null;
        
        this.availableMaps = [];
        this.selectedMap = null;
        this.useCustomMap = false;
        
        this.socket = io();
        this.roomCode = null;
        this.isCreator = false;
        this.isJoining = false;
        this.userId = localStorage.getItem('userId');
        this.username = localStorage.getItem('username');
        
        // Проверка авторизации
        this.checkAuth();
        
        this.loadCharacters();
        this.loadMaps();
        this.setupEventListeners();
        this.setupSocketListeners();
    }

    checkAuth() {
        if (!this.userId || !this.username) {
            alert('Необходима авторизация!');
            window.location.href = 'auth.html';
            return;
        }
        
        // Отправляем данные пользователя на сервер сразу при подключении
        this.socket.on('connect', () => {
            this.socket.emit('user-auth', {
                userId: this.userId,
                username: this.username
            });
            console.log('Авторизован как:', this.username, this.userId);
        });
    }

    async loadCharacters() {
        try {
            const response = await fetch('/api/characters');
            const characters = await response.json();
            this.availableCharacters = characters;
            this.renderCharacterGalleries();
        } catch (error) {
            console.error('Ошибка загрузки персонажей:', error);
            this.showCharacterError();
        }
    }

    async loadMaps() {
        try {
            const response = await fetch('/api/maps');
            const maps = await response.json();
            this.availableMaps = maps;
            this.renderMapsGallery();
        } catch (error) {
            console.error('Ошибка загрузки карт:', error);
            this.showMapsError();
        }
    }

    renderMapsGallery() {
        const container = document.getElementById('savedMapsGallery');
        
        if (this.availableMaps.length === 0) {
            container.innerHTML = '<div class="error-message">Карты не найдены. Создайте карты в редакторе.</div>';
            return;
        }

        container.innerHTML = '';
        
        this.availableMaps.forEach((map, index) => {
            const card = document.createElement('div');
            card.className = 'map-card';
            card.dataset.mapIndex = index;
            
            const preview = document.createElement('div');
            preview.className = 'map-card-preview';
            
            if (map.backgroundImage) {
                const img = document.createElement('img');
                img.src = map.backgroundImage;
                img.alt = map.name;
                preview.appendChild(img);
            } else {
                preview.textContent = '🗺️';
                preview.style.fontSize = '48px';
            }
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'map-card-name';
            nameDiv.textContent = map.name;
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'map-card-info';
            infoDiv.textContent = `Точек: ${map.points ? map.points.length : 0}`;
            
            card.appendChild(preview);
            card.appendChild(nameDiv);
            card.appendChild(infoDiv);
            
            card.addEventListener('click', () => {
                this.selectMap(index);
            });
            
            container.appendChild(card);
        });
    }

    selectMap(mapIndex) {
        const map = this.availableMaps[mapIndex];
        this.selectedMap = map;
        
        // Устанавливаем данные карты
        this.backgroundImageData = map.backgroundImage;
        this.pointsData = map.points;
        
        // Загружаем изображение для превью
        if (map.backgroundImage) {
            this.backgroundImage = new Image();
            this.backgroundImage.onload = () => this.drawPreview();
            this.backgroundImage.src = map.backgroundImage;
        }
        
        // Обновляем визуальное выделение
        const container = document.getElementById('savedMapsGallery');
        container.querySelectorAll('.map-card').forEach(card => {
            card.classList.remove('selected');
        });
        container.querySelector(`[data-map-index="${mapIndex}"]`).classList.add('selected');

        // Обновляем информацию о выбранной карте
        this.updateSelectedMapInfo(map);
    }

    updateSelectedMapInfo(map) {
        const infoContainer = document.getElementById('selectedMapInfo');
        infoContainer.classList.add('has-map');
        
        infoContainer.innerHTML = `
            <p><strong>Выбрана карта:</strong> ${map.name}</p>
            <p><strong>Точек на карте:</strong> ${map.points ? map.points.length : 0}</p>
        `;
    }

    showMapsError() {
        document.getElementById('savedMapsGallery').innerHTML = 
            '<div class="error-message">Ошибка загрузки карт</div>';
    }

    renderCharacterGalleries() {
        this.renderCharacterGallery('player1CharacterGallery', 1);
        this.renderCharacterGallery('player2CharacterGallery', 2);
    }

    renderCharacterGallery(containerId, playerNum) {
        const container = document.getElementById(containerId);
        
        if (this.availableCharacters.length === 0) {
            container.innerHTML = '<div class="error-message">Персонажи не найдены. Создайте персонажей в редакторе.</div>';
            return;
        }

        container.innerHTML = '';
        
        this.availableCharacters.forEach((character, index) => {
            const card = document.createElement('div');
            card.className = 'character-card';
            card.dataset.characterIndex = index;
            
            const imageDiv = document.createElement('div');
            imageDiv.className = 'character-card-image';
            
            if (character.mainToken && character.mainToken.image) {
                const img = document.createElement('img');
                img.src = character.mainToken.image;
                img.alt = character.name;
                imageDiv.style.backgroundColor = character.mainToken.color;
                imageDiv.appendChild(img);
            }
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'character-card-name';
            nameDiv.textContent = character.name;
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'character-card-info';
            const extraCount = character.extraTokens ? character.extraTokens.length : 0;
            infoDiv.textContent = `HP: ${character.mainToken.hp} | Помощники: ${extraCount}`;
            
            card.appendChild(imageDiv);
            card.appendChild(nameDiv);
            card.appendChild(infoDiv);
            
            card.addEventListener('click', () => {
                this.selectCharacter(playerNum, index, containerId);
            });
            
            container.appendChild(card);
        });
    }

    selectCharacter(playerNum, characterIndex, containerId) {
        const character = this.availableCharacters[characterIndex];
        
        if (playerNum === 1) {
            this.selectedCharacter1 = character;
            this.settings.player1.character = character;
        } else {
            this.selectedCharacter2 = character;
            this.settings.player2.character = character;
        }

        // Обновляем визуальное выделение
        const container = document.getElementById(containerId);
        container.querySelectorAll('.character-card').forEach(card => {
            card.classList.remove('selected');
        });
        container.querySelector(`[data-character-index="${characterIndex}"]`).classList.add('selected');

        // Обновляем информацию о выбранном персонаже
        this.updateSelectedCharacterInfo(playerNum, character);
    }

    updateSelectedCharacterInfo(playerNum, character) {
        const infoContainer = document.getElementById(`player${playerNum}SelectedCharacter`);
        infoContainer.classList.add('has-character');
        
        const extraCount = character.extraTokens ? character.extraTokens.length : 0;
        
        infoContainer.innerHTML = `
            <p><strong>Выбран:</strong> ${character.name}</p>
            <p><strong>Главный токен:</strong> HP ${character.mainToken.hp}</p>
            <p><strong>Дополнительные токены:</strong> ${extraCount} шт., HP ${character.extraTokenHP}</p>
            <p><strong>Колода:</strong> 30 карт</p>
        `;
    }

    showCharacterError() {
        document.getElementById('player1CharacterGallery').innerHTML = 
            '<div class="error-message">Ошибка загрузки персонажей</div>';
        document.getElementById('player2CharacterGallery').innerHTML = 
            '<div class="error-message">Ошибка загрузки персонажей</div>';
    }

    initializeColorPickers() {
        // Удалено - больше не нужно
    }

    createColorPicker(elementId, player, isMain) {
        // Удалено - больше не нужно
    }

    selectColor(elementId, selectedDiv, pair, player, isMain) {
        // Удалено - больше не нужно
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

        // Переключение между готовыми картами и загрузкой своей
        document.getElementById('savedMapsTab').addEventListener('click', () => {
            this.useCustomMap = false;
            document.getElementById('savedMapsSection').style.display = 'block';
            document.getElementById('customMapSection').style.display = 'none';
            document.getElementById('savedMapsTab').classList.add('active');
            document.getElementById('customMapTab').classList.remove('active');
        });

        document.getElementById('customMapTab').addEventListener('click', () => {
            this.useCustomMap = true;
            document.getElementById('savedMapsSection').style.display = 'none';
            document.getElementById('customMapSection').style.display = 'block';
            document.getElementById('customMapTab').classList.add('active');
            document.getElementById('savedMapsTab').classList.remove('active');
        });

        // Загрузка фона (для кастомной карты)
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

        // Кнопка старта игры
        document.getElementById('startGame').addEventListener('click', () => {
            this.startGame();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            window.location.href = 'auth.html';
        });

        // Отображение имени пользователя
        document.getElementById('currentUsername').textContent = this.username;
    }

    validateDeck(deckData) {
        // Проверяем, что колода содержит 30 карт
        if (!deckData.cards || !Array.isArray(deckData.cards)) {
            return false;
        }
        
        if (deckData.cards.length !== 30) {
            return false;
        }
        
        // Проверяем, что каждая карта имеет необходимые поля
        for (const card of deckData.cards) {
            if (!card.text && !card.image) {
                return false;
            }
        }
        
        return true;
    }

    setupSocketListeners() {
        this.socket.on('room-created', (data) => {
            this.roomCode = data.roomCode;
            document.getElementById('currentRoomCode').textContent = data.roomCode;
            document.getElementById('roomCodeDisplay').style.display = 'block';
            
            // Сохраняем только код комнаты (персонажи загрузятся с сервера)
            try {
                sessionStorage.setItem('roomCode', data.roomCode);
                
            } catch (e) {
                console.error('Ошибка сохранения настроек:', e);
                alert('Ошибка сохранения настроек.');
                return;
            }
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        });

        this.socket.on('room-joined', (data) => {
            this.roomCode = data.roomCode;
            
            // Сохраняем только код комнаты
            try {
                sessionStorage.setItem('roomCode', data.roomCode);
                
            } catch (e) {
                console.error('Ошибка сохранения настроек:', e);
                alert('Ошибка сохранения настроек.');
                return;
            }
            
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
            // Проверяем карту
            if (!this.useCustomMap && !this.selectedMap) {
                alert('Выберите карту из списка или загрузите свою!');
                return;
            }
            
            if (this.useCustomMap) {
                if (!this.backgroundImageData) {
                    alert('Загрузите фоновое изображение!');
                    return;
                }

                if (!this.pointsData) {
                    alert('Загрузите точки!');
                    return;
                }
            }

            if (!this.settings.player1.character) {
                alert('Выберите персонажа для Игрока 1!');
                return;
            }

            if (!this.settings.player2.character) {
                alert('Выберите персонажа для Игрока 2!');
                return;
            }

            // Создаем объект настроек
            const gameSettings = {
                backgroundImage: this.backgroundImageData,
                points: this.pointsData,
                player1: {
                    character: this.settings.player1.character
                },
                player2: {
                    character: this.settings.player2.character
                }
            };

            // Отправляем запрос на создание комнаты
            this.socket.emit('create-room', gameSettings);
        } else {
            alert('Выберите режим игры: создать комнату или присоединиться');
        }
    
    }
    socket.emit('joinRoom', roomCode);
});

socket.on('roomJoined', (data) => {
    window.location.href = `index.html?room=${data.roomId}`;
});

socket.on('error', (data) => {
    alert(data.message);
});