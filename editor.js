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
        document.getElementById('deckBackUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('deckBackFileName').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.backImage = event.target.result;
                    this.updateBackPreview();
                };
                reader.readAsDataURL(file);
            }
        });

        // Загрузка карт
        document.getElementById('cardsUpload').addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            
            if (this.cards.length + files.length > this.maxCards) {
                alert(`Можно загрузить максимум ${this.maxCards} карт. Сейчас загружено: ${this.cards.length}`);
                return;
            }

            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.cards.push({
                        image: event.target.result,
                        text: file.name.replace(/\.[^/.]+$/, '') // Имя файла без расширения
                    });
                    this.updateCardsGrid();
                    this.updateCardsCount();
                };
                reader.readAsDataURL(file);
            });
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

        const jsonString = JSON.stringify(deckData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'deck.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert('Колода успешно экспортирована!');
    }

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
        this.deck = null; // { backImage, cards }
        this.mainToken = {
            image: null,
            color: '#ff0000',
            hp: 14
        };
        this.extraTokens = [];
        this.extraTokensCount = 3;
        this.extraTokenHP = 1;
        
        this.setupEventListeners();
        this.updateExtraTokensFields();
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
        document.getElementById('charDeckBackUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('charDeckBackFileName').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (!this.deck) {
                        this.deck = { backImage: null, cards: [] };
                    }
                    this.deck.backImage = event.target.result;
                    this.checkDeckComplete();
                };
                reader.readAsDataURL(file);
            }
        });

        // Загрузка карт колоды
        document.getElementById('charCardsUpload').addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            
            if (!this.deck) {
                this.deck = { backImage: null, cards: [] };
            }

            if (this.deck.cards.length + files.length > 30) {
                alert(`Можно загрузить максимум 30 карт. Сейчас загружено: ${this.deck.cards.length}`);
                return;
            }

            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.deck.cards.push({
                        image: event.target.result,
                        text: file.name.replace(/\.[^/.]+$/, '')
                    });
                    this.updateCharCardsGrid();
                    this.updateCharCardsCount();
                    this.checkDeckComplete();
                };
                reader.readAsDataURL(file);
            });
        });

        // Главный токен - изображение
        document.getElementById('mainTokenImage').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('mainTokenImageName').textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.mainToken.image = event.target.result;
                    this.updateMainTokenPreview();
                };
                reader.readAsDataURL(file);
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

        // Количество дополнительных токенов
        document.getElementById('extraTokensCount').addEventListener('change', (e) => {
            this.extraTokensCount = parseInt(e.target.value);
            this.updateExtraTokensFields();
        });

        // HP дополнительных токенов
        document.getElementById('extraTokenHP').addEventListener('change', (e) => {
            this.extraTokenHP = parseInt(e.target.value);
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

    updateExtraTokensFields() {
        const container = document.getElementById('extraTokensContainer');
        container.innerHTML = '';

        // Обновляем массив дополнительных токенов
        while (this.extraTokens.length < this.extraTokensCount) {
            this.extraTokens.push({
                image: null,
                color: '#0000ff'
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
                    </div>
                </div>
            `;
            
            container.appendChild(tokenItem);

            // Добавляем обработчики для этого токена
            document.getElementById(`extraTokenImage${index}`).addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    document.getElementById(`extraTokenImageName${index}`).textContent = file.name;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this.extraTokens[index].image = event.target.result;
                        this.updateExtraTokenPreview(index);
                    };
                    reader.readAsDataURL(file);
                }
            });

            document.getElementById(`extraTokenColor${index}`).addEventListener('change', (e) => {
                this.extraTokens[index].color = e.target.value;
                this.updateExtraTokenPreview(index);
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

    clearAll() {
        this.characterName = '';
        this.deck = null;
        this.mainToken = {
            image: null,
            color: '#ff0000',
            hp: 14
        };
        this.extraTokens = [];
        this.extraTokensCount = 3;
        this.extraTokenHP = 1;

        document.getElementById('characterName').value = '';
        document.getElementById('mainTokenColor').value = '#ff0000';
        document.getElementById('mainTokenHP').value = 14;
        document.getElementById('extraTokensCount').value = 3;
        document.getElementById('extraTokenHP').value = 1;
        document.getElementById('mainTokenImageName').textContent = 'Изображение не выбрано';
        document.getElementById('charDeckBackFileName').textContent = 'Рубашка не выбрана';
        document.getElementById('deckImagesSection').style.display = 'none';
        
        this.updateDeckStatus(false);
        this.updateMainTokenPreview();
        this.updateExtraTokensFields();
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
            deck: this.deck,
            mainToken: {
                image: this.mainToken.image,
                color: this.mainToken.color,
                hp: this.mainToken.hp
            },
            extraTokens: this.extraTokens.map(token => ({
                image: token.image,
                color: token.color
            })),
            extraTokenHP: this.extraTokenHP
        };

        // Экспорт в JSON
        const jsonString = JSON.stringify(characterData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.characterName.toLowerCase().replace(/\s+/g, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert('Персонаж успешно экспортирован! Сохраните файл в папку heroes/characters/');
    }

    importCharacter(characterData) {
        // Валидация
        if (!characterData.name || !characterData.deck || !characterData.mainToken) {
            alert('Неверный формат файла персонажа!');
            return;
        }

        this.characterName = characterData.name;
        this.deck = characterData.deck;
        this.mainToken = characterData.mainToken;
        this.extraTokens = characterData.extraTokens || [];
        this.extraTokenHP = characterData.extraTokenHP || 1;
        this.extraTokensCount = this.extraTokens.length;

        // Обновляем UI
        document.getElementById('characterName').value = this.characterName;
        document.getElementById('mainTokenColor').value = this.mainToken.color;
        document.getElementById('mainTokenHP').value = this.mainToken.hp;
        document.getElementById('extraTokensCount').value = this.extraTokensCount;
        document.getElementById('extraTokenHP').value = this.extraTokenHP;
        document.getElementById('mainTokenImageName').textContent = 'Загружено из файла';

        this.updateDeckStatus(true);
        this.updateMainTokenPreview();
        this.updateExtraTokensFields();

        alert('Персонаж успешно импортирован!');
    }
}

// Инициализация редакторов
window.addEventListener('DOMContentLoaded', () => {
    const pointEditor = new PointEditor('editorCanvas');
    const deckEditor = new DeckEditor();
    const characterEditor = new CharacterEditor();

    // Переключение между вкладками
    document.getElementById('pointsEditorTab').addEventListener('click', () => {
        document.getElementById('pointsEditor').style.display = 'block';
        document.getElementById('deckEditor').style.display = 'none';
        document.getElementById('characterEditor').style.display = 'none';
        document.getElementById('pointsEditorTab').classList.add('active');
        document.getElementById('deckEditorTab').classList.remove('active');
        document.getElementById('characterEditorTab').classList.remove('active');
    });

    document.getElementById('deckEditorTab').addEventListener('click', () => {
        document.getElementById('pointsEditor').style.display = 'none';
        document.getElementById('deckEditor').style.display = 'block';
        document.getElementById('characterEditor').style.display = 'none';
        document.getElementById('deckEditorTab').classList.add('active');
        document.getElementById('pointsEditorTab').classList.remove('active');
        document.getElementById('characterEditorTab').classList.remove('active');
    });

    document.getElementById('characterEditorTab').addEventListener('click', () => {
        document.getElementById('pointsEditor').style.display = 'none';
        document.getElementById('deckEditor').style.display = 'none';
        document.getElementById('characterEditor').style.display = 'block';
        document.getElementById('characterEditorTab').classList.add('active');
        document.getElementById('pointsEditorTab').classList.remove('active');
        document.getElementById('deckEditorTab').classList.remove('active');
    });
});
