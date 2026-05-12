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
        document.getElementById('imageUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('fileName').textContent = file.name;
                const formData = new FormData();
                formData.append('image', file);
                
                try {
                    const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error('Ошибка загрузки изображения');
                    }
                    
                    const result = await response.json();
                    // Store the server path
                    this.backgroundImage = new Image();
                    this.backgroundImage.onload = () => this.draw();
                    this.backgroundImage.src = result.url;
                } catch (error) {
                    console.error('Ошибка загрузки изображения:', error);
                    alert('Не удалось загрузить изображение: ' + error.message);
                }
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

// Класс для редактора колод
class DeckEditor {
    constructor() {
        this.backImage = null;
        this.cards = [];
        this.maxCards = 30;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Загрузка рубашки
        document.getElementById('deckBackUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('deckBackFileName').textContent = file.name;
                const formData = new FormData();
                formData.append('image', file);
                
                try {
                    const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error('Ошибка загрузки изображения');
                    }
                    
                    const result = await response.json();
                    this.backImage = result.url; // Store the server path
                    this.updateBackPreview();
                } catch (error) {
                    console.error('Ошибка загрузки изображения рубашки:', error);
                    alert('Не удалось загрузить изображение рубашки: ' + error.message);
                }
            }
        });

        // Загрузка карт
        document.getElementById('cardsUpload').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            
            if (this.cards.length + files.length > this.maxCards) {
                alert(`Можно загрузить максимум ${this.maxCards} карт. Сейчас загружено: ${this.cards.length}`);
                return;
            }

            for (const file of files) {
                const formData = new FormData();
                formData.append('image', file);
                
                try {
                    const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error('Ошибка загрузки изображения');
                    }
                    
                    const result = await response.json();
                    this.cards.push({
                        image: result.url, // Store the server path
                        text: file.name.replace(/\.[^/.]+$/, '') // Имя файла без расширения
                    });
                    this.updateCardsGrid();
                    this.updateCardsCount();
                } catch (error) {
                    console.error('Ошибка загрузки изображения карты:', error);
                    alert('Не удалось загрузить изображение карты: ' + error.message);
                }
            }
        });

        // Очистка колоды
        document.getElementById('clearDeck').addEventListener('click', () => {
            if (confirm('Очистить всю колоду?')) {
                this.cards = [];
                this.backImage = null;
                this.updateCardsGrid();
                this.updateCardsCount();
                this.updateBackPreview();
                document.getElementById('deckBackFileName').textContent = 'Рубашка не выбрана';
            }
        });

        // Экспорт колоды
        document.getElementById('exportDeck').addEventListener('click', () => {
            this.exportDeck();
        });

        // Импорт колоды
        document.getElementById('importDeck').addEventListener('click', () => {
            document.getElementById('importDeckFile').click();
        });

        document.getElementById('importDeckFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const deckData = JSON.parse(event.target.result);
                        this.importDeck(deckData);
                    } catch (error) {
                        alert('Ошибка при загрузке колоды: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        });
    }

    updateBackPreview() {
        const preview = document.getElementById('backPreview');
        if (this.backImage) {
            preview.innerHTML = `<img src="${this.backImage}" alt="Рубашка">`;
        } else {
            preview.innerHTML = '<div class="card-preview-placeholder">Загрузите изображение</div>';
        }
    }

    updateCardsGrid() {
        const grid = document.getElementById('cardsGrid');
        grid.innerHTML = '';

        this.cards.forEach((card, index) => {
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            
            const img = document.createElement('img');
            img.src = card.image;
            
            const number = document.createElement('div');
            number.className = 'card-item-number';
            number.textContent = index + 1;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'card-item-remove';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => this.removeCard(index);
            
            cardItem.appendChild(img);
            cardItem.appendChild(number);
            cardItem.appendChild(removeBtn);
            grid.appendChild(cardItem);
        });
    }

    updateCardsCount() {
        document.getElementById('cardsCount').textContent = `Загружено: ${this.cards.length} / ${this.maxCards}`;
    }

    removeCard(index) {
        this.cards.splice(index, 1);
        this.updateCardsGrid();
        this.updateCardsCount();
    }

    // Old exportDeck removed - now using saveToServer method

    importDeck(deckData) {
        if (!deckData.cards || !Array.isArray(deckData.cards)) {
            alert('Неверный формат колоды!');
            return;
        }

        if (deckData.cards.length !== this.maxCards) {
            alert(`Колода должна содержать ${this.maxCards} карт!`);
            return;
        }

        this.cards = deckData.cards;
        this.backImage = deckData.backImage || null;
        
        this.updateCardsGrid();
        this.updateCardsCount();
        this.updateBackPreview();
        
        if (this.backImage) {
            document.getElementById('deckBackFileName').textContent = 'Загружено из файла';
        }

        alert('Колода успешно импортирована!');
    }
}

