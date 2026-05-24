const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');

const app = express();
const server = http.createServer(app);

// Middleware for JSON and URL-encoded data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e8, // 100 MB
    pingTimeout: 60000
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = '';
        if (file.fieldname.includes('hero')) {
            uploadPath = path.join(__dirname, 'heroes', 'images');
        } else if (file.fieldname.includes('character')) {
            uploadPath = path.join(__dirname, 'heroes', 'characters', 'images');
        } else if (file.fieldname.includes('map')) {
            uploadPath = path.join(__dirname, 'maps', 'images');
        } else if (file.fieldname.includes('deck')) {
            uploadPath = path.join(__dirname, 'decks', 'images');
        } else {
            uploadPath = path.join(__dirname, 'uploads');
        }
        
        // Ensure directory exists
        const fs = require('fs');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Create unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const upload = multer({ storage: storage });

// Статические файлы
app.use(express.static(path.join(__dirname)));

// API для загрузки изображений
app.post('/api/upload-image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }
        
        // Возвращаем относительный путь для использования в клиенте
        const relativePath = path.relative(__dirname, req.file.path);
        res.json({ 
            success: true, 
            filename: req.file.filename,
            path: relativePath,
            url: `/${relativePath.replace(/\\/g, '/')}` // URL для доступа к файлу
        });
    } catch (error) {
        console.error('Ошибка загрузки файла:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// API для получения списка персонажей

// API для получения списка персонажей
app.get('/api/characters', async (req, res) => {
    try {
        const charactersDir = path.join(__dirname, 'heroes', 'characters');
        const files = await fs.readdir(charactersDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        const characters = [];
        for (const file of jsonFiles) {
            const filePath = path.join(charactersDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const character = JSON.parse(data);
            characters.push(character);
        }
        
        res.json(characters);
    } catch (error) {
        console.error('Ошибка загрузки персонажей:', error);
        res.json([]);
    }
});

// API для получения списка карт
app.get('/api/maps', async (req, res) => {
    try {
        const mapsDir = path.join(__dirname, 'maps', 'saved_maps');
        const files = await fs.readdir(mapsDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        const maps = [];
        for (const file of jsonFiles) {
            const filePath = path.join(mapsDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const map = JSON.parse(data);
            map.filename = file;
            maps.push(map);
        }
        
        res.json(maps);
    } catch (error) {
        console.error('Ошибка загрузки карт:', error);
        res.json([]);
    }
});

// API для импорта TTS колоды
app.post('/api/import-tts', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }

    const zipPath = req.file.path;
    const scriptPath = path.join(__dirname, 'scripts', 'import_tts_character.py');
    const cmd = `python3 "${scriptPath}" --zip "${zipPath}" --project-dir "${__dirname}"`;

    try {
        const { stdout } = await execAsync(cmd, { timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
        try { require('fs').unlinkSync(zipPath); } catch (_) {}
        const result = JSON.parse(stdout);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    } catch (error) {
        try { require('fs').unlinkSync(zipPath); } catch (_) {}
        const stdout = error.stdout || '';
        if (stdout) {
            try { return res.status(400).json(JSON.parse(stdout)); } catch (_) {}
        }
        console.error('Ошибка импорта TTS:', error.message);
        res.status(500).json({ error: 'Ошибка импорта TTS', detail: error.message });
    }
});

// API для импорта с the-unmatched.club
// Используем execAsync вместо execSync — импорт занимает несколько минут (Chrome rendering),
// и блокировка event loop приводила к потере соединения.
app.post('/api/import-theunmatched', express.json(), async (req, res) => {
    const { url } = req.body || {};
    if (!url) {
        return res.status(400).json({ error: 'URL не указан' });
    }

    const scriptPath = path.join(__dirname, 'scripts', 'fetch_theunmatched.py');
    const cmd = `python3 "${scriptPath}" "${url}" --project-dir "${__dirname}"`;

    try {
        const { stdout } = await execAsync(cmd, { timeout: 360000, maxBuffer: 10 * 1024 * 1024 });
        const result = JSON.parse(stdout);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    } catch (error) {
        const stdout = error.stdout || '';
        if (stdout) {
            try { return res.status(400).json(JSON.parse(stdout)); } catch (_) {}
        }
        console.error('Ошибка импорта с the-unmatched.club:', error.message);
        res.status(500).json({ error: 'Ошибка импорта с the-unmatched.club', detail: error.message });
    }
});

// Хранилище игровых комнат
const rooms = new Map();
// Хранилище пользователей (userId -> { socketId, username, roomCode })
const users = new Map();

// Генерация уникального кода комнаты
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Автоматическая очистка старых комнат каждые 10 минут
setInterval(() => {
    const now = Date.now();
    const roomsToDelete = [];
    
    rooms.forEach((room, code) => {
        const roomAge = now - room.createdAt;
        // Удаляем комнаты старше 30 минут без игроков
        if (room.players.length === 0 && roomAge > 1800000) {
            roomsToDelete.push(code);
        }
    });
    
    roomsToDelete.forEach(code => {
        rooms.delete(code);
        console.log(`Комната ${code} удалена (истекло время)`);
    });
}, 600000); // Каждые 10 минут

io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);
    
    // Флаг авторизации
    socket.isAuthenticated = false;

    // Авторизация пользователя
    socket.on('user-auth', (data) => {
        const { userId, username } = data;
        
        if (!userId || !username) {
            console.error('Попытка авторизации без userId или username');
            return;
        }
        
        // Проверяем, был ли пользователь уже подключен
        const existingUser = users.get(userId);
        
        if (existingUser) {
            console.log(`Пользователь ${username} (${userId}) переподключился`);
            
            // Обновляем socketId
            existingUser.socketId = socket.id;
            socket.userId = userId;
            socket.username = username;
            socket.isAuthenticated = true;
            
            // Если у пользователя была комната, НЕ переподключаем автоматически
            // Пусть клиент сам отправит join-room
            if (existingUser.roomCode) {
                const room = rooms.get(existingUser.roomCode);
                if (room) {
                    // Просто сохраняем информацию, но не присоединяем
                    console.log(`Пользователь ${username} имеет сохраненную комнату ${existingUser.roomCode}`);
                }
            }
        } else {
            // Новый пользователь
            users.set(userId, {
                socketId: socket.id,
                username: username,
                roomCode: null
            });
            
            socket.userId = userId;
            socket.username = username;
            socket.isAuthenticated = true;
            
            console.log(`Новый пользователь: ${username} (${userId})`);
        }
    });

    // Создание новой комнаты
    socket.on('create-room', (settings) => {
        if (!socket.isAuthenticated || !socket.userId) {
            socket.emit('room-error', 'Необходима авторизация');
            return;
        }
        
        const roomCode = generateRoomCode();
        const userId = socket.userId;
        
        rooms.set(roomCode, {
            settings: settings, // Храним полные настройки с колодами на сервере
            chips: [],
            cards: [],
            discardPiles: { player1: [], player2: [] },
            handVisibility: { player1: false, player2: false },
            counters: { player1: [], player2: [] },
            players: [userId],
            playerRoles: { [userId]: 'player1' },
            currentTurn: 'player1',
            createdAt: Date.now()
        });
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerRole = 'player1';
        
        // Обновляем информацию о пользователе
        const user = users.get(userId);
        if (user) {
            user.roomCode = roomCode;
        }
        
        console.log(`Комната создана: ${roomCode} пользователем ${socket.username}`);
        
        // Отправляем клиенту настройки с персонажами
        socket.emit('room-created', { 
            roomCode,
            playerRole: 'player1',
            settings: {
                backgroundImage: settings.backgroundImage,
                points: settings.points,
                player1: {
                    character: settings.player1.character
                },
                player2: {
                    character: settings.player2.character
                }
            },
            currentTurn: 'player1'
        });
    });

    // Подключение к существующей комнате
    socket.on('join-room', (roomCode) => {
        if (!socket.isAuthenticated || !socket.userId) {
            socket.emit('room-error', 'Необходима авторизация');
            return;
        }
        
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('room-error', 'Комната не найдена');
            return;
        }
        
        const userId = socket.userId;
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        // Определяем роль игрока
        let playerRole = null;
        let isReconnecting = false;
        
        // Проверяем, был ли этот пользователь уже в комнате
        if (room.playerRoles[userId]) {
            // Пользователь переподключается - восстанавливаем его роль
            playerRole = room.playerRoles[userId];
            isReconnecting = true;
            console.log(`Пользователь ${socket.username} переподключился к комнате ${roomCode} как ${playerRole}`);
        } else {
            // Новый пользователь
            // Освобождаем слоты отключившихся игроков перед назначением роли
            for (const [existingUserId, existingRole] of Object.entries(room.playerRoles)) {
                if (existingRole !== 'player1' && existingRole !== 'player2') continue;
                const existingUser = users.get(existingUserId);
                const isConnected = existingUser && io.sockets.sockets.get(existingUser.socketId);
                if (!isConnected) {
                    delete room.playerRoles[existingUserId];
                    room.players = room.players.filter(pid => pid !== existingUserId);
                    console.log(`Роль ${existingRole} освобождена: игрок ${existingUserId} отключён`);
                }
            }
            
            // Проверяем, какие роли заняты
            const existingRoles = Object.values(room.playerRoles);
            const hasPlayer1 = existingRoles.includes('player1');
            const hasPlayer2 = existingRoles.includes('player2');
            
            if (!hasPlayer1) {
                playerRole = 'player1';
            } else if (!hasPlayer2) {
                playerRole = 'player2';
            } else {
                playerRole = 'spectator';
            }
            
            room.playerRoles[userId] = playerRole;
            
            // Добавляем в массив игроков только если его там нет
            if (!room.players.includes(userId)) {
                room.players.push(userId);
            }
            
            console.log(`Пользователь ${socket.username} присоединился к комнате ${roomCode} как ${playerRole}`);
        }
        
        socket.playerRole = playerRole;
        
        // Обновляем информацию о пользователе
        const user = users.get(userId);
        if (user) {
            user.roomCode = roomCode;
        }
        
        // Отправляем текущее состояние игры новому игроку
        socket.emit('room-joined', {
            roomCode,
            playerRole: playerRole,
            settings: {
                backgroundImage: room.settings.backgroundImage,
                points: room.settings.points,
                player1: {
                    character: room.settings.player1.character
                },
                player2: {
                    character: room.settings.player2.character
                }
            },
            chips: room.chips,
            cards: room.cards || [],
            discardPiles: room.discardPiles || { player1: [], player2: [] },
            handVisibility: room.handVisibility || { player1: false, player2: false },
            currentTurn: room.currentTurn || 'player1'
        });
        
        // Уведомляем других игроков о подключении/переподключении
        if (isReconnecting) {
            socket.to(roomCode).emit('player-reconnected', { userId, username: socket.username, role: playerRole });
        } else {
            socket.to(roomCode).emit('player-joined', { userId, username: socket.username });
        }
    });

    // Запрос колод
    socket.on('request-decks', () => {
        const room = rooms.get(socket.roomCode);
        if (!room) {
            console.log('Запрос колод: комната не найдена для', socket.roomCode);
            return;
        }
        
        console.log('Запрос колод от пользователя', socket.username, 'для комнаты', socket.roomCode);
        
        const p1Char = room.settings.player1.character;
        const p2Char = room.settings.player2.character;
        const p1Extra = room.settings.player1.additionalCharacter;
        const p2Extra = room.settings.player2.additionalCharacter;

        let p1Deck = p1Char ? p1Char.deck : null;
        let p2Deck = p2Char ? p2Char.deck : null;

        if (p1Deck && p1Extra && p1Extra.deck && p1Extra.deck.cards && p1Extra.deck.cards.length > 0) {
            p1Deck = { backImage: p1Deck.backImage, cards: [...p1Deck.cards, ...p1Extra.deck.cards] };
        }
        if (p2Deck && p2Extra && p2Extra.deck && p2Extra.deck.cards && p2Extra.deck.cards.length > 0) {
            p2Deck = { backImage: p2Deck.backImage, cards: [...p2Deck.cards, ...p2Extra.deck.cards] };
        }

        const decksData = {
            player1: p1Deck,
            player2: p2Deck,
            player1Character: p1Char || null,
            player2Character: p2Char || null
        };
        
        console.log('Отправка колод:', {
            player1: decksData.player1 ? 'есть' : 'нет',
            player2: decksData.player2 ? 'есть' : 'нет'
        });
        
        socket.emit('decks-data', decksData);
    });

    // Запрос фонового изображения
    socket.on('request-background', () => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Отправляем фоновое изображение клиенту
        socket.emit('background-image', room.settings.backgroundImage || null);
    });

    // Синхронизация перемещения фишки
    socket.on('chip-moved', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Обновляем состояние фишки в комнате
        const chipIndex = room.chips.findIndex(c => c.id === data.chipId);
        if (chipIndex !== -1) {
            room.chips[chipIndex] = {
                ...room.chips[chipIndex],
                x: data.x,
                y: data.y,
                attachedPointId: data.attachedPointId
            };
        } else {
            // Если фишка новая, добавляем её
            room.chips.push({
                id: data.chipId,
                x: data.x,
                y: data.y,
                attachedPointId: data.attachedPointId,
                color: data.color,
                isMain: data.isMain,
                player: data.player,
                hp: data.hp
            });
        }
        
        // Отправляем обновление всем остальным в комнате
        socket.to(socket.roomCode).emit('chip-moved', data);
    });

    // Синхронизация изменения HP
    socket.on('hp-changed', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Обновляем HP фишки
        const chip = room.chips.find(c => c.id === data.chipId);
        if (chip) {
            chip.hp = data.hp;
        }
        
        // Отправляем обновление всем остальным в комнате
        socket.to(socket.roomCode).emit('hp-changed', data);
    });

    // Синхронизация изменения счётчиков
    socket.on('counter-changed', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Инициализируем счётчики если их нет
        if (!room.counters) {
            room.counters = {
                player1: [],
                player2: []
            };
        }
        
        // Получаем данные персонажа для этого игрока
        const characterData = data.player === 'player1' ? room.settings.player1.character : room.settings.player2.character;
        
        if (!characterData || !characterData.counters || !characterData.counters[data.counterIndex]) {
            return;
        }
        
        const counterConfig = characterData.counters[data.counterIndex];
        
        // Инициализируем счётчик если его нет
        if (!room.counters[data.player][data.counterIndex]) {
            room.counters[data.player][data.counterIndex] = {
                currentValue: counterConfig.currentValue,
                minValue: counterConfig.minValue,
                maxValue: counterConfig.maxValue
            };
        }
        
        const counter = room.counters[data.player][data.counterIndex];
        
        // Обновляем значение счётчика
        counter.currentValue = Math.max(
            counter.minValue,
            Math.min(counter.maxValue, counter.currentValue + data.delta)
        );
        
        // Отправляем обновление всем в комнате
        const updateData = {
            player: data.player,
            counterIndex: data.counterIndex,
            newValue: counter.currentValue,
            minValue: counter.minValue,
            maxValue: counter.maxValue
        };
        
        io.to(socket.roomCode).emit('counter-updated', updateData);
    });

    // Синхронизация видимости руки
    socket.on('hand-visibility-changed', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Инициализируем состояние видимости рук если его нет
        if (!room.handVisibility) {
            room.handVisibility = {
                player1: false,
                player2: false
            };
        }
        
        // Обновляем состояние видимости
        room.handVisibility[data.player] = data.visible;
        
        // Отправляем обновление всем в комнате
        io.to(socket.roomCode).emit('hand-visibility-updated', {
            player: data.player,
            visible: data.visible
        });
    });

    // Синхронизация создания фишек
    socket.on('chips-initialized', (chips) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        room.chips = chips;
        
        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('chips-initialized', chips);
    });

    // Очистка поля
    socket.on('board-cleared', () => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        room.chips = [];
        
        // Отправляем всем в комнате
        socket.to(socket.roomCode).emit('board-cleared');
    });

    // Синхронизация передачи хода
    socket.on('pass-turn', () => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Переключаем ход
        room.currentTurn = room.currentTurn === 'player1' ? 'player2' : 'player1';
        
        // Отправляем всем в комнате
        io.to(socket.roomCode).emit('turn-changed', {
            currentTurn: room.currentTurn
        });
    });

    // Синхронизация создания карты
    socket.on('card-created', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Инициализируем массив карт если его нет
        if (!room.cards) {
            room.cards = [];
        }
        
        // Добавляем карту в комнату
        room.cards.push(data);
        
        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('card-created', data);
    });

    // Синхронизация перемещения карты
    socket.on('card-moved', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Обновляем позицию карты
        if (room.cards) {
            const card = room.cards.find(c => c.id === data.cardId);
            if (card) {
                card.field = data.targetField;
            }
        }
        
        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('card-moved', data);
    });

    // Синхронизация переворачивания карты
    socket.on('card-flipped', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Обновляем состояние карты
        if (room.cards) {
            const card = room.cards.find(c => c.id === data.cardId);
            if (card) {
                card.isFlipped = data.isFlipped;
            }
        }
        
        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('card-flipped', data);
    });

    // Синхронизация удаления карты
    socket.on('card-removed', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Удаляем карту из комнаты
        if (room.cards) {
            room.cards = room.cards.filter(c => c.id !== data.cardId);
        }
        
        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('card-removed', data);
    });

    // Синхронизация сброса карты
    socket.on('card-discarded', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Инициализируем массив сброса если его нет
        if (!room.discardPiles) {
            room.discardPiles = {
                player1: [],
                player2: []
            };
        }
        
        // Добавляем карту в сброс
        room.discardPiles[data.player].push(data.card);
        
        // Удаляем карту из активных карт комнаты
        if (room.cards) {
            room.cards = room.cards.filter(c => c.id !== data.cardId);
        }
        
        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('card-discarded', data);
    });

    // Синхронизация возврата карты из сброса
    socket.on('card-returned-from-discard', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Удаляем карту из сброса
        if (room.discardPiles && room.discardPiles[data.player]) {
            room.discardPiles[data.player].splice(data.cardIndex, 1);
        }
        
        // Добавляем карту обратно в игру
        if (!room.cards) {
            room.cards = [];
        }
        room.cards.push(data.card);
        
        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('card-returned-from-discard', data);
    });

    // Синхронизация перемешивания колоды
    socket.on('deck-shuffled', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;

        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('deck-shuffled', data);
    });

    // Синхронизация взятия карты из колоды
    socket.on('card-taken-from-deck', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;

        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('card-taken-from-deck', data);
    });

    // Синхронизация помещения карты в колоду
    socket.on('card-put-to-deck', (data) => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;

        // Отправляем всем остальным в комнате
        socket.to(socket.roomCode).emit('card-put-to-deck', data);
    });

    // API для сохранения персонажа на сервер
    app.post('/api/save-character', express.json(), async (req, res) => {
        try {
            const { name, data } = req.body;

            if (!name || !data) {
                return res.status(400).json({ error: 'Не указано имя или данные' });
            }

            const filename = name.toLowerCase().replace(/\s+/g, '_') + '.json';
            const filepath = path.join(__dirname, 'heroes', 'characters', filename);

            await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');

            res.json({ success: true, filename, path: `/heroes/characters/${filename}` });
        } catch (error) {
            console.error('Ошибка сохранения персонажа:', error);
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });

    // API для сохранения колоды на сервер
    app.post('/api/save-deck', express.json(), async (req, res) => {
        try {
            const { name, data } = req.body;

            if (!name || !data) {
                return res.status(400).json({ error: 'Не указано имя или данные' });
            }

            const filename = name.toLowerCase().replace(/\s+/g, '_') + '.json';
            const filepath = path.join(__dirname, 'heroes', filename);

            await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');

            res.json({ success: true, filename, path: `/heroes/${filename}` });
        } catch (error) {
            console.error('Ошибка сохранения колоды:', error);
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });

    // API для сохранения карты на сервер
    app.post('/api/save-map', express.json(), async (req, res) => {
        try {
            const { name, data } = req.body;

            if (!name || !data) {
                return res.status(400).json({ error: 'Не указано имя или данные' });
            }

            const filename = name.toLowerCase().replace(/\s+/g, '_') + '.json';
            const filepath = path.join(__dirname, 'maps', 'saved_maps', filename);

            await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');

            res.json({ success: true, filename, path: `/maps/saved_maps/${filename}` });
        } catch (error) {
            console.error('Ошибка сохранения карты:', error);
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });


    // Отключение игрока
    socket.on('disconnect', () => {
        console.log('Отключение:', socket.id, socket.username);
        
        const userId = socket.userId;
        
        // НЕ удаляем пользователя из users - он может переподключиться
        // Просто помечаем, что он отключен
        if (userId) {
            const user = users.get(userId);
            if (user) {
                console.log(`Пользователь ${socket.username} отключен, но данные сохранены для переподключения`);
            }
        }
        
        if (socket.roomCode) {
            const room = rooms.get(socket.roomCode);
            if (room) {
                // Уведомляем других игроков об отключении
                socket.to(socket.roomCode).emit('player-disconnected', { 
                    userId: userId, 
                    username: socket.username 
                });
                
                console.log(`Пользователь ${socket.username} отключился от комнаты ${socket.roomCode}, но может переподключиться`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