// Класс для редактора персонажей
class CharacterEditor {
    constructor() {
        this.characterName = '';
        this.speed = 3;
        this.characterImages = [];
        this.deck = null; // { backImage, cards }
        this.mainToken = {
            image: null,
            color: '#ff0000',
            hp: 14,
            attackType: 'melee'
        };
        this.extraTokens = [];
        this.extraTokensCount = 3;
        this.extraTokenHP = 1;
        this.counters = [];
        this.countersCount = 0;
        
        this.setupEventListeners();
        this.updateExtraTokensFields();
        this.updateCountersFields();
    }

    setupEventListeners() {
        // Имя персонажа
        document.getElementById('characterName').addEventListener('input', (e) => {
            this.characterName = e.target.value;
        });

        // Загрузка колоды из JSON
        document.getElementById('loadDeckFromJSON').addEventListener('click', () => {
            document.getElementById('deckJSONUpload').click();
        });

        document.getElementById('deckJSONUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const deckData = JSON.parse(event.target.result);
                        if (this.validateDeck(deckData)) {
                            this.deck = deckData;
                            this.updateDeckStatus(true);
                            document.getElementById('deckImagesSection').style.display = 'none';
                        }
                    } catch (error) {
                        alert('Ошибка при загрузке колоды: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        });

        // Загрузка колоды картами
        document.getElementById('loadDeckFromImages').addEventListener('click', () => {
            document.getElementById('deckImagesSection').style.display = 'block';
        });

        // Загрузка рубашки колоды для карт
        document.getElementById('charDeckBackUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('charDeckBackFileName').textContent = file.name;
                const formData = new FormData();
                formData.append('image', file);
                
                try {
                    const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error('Ошибка загрузки изображения');
                    }
                    
                    const result = await response.json();
                    if (!this.deck) {
                        this.deck = { backImage: null, cards: [] };
                    }
                    this.deck.backImage = result.url; // Store the server path
                    this.checkDeckComplete();
                } catch (error) {
                    console.error('Ошибка загрузки изображения рубашки колоды:', error);
                    alert('Не удалось загрузить изображение рубашки колоды: ' + error.message);
                }
            }
        });

        // Загрузка карт колоды
        document.getElementById('charCardsUpload').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);

            if (!this.deck) {
                this.deck = { backImage: null, cards: [] };
            }

            if (this.deck.cards.length + files.length > 30) {
                alert(`Можно загрузить максимум 30 карт. Сейчас загружено: ${this.deck.cards.length}`);
                return;
            }

            for (const file of files) {
                const formData = new FormData();
                formData.append('image', file);

                try {
                    const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error('Ошибка загрузки изображения');
                    }

                    const result = await response.json();
                    this.deck.cards.push({
                        image: result.url,
                        text: file.name.replace(/\.[^/.]+$/, '')
                    });
                    this.updateCharCardsGrid();
                    this.updateCharCardsCount();
                    this.checkDeckComplete();
                } catch (error) {
                    console.error('Ошибка загрузки изображения карты:', error);
                    alert('Не удалось загрузить изображение карты: ' + error.message);
                }
            }
        });

        // Главный токен - изображение
        document.getElementById('mainTokenImage').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('mainTokenImageName').textContent = file.name;
                const formData = new FormData();
                formData.append('image', file);
                
                try {
                    const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error('Ошибка загрузки изображения');
                    }
                    
                    const result = await response.json();
                    this.mainToken.image = result.url; // Store the server path
                    this.updateMainTokenPreview();
                } catch (error) {
                    console.error('Ошибка загрузки изображения главного токена:', error);
                    alert('Не удалось загрузить изображение главного токена: ' + error.message);
                }
            }
        });

        // Главный токен - цвет
        document.getElementById('mainTokenColor').addEventListener('change', (e) => {
            this.mainToken.color = e.target.value;
            this.updateMainTokenPreview();
        });

        // Главный токен - HP
        document.getElementById('mainTokenHP').addEventListener('change', (e) => {
            this.mainToken.hp = parseInt(e.target.value);
        });

        // Главный токен - тип атаки
        document.getElementById('mainTokenAttackType').addEventListener('change', (e) => {
            this.mainToken.attackType = e.target.value;
        });

        // Скорость персонажа
        document.getElementById('characterSpeed').addEventListener('change', (e) => {
            this.speed = parseInt(e.target.value);
        });

        // Изображения персонажа (1-3)
        for (let slot = 0; slot < 3; slot++) {
            document.getElementById(`characterImage${slot}`).addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const formData = new FormData();
                    formData.append('image', file);
                    
                    try {
                        const response = await fetch('/api/upload-image', {
                            method: 'POST',
                            body: formData
                        });
                        
                        if (!response.ok) {
                            throw new Error('Ошибка загрузки изображения');
                        }
                        
                        const result = await response.json();
                        this.characterImages[slot] = result.url;
                        this.updateCharacterImagePreview();
                    } catch (error) {
                        console.error('Ошибка загрузки изображения персонажа:', error);
                        alert('Не удалось загрузить изображение персонажа: ' + error.message);
                    }
                }
            });
        }

        // Количество дополнительных токенов
        document.getElementById('extraTokensCount').addEventListener('change', (e) => {
            this.extraTokensCount = parseInt(e.target.value);
            this.updateExtraTokensFields();
        });

        // HP дополнительных токенов
        document.getElementById('extraTokenHP').addEventListener('change', (e) => {
            this.extraTokenHP = parseInt(e.target.value);
        });

        // Количество счётчиков
        document.getElementById('countersCount').addEventListener('change', (e) => {
            this.countersCount = parseInt(e.target.value);
            this.updateCountersFields();
        });

        // Очистить всё
        document.getElementById('clearCharacter').addEventListener('click', () => {
            if (confirm('Очистить все данные персонажа?')) {
                this.clearAll();
            }
        });

        // Экспорт персонажа
        document.getElementById('exportCharacter').addEventListener('click', () => {
            this.exportCharacter();
        });

        // Импорт персонажа
        document.getElementById('importCharacter').addEventListener('click', () => {
            document.getElementById('importCharacterFile').click();
        });

        document.getElementById('importCharacterFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const characterData = JSON.parse(event.target.result);
                        this.importCharacter(characterData);
                    } catch (error) {
                        alert('Ошибка при загрузке персонажа: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        });
    }

    validateDeck(deckData) {
        if (!deckData.cards || !Array.isArray(deckData.cards)) {
            alert('Неверный формат колоды!');
            return false;
        }
        if (deckData.cards.length !== 30) {
            alert('Колода должна содержать 30 карт!');
            return false;
        }
        return true;
    }

    updateDeckStatus(loaded) {
        const status = document.getElementById('deckStatus');
        if (loaded) {
            status.textContent = 'Колода загружена (30 карт)';
            status.classList.add('loaded');
        } else {
            status.textContent = 'Колода не загружена';
            status.classList.remove('loaded');
        }
    }

    checkDeckComplete() {
        if (this.deck && this.deck.backImage && this.deck.cards.length === 30) {
            this.updateDeckStatus(true);
        }
    }

    updateCharCardsGrid() {
        const grid = document.getElementById('charCardsGrid');
        grid.innerHTML = '';

        if (this.deck && this.deck.cards) {
            this.deck.cards.forEach((card, index) => {
                const cardItem = document.createElement('div');
                cardItem.className = 'card-item';
                
                const img = document.createElement('img');
                img.src = card.image;
                
                const number = document.createElement('div');
                number.className = 'card-item-number';
                number.textContent = index + 1;
                
                cardItem.appendChild(img);
                cardItem.appendChild(number);
                grid.appendChild(cardItem);
            });
        }
    }

    updateCharCardsCount() {
        const count = this.deck ? this.deck.cards.length : 0;
        document.getElementById('charCardsCount').textContent = `Загружено: ${count} / 30`;
    }

    updateMainTokenPreview() {
        const preview = document.getElementById('mainTokenPreview');
        if (this.mainToken.image) {
            preview.style.backgroundColor = this.mainToken.color;
            preview.innerHTML = `<img src="${this.mainToken.image}" alt="Главный токен">`;
        } else {
            preview.style.backgroundColor = '#fff';
            preview.innerHTML = '<div class="token-preview-placeholder">Загрузите изображение</div>';
        }
    }

    updateCharacterImagePreview() {
        for (let slot = 0; slot < 3; slot++) {
            const preview = document.getElementById(`characterImagePreview${slot}`);
            if (this.characterImages[slot]) {
                preview.innerHTML = `<img src="${this.characterImages[slot]}" alt="Изображение персонажа ${slot + 1}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                const label = preview.closest('.character-image-slot').querySelector('.btn');
                if (label) label.textContent = `\u0417\u0430\u043C\u0435\u043D\u0438\u0442\u044C #${slot + 1}`;
            } else {
                preview.innerHTML = '<div class="image-preview-placeholder">\u041D\u0435\u0442</div>';
                const label = preview.closest('.character-image-slot').querySelector('.btn');
                if (label) label.textContent = `\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C #${slot + 1}`;
            }
        }
    }

    updateExtraTokensFields() {
        const container = document.getElementById('extraTokensContainer');
        container.innerHTML = '';

        // Обновляем массив дополнительных токенов
        while (this.extraTokens.length < this.extraTokensCount) {
            this.extraTokens.push({
                image: null,
                color: '#0000ff',
                attackType: 'melee'
            });
        }
        while (this.extraTokens.length > this.extraTokensCount) {
            this.extraTokens.pop();
        }

        // Создаём поля для каждого дополнительного токена
        this.extraTokens.forEach((token, index) => {
            const tokenItem = document.createElement('div');
            tokenItem.className = 'extra-token-item';
            
            tokenItem.innerHTML = `
                <h4>Дополнительный токен ${index + 1}</h4>
                <div class="extra-token-config">
                    <div class="extra-token-preview" id="extraTokenPreview${index}">
                        <div class="token-preview-placeholder">Загрузите изображение</div>
                    </div>
                    <div class="token-settings">
                        <div class="setting-group">
                            <label>Изображение:</label>
                            <input type="file" id="extraTokenImage${index}" accept="image/*" style="display: none;">
                            <label for="extraTokenImage${index}" class="btn">Загрузить изображение</label>
                            <span id="extraTokenImageName${index}">Не выбрано</span>
                        </div>
                        <div class="setting-group">
                            <label for="extraTokenColor${index}">Цвет токена:</label>
                            <input type="color" id="extraTokenColor${index}" value="${token.color}">
                        </div>
                        <div class="setting-group">
                            <label for="extraTokenAttackType${index}">Тип атаки:</label>
                            <select id="extraTokenAttackType${index}">
                                <option value="melee" ${token.attackType === 'melee' ? 'selected' : ''}>Ближняя</option>
                                <option value="ranged" ${token.attackType === 'ranged' ? 'selected' : ''}>Дальняя</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(tokenItem);

            // Добавляем обработчики для этого токена
            document.getElementById(`extraTokenImage${index}`).addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    document.getElementById(`extraTokenImageName${index}`).textContent = file.name;
                    const formData = new FormData();
                    formData.append('image', file);
                    
                    try {
                        const response = await fetch('/api/upload-image', {
                            method: 'POST',
                            body: formData
                        });
                        
                        if (!response.ok) {
                            throw new Error('Ошибка загрузки изображения');
                        }
                        
                        const result = await response.json();
                        this.extraTokens[index].image = result.url; // Store the server path
                        this.updateExtraTokenPreview(index);
                    } catch (error) {
                        console.error('Ошибка загрузки изображения дополнительного токена:', error);
                        alert('Не удалось загрузить изображение дополнительного токена: ' + error.message);
                    }
                }
            });

            document.getElementById(`extraTokenColor${index}`).addEventListener('change', (e) => {
                this.extraTokens[index].color = e.target.value;
                this.updateExtraTokenPreview(index);
            });

            document.getElementById(`extraTokenAttackType${index}`).addEventListener('change', (e) => {
                this.extraTokens[index].attackType = e.target.value;
            });

            // Обновляем превью если изображение уже загружено
            if (token.image) {
                this.updateExtraTokenPreview(index);
                document.getElementById(`extraTokenImageName${index}`).textContent = 'Загружено';
            }
        });
    }

    updateExtraTokenPreview(index) {
        const preview = document.getElementById(`extraTokenPreview${index}`);
        const token = this.extraTokens[index];
        
        if (token.image) {
            preview.style.backgroundColor = token.color;
            preview.innerHTML = `<img src="${token.image}" alt="Дополнительный токен ${index + 1}">`;
        } else {
            preview.style.backgroundColor = '#f7fafc';
            preview.innerHTML = '<div class="token-preview-placeholder">Загрузите изображение</div>';
        }
    }

    updateCountersFields() {
        const container = document.getElementById('countersContainer');
        container.innerHTML = '';

        // Обновляем массив счётчиков
        while (this.counters.length < this.countersCount) {
            this.counters.push({
                name: `Счётчик ${this.counters.length + 1}`,
                minValue: 0,
                maxValue: 10,
                currentValue: 0
            });
        }
        while (this.counters.length > this.countersCount) {
            this.counters.pop();
        }

        // Создаём поля для каждого счётчика
        this.counters.forEach((counter, index) => {
            const counterItem = document.createElement('div');
            counterItem.className = 'counter-item';
            
            counterItem.innerHTML = `
                <h4>Счётчик ${index + 1}</h4>
                <div class="counter-config">
                    <div class="setting-group">
                        <label for="counterName${index}">Название:</label>
                        <input type="text" id="counterName${index}" value="${counter.name}" class="text-input">
                    </div>
                    <div class="setting-group">
                        <label for="counterMin${index}">Минимальное значение:</label>
                        <input type="number" id="counterMin${index}" value="${counter.minValue}" min="0" max="100">
                    </div>
                    <div class="setting-group">
                        <label for="counterMax${index}">Максимальное значение:</label>
                        <input type="number" id="counterMax${index}" value="${counter.maxValue}" min="1" max="100">
                    </div>
                    <div class="setting-group">
                        <label for="counterCurrent${index}">Начальное значение:</label>
                        <input type="number" id="counterCurrent${index}" value="${counter.currentValue}" min="0" max="100">
                    </div>
                    <div class="counter-preview">
                        <div class="counter-preview-bar">
                            <div class="counter-preview-fill" id="counterPreviewFill${index}"></div>
                        </div>
                        <div class="counter-preview-text" id="counterPreviewText${index}">${counter.currentValue}/${counter.maxValue}</div>
                    </div>
                </div>
            `;
            
            container.appendChild(counterItem);

            // Добавляем обработчики для этого счётчика
            document.getElementById(`counterName${index}`).addEventListener('input', (e) => {
                this.counters[index].name = e.target.value;
            });

            document.getElementById(`counterMin${index}`).addEventListener('change', (e) => {
                this.counters[index].minValue = parseInt(e.target.value);
                this.updateCounterPreview(index);
            });

            document.getElementById(`counterMax${index}`).addEventListener('change', (e) => {
                this.counters[index].maxValue = parseInt(e.target.value);
                this.updateCounterPreview(index);
            });

            document.getElementById(`counterCurrent${index}`).addEventListener('change', (e) => {
                this.counters[index].currentValue = parseInt(e.target.value);
                this.updateCounterPreview(index);
            });

            // Обновляем превью
            this.updateCounterPreview(index);
        });
    }

    updateCounterPreview(index) {
        const counter = this.counters[index];
        const fill = document.getElementById(`counterPreviewFill${index}`);
        const text = document.getElementById(`counterPreviewText${index}`);
        
        const percentage = ((counter.currentValue - counter.minValue) / (counter.maxValue - counter.minValue)) * 100;
        fill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        text.textContent = `${counter.currentValue}/${counter.maxValue}`;
    }

    clearAll() {
        this.characterName = '';
        this.speed = 3;
        this.characterImages = [];
        this.deck = null;
        this.mainToken = {
            image: null,
            color: '#ff0000',
            hp: 14,
            attackType: 'melee'
        };
        this.extraTokens = [];
        this.extraTokensCount = 3;
        this.extraTokenHP = 1;
        this.counters = [];
        this.countersCount = 0;

        document.getElementById('characterName').value = '';
        document.getElementById('characterSpeed').value = 3;
        document.getElementById('mainTokenColor').value = '#ff0000';
        document.getElementById('mainTokenHP').value = 14;
        document.getElementById('mainTokenAttackType').value = 'melee';
        document.getElementById('extraTokensCount').value = 3;
        document.getElementById('extraTokenHP').value = 1;
        document.getElementById('countersCount').value = 0;
        document.getElementById('mainTokenImageName').textContent = 'Изображение не выбрано';
        document.getElementById('charDeckBackFileName').textContent = 'Рубашка не выбрана';
        document.getElementById('deckImagesSection').style.display = 'none';
        
        this.updateDeckStatus(false);
        this.updateMainTokenPreview();
        this.updateCharacterImagePreview();
        this.updateExtraTokensFields();
        this.updateCountersFields();
        this.updateCharCardsGrid();
        this.updateCharCardsCount();
    }

    exportCharacter() {
        // Валидация
        if (!this.characterName.trim()) {
            alert('Введите имя персонажа!');
            return;
        }

        if (!this.deck || !this.deck.backImage || !this.deck.cards || this.deck.cards.length !== 30) {
            alert('Загрузите полную колоду (30 карт + рубашка)!');
            return;
        }

        if (!this.mainToken.image) {
            alert('Загрузите изображение для главного токена!');
            return;
        }

        for (let i = 0; i < this.extraTokens.length; i++) {
            if (!this.extraTokens[i].image) {
                alert(`Загрузите изображение для дополнительного токена ${i + 1}!`);
                return;
            }
        }

        // Создаём объект персонажа
        const characterData = {
            name: this.characterName,
            speed: this.speed,
            characterImages: this.characterImages.filter(Boolean),
            deck: this.deck,
            mainToken: {
                image: this.mainToken.image,
                color: this.mainToken.color,
                hp: this.mainToken.hp,
                attackType: this.mainToken.attackType
            },
            extraTokens: this.extraTokens.map(token => ({
                image: token.image,
                color: token.color,
                attackType: token.attackType
            })),
            extraTokenHP: this.extraTokenHP,
            counters: this.counters.map(counter => ({
                name: counter.name,
                minValue: counter.minValue,
                maxValue: counter.maxValue,
                currentValue: counter.currentValue
            }))
        };

        // Сохраняем на сервер
        this.saveToServer('character', this.characterName, characterData);
    }

    exportDeck() {
        if (this.cards.length !== this.maxCards) {
            alert(`Колода должна содержать ровно ${this.maxCards} карт! Сейчас: ${this.cards.length}`);
            return;
        }

        if (!this.backImage) {
            alert('Загрузите рубашку колоды!');
            return;
        }

        const deckData = {
            backImage: this.backImage,
            cards: this.cards
        };

        // Сохраняем на сервер
        const deckName = prompt('Введите имя колоды:', 'deck');
        if (deckName) {
            this.saveToServer('deck', deckName, deckData);
        }
    }

    async saveToServer(type, name, data) {
        try {
            const response = await fetch('/api/save-' + type, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    data: data
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения');
            }

            const result = await response.json();
            alert(`Файл успешно сохранён на сервере: ${result.filename}`);
        } catch (error) {
            console.error('Ошибка сохранения на сервер:', error);
            alert('Не удалось сохранить файл на сервере: ' + error.message);
        }
    }

    async importCharacter(characterData) {
        // Валидация
        if (!characterData.name || !characterData.deck || !characterData.mainToken) {
            alert('Неверный формат файла персонажа!');
            return;
        }

        this.characterName = characterData.name;
        this.speed = characterData.speed || 3;
        this.deck = characterData.deck;
        this.mainToken = characterData.mainToken;
        this.characterImages = (characterData.characterImages || (characterData.characterImage ? [characterData.characterImage] : [])).slice();
        this.extraTokens = characterData.extraTokens || [];
        this.extraTokenHP = characterData.extraTokenHP || 1;
        this.extraTokensCount = this.extraTokens.length;
        this.counters = characterData.counters || [];
        this.countersCount = this.counters.length;

        // Обновляем UI
        document.getElementById('characterName').value = this.characterName;
        document.getElementById('characterSpeed').value = this.speed;
        document.getElementById('mainTokenColor').value = this.mainToken.color;
        document.getElementById('mainTokenHP').value = this.mainToken.hp;
        document.getElementById('mainTokenAttackType').value = this.mainToken.attackType || 'melee';
        document.getElementById('extraTokensCount').value = this.extraTokensCount;
        document.getElementById('extraTokenHP').value = this.extraTokenHP;
        document.getElementById('countersCount').value = this.countersCount;

        // Re-upload images if they're not server paths
        if (this.deck.backImage && !this.deck.backImage.startsWith('/')) {
            this.deck.backImage = await this.uploadImageFromDataURL(this.deck.backImage, 'deck_back');
        }

        if (this.deck.cards) {
            for (let i = 0; i < this.deck.cards.length; i++) {
                if (this.deck.cards[i].image && !this.deck.cards[i].image.startsWith('/')) {
                    this.deck.cards[i].image = await this.uploadImageFromDataURL(this.deck.cards[i].image, `card_${i}`);
                }
            }
        }

        if (this.mainToken.image && !this.mainToken.image.startsWith('/')) {
            this.mainToken.image = await this.uploadImageFromDataURL(this.mainToken.image, 'main_token');
        }

        for (let i = 0; i < this.characterImages.length; i++) {
            if (this.characterImages[i] && !this.characterImages[i].startsWith('/')) {
                this.characterImages[i] = await this.uploadImageFromDataURL(this.characterImages[i], `character_${i}`);
            }
        }

        for (let i = 0; i < this.extraTokens.length; i++) {
            if (this.extraTokens[i].image && !this.extraTokens[i].image.startsWith('/')) {
                this.extraTokens[i].image = await this.uploadImageFromDataURL(this.extraTokens[i].image, `extra_token_${i}`);
            }
        }

        document.getElementById('mainTokenImageName').textContent = 'Загружено';

        this.updateDeckStatus(true);
        this.updateMainTokenPreview();
        this.updateCharacterImagePreview();
        this.updateExtraTokensFields();
        this.updateCountersFields();

        alert('Персонаж успешно импортирован!');
    }

    async uploadImageFromDataURL(dataURL, filename) {
        try {
            const response = await fetch(dataURL);
            const blob = await response.blob();
            const file = new File([blob], `${filename}.png`, { type: 'image/png' });

            const formData = new FormData();
            formData.append('image', file);

            const uploadResponse = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('Ошибка загрузки изображения');
            }

            const result = await uploadResponse.json();
            return result.url;
        } catch (error) {
            console.error('Ошибка при перезагрузке изображения:', error);
            return dataURL;
        }
    }
}

// Класс для редактора карт
class MapEditor {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this.backgroundImage = null;
        this.backgroundImageData = null;
        this.mode = 'add'; // 'add', 'delete', 'move'
        this.mapName = '';
        this.draggedPoint = null;
        this.savedMaps = [];
        
        this.setupEventListeners();
        this.loadSavedMaps();
        this.draw();
    }

    setupEventListeners() {
        // Загрузка фона
        document.getElementById('mapBackgroundUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('mapBackgroundFileName').textContent = file.name;
                const formData = new FormData();
                formData.append('image', file);
                
                try {
                    const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error('Ошибка загрузки изображения');
                    }
                    
                    const result = await response.json();
                    this.backgroundImageData = result.url; // Store the server path
                    this.backgroundImage = new Image();
                    this.backgroundImage.onload = () => this.draw();
                    this.backgroundImage.src = result.url;
                } catch (error) {
                    console.error('Ошибка загрузки фонового изображения:', error);
                    alert('Не удалось загрузить фоновое изображение: ' + error.message);
                }
            }
        });

        // Имя карты
        document.getElementById('mapName').addEventListener('input', (e) => {
            this.mapName = e.target.value;
        });

        // Клик по canvas
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Переключение режимов
        document.getElementById('mapAddMode').addEventListener('click', () => {
            this.mode = 'add';
            this.canvas.style.cursor = 'crosshair';
            document.getElementById('mapAddMode').classList.add('active');
            document.getElementById('mapDeleteMode').classList.remove('active');
            document.getElementById('mapMoveMode').classList.remove('active');
        });

        document.getElementById('mapDeleteMode').addEventListener('click', () => {
            this.mode = 'delete';
            this.canvas.style.cursor = 'pointer';
            document.getElementById('mapDeleteMode').classList.add('active');
            document.getElementById('mapAddMode').classList.remove('active');
            document.getElementById('mapMoveMode').classList.remove('active');
        });

        document.getElementById('mapMoveMode').addEventListener('click', () => {
            this.mode = 'move';
            this.canvas.style.cursor = 'move';
            document.getElementById('mapMoveMode').classList.add('active');
            document.getElementById('mapAddMode').classList.remove('active');
            document.getElementById('mapDeleteMode').classList.remove('active');
        });

        // Очистка
        document.getElementById('clearMap').addEventListener('click', () => {
            if (confirm('Очистить всю карту?')) {
                this.points = [];
                this.backgroundImage = null;
                this.backgroundImageData = null;
                this.mapName = '';
                document.getElementById('mapName').value = '';
                document.getElementById('mapBackgroundFileName').textContent = 'Файл не выбран';
                this.updatePointCount();
                this.draw();
            }
        });

        // Сохранение
        document.getElementById('saveMap').addEventListener('click', () => {
            this.saveMap();
        });

        // Загрузка
        document.getElementById('loadMap').addEventListener('click', () => {
            document.getElementById('loadMapFile').click();
        });

        document.getElementById('loadMapFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const mapData = JSON.parse(event.target.result);
                        this.loadMapData(mapData);
                    } catch (error) {
                        alert('Ошибка при загрузке карты: ' + error.message);
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

        if (this.mode === 'add') {
            // Добавляем новую точку
            this.points.push({
                x: Math.round(pos.x),
                y: Math.round(pos.y),
                id: this.points.length
            });
            this.updatePointCount();
            this.draw();
        } else if (this.mode === 'delete') {
            // Удаляем точку
            const pointIndex = this.findPointAt(pos.x, pos.y);
            if (pointIndex !== -1) {
                this.points.splice(pointIndex, 1);
                // Обновляем ID
                this.points.forEach((point, index) => {
                    point.id = index;
                });
                this.updatePointCount();
                this.draw();
            }
        } else if (this.mode === 'move') {
            // Начинаем перетаскивание
            const pointIndex = this.findPointAt(pos.x, pos.y);
            if (pointIndex !== -1) {
                this.draggedPoint = this.points[pointIndex];
            }
        }
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.mode === 'move' && this.draggedPoint) {
            this.draggedPoint.x = Math.round(pos.x);
            this.draggedPoint.y = Math.round(pos.y);
            this.draw();
        } else if (this.mode === 'delete') {
            // Подсвечиваем точку при наведении
            const pointIndex = this.findPointAt(pos.x, pos.y);
            this.points.forEach((point, index) => {
                point.isHovered = index === pointIndex;
            });
            this.draw();
        }
    }

    handleMouseUp(e) {
        this.draggedPoint = null;
    }

    findPointAt(x, y) {
        const radius = 15;
        for (let i = this.points.length - 1; i >= 0; i--) {
            const point = this.points[i];
            const dx = x - point.x;
            const dy = y - point.y;
            if (Math.sqrt(dx * dx + dy * dy) <= radius) {
                return i;
            }
        }
        return -1;
    }

    updatePointCount() {
        document.getElementById('mapPointCount').textContent = this.points.length;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем фон
        if (this.backgroundImage && this.backgroundImage.complete) {
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#f5f5f5';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Рисуем точки
        this.points.forEach(point => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 15, 0, Math.PI * 2);
            this.ctx.fillStyle = point.isHovered ? '#e53e3e' : '#4a5568';
            this.ctx.fill();
            this.ctx.strokeStyle = '#1a202c';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Номер точки
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(point.id + 1, point.x, point.y);
        });
    }

    saveMap() {
        if (!this.mapName.trim()) {
            alert('Введите название карты!');
            return;
        }

        if (!this.backgroundImageData) {
            alert('Загрузите фоновое изображение!');
            return;
        }

        if (this.points.length === 0) {
            alert('Добавьте хотя бы одну точку!');
            return;
        }

        const mapData = {
            name: this.mapName,
            backgroundImage: this.backgroundImageData,
            points: this.points.map(p => ({ x: p.x, y: p.y }))
        };

        // Сохраняем на сервер
        this.saveToServer('map', this.mapName, mapData);
    }

    loadMapData(mapData) {
        this.mapName = mapData.name || '';
        this.backgroundImageData = mapData.backgroundImage;
        this.points = mapData.points.map((p, index) => ({
            x: p.x,
            y: p.y,
            id: index
        }));

        document.getElementById('mapName').value = this.mapName;
        
        if (this.backgroundImageData) {
            this.backgroundImage = new Image();
            this.backgroundImage.onload = () => this.draw();
            this.backgroundImage.src = this.backgroundImageData;
            document.getElementById('mapBackgroundFileName').textContent = 'Загружено из файла';
        }

        this.updatePointCount();
        alert('Карта успешно загружена!');
    }

    async saveToServer(type, name, data) {
        try {
            const response = await fetch('/api/save-map', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    data: data
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка сохранения');
            }

            const result = await response.json();
            alert(`Файл успешно сохранён на сервере: ${result.filename}`);
        } catch (error) {
            console.error('Ошибка сохранения на сервер:', error);
            alert('Не удалось сохранить файл на сервере: ' + error.message);
        }
    }

    async loadSavedMaps() {
        try {
            const response = await fetch('/api/maps');
            const maps = await response.json();
            this.savedMaps = maps;
            this.renderSavedMaps();
        } catch (error) {
            console.error('Ошибка загрузки карт:', error);
            document.getElementById('savedMapsList').innerHTML = 
                '<p class="loading-message">Ошибка загрузки карт</p>';
        }
    }

    renderSavedMaps() {
        const container = document.getElementById('savedMapsList');
        
        if (this.savedMaps.length === 0) {
            container.innerHTML = '<p class="loading-message">Нет сохранённых карт</p>';
            return;
        }

        container.innerHTML = '';
        
        this.savedMaps.forEach(map => {
            const card = document.createElement('div');
            card.className = 'saved-map-card';
            
            card.innerHTML = `
                <h4>${map.name}</h4>
                <p>Точек: ${map.points ? map.points.length : 0}</p>
                <div class="map-actions-buttons">
                    <button class="btn" onclick="window.mapEditor.loadMapFromList('${map.filename}')">Редактировать</button>
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    async loadMapFromList(filename) {
        try {
            const response = await fetch(`/maps/saved_maps/${filename}`);
            const mapData = await response.json();
            this.loadMapData(mapData);
        } catch (error) {
            alert('Ошибка загрузки карты: ' + error.message);
        }
    }
}

// Инициализация редакторов
window.addEventListener('DOMContentLoaded', () => {
    const pointEditor = new PointEditor('editorCanvas');
    const deckEditor = new DeckEditor();
    const characterEditor = new CharacterEditor();
    const mapEditor = new MapEditor('mapEditorCanvas');
    
    // Делаем mapEditor глобальным для доступа из HTML
    window.mapEditor = mapEditor;

    // Переключение между вкладками
    document.getElementById('mapEditorTab').addEventListener('click', () => {
        document.getElementById('mapEditor').style.display = 'block';
        document.getElementById('pointsEditor').style.display = 'none';
        document.getElementById('deckEditor').style.display = 'none';
        document.getElementById('characterEditor').style.display = 'none';
        document.getElementById('mapEditorTab').classList.add('active');
        document.getElementById('pointsEditorTab').classList.remove('active');
        document.getElementById('deckEditorTab').classList.remove('active');
        document.getElementById('characterEditorTab').classList.remove('active');
    });

    document.getElementById('pointsEditorTab').addEventListener('click', () => {
        document.getElementById('pointsEditor').style.display = 'block';
        document.getElementById('deckEditor').style.display = 'none';
        document.getElementById('characterEditor').style.display = 'none';
        document.getElementById('mapEditor').style.display = 'none';
        document.getElementById('pointsEditorTab').classList.add('active');
        document.getElementById('deckEditorTab').classList.remove('active');
        document.getElementById('characterEditorTab').classList.remove('active');
        document.getElementById('mapEditorTab').classList.remove('active');
    });

    document.getElementById('deckEditorTab').addEventListener('click', () => {
        document.getElementById('pointsEditor').style.display = 'none';
        document.getElementById('deckEditor').style.display = 'block';
        document.getElementById('characterEditor').style.display = 'none';
        document.getElementById('mapEditor').style.display = 'none';
        document.getElementById('deckEditorTab').classList.add('active');
        document.getElementById('pointsEditorTab').classList.remove('active');
        document.getElementById('characterEditorTab').classList.remove('active');
        document.getElementById('mapEditorTab').classList.remove('active');
    });

    document.getElementById('characterEditorTab').addEventListener('click', () => {
        document.getElementById('pointsEditor').style.display = 'none';
        document.getElementById('deckEditor').style.display = 'none';
        document.getElementById('characterEditor').style.display = 'block';
        document.getElementById('mapEditor').style.display = 'none';
        document.getElementById('characterEditorTab').classList.add('active');
        document.getElementById('pointsEditorTab').classList.remove('active');
        document.getElementById('deckEditorTab').classList.remove('active');
        document.getElementById('mapEditorTab').classList.remove('active');
    });
});
