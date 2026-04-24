const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e8, // 100 MB
    pingTimeout: 60000
});

// Статические файлы
app.use(express.static(path.join(__dirname)));

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
            players: [userId],
            playerRoles: { [userId]: 'player1' },
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
        
        // Отправляем клиенту только базовые настройки (БЕЗ колод)
        socket.emit('room-created', { 
            roomCode,
            playerRole: 'player1',
            settings: {
                backgroundImage: settings.backgroundImage,
                points: settings.points,
                player1: {
                    mainColor: settings.player1.mainColor,
                    mainHP: settings.player1.mainHP,
                    extraColor: settings.player1.extraColor,
                    extraHP: settings.player1.extraHP,
                    extraCount: settings.player1.extraCount
                },
                player2: {
                    mainColor: settings.player2.mainColor,
                    mainHP: settings.player2.mainHP,
                    extraColor: settings.player2.extraColor,
                    extraHP: settings.player2.extraHP,
                    extraCount: settings.player2.extraCount
                }
            }
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
        
        // Проверяем, был ли этот пользователь уже в комнате
        if (room.playerRoles[userId]) {
            // Пользователь переподключается - восстанавливаем его роль
            playerRole = room.playerRoles[userId];
            console.log(`Пользователь ${socket.username} переподключился к комнате ${roomCode} как ${playerRole}`);
        } else {
            // Новый пользователь - назначаем роль
            // Проверяем, какие роли уже заняты
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
        
        // Отправляем текущее состояние игры новому игроку (БЕЗ колод)
        socket.emit('room-joined', {
            roomCode,
            playerRole: playerRole,
            settings: {
                backgroundImage: room.settings.backgroundImage,
                points: room.settings.points,
                player1: {
                    mainColor: room.settings.player1.mainColor,
                    mainHP: room.settings.player1.mainHP,
                    extraColor: room.settings.player1.extraColor,
                    extraHP: room.settings.player1.extraHP,
                    extraCount: room.settings.player1.extraCount
                },
                player2: {
                    mainColor: room.settings.player2.mainColor,
                    mainHP: room.settings.player2.mainHP,
                    extraColor: room.settings.player2.extraColor,
                    extraHP: room.settings.player2.extraHP,
                    extraCount: room.settings.player2.extraCount
                }
            },
            chips: room.chips,
            cards: room.cards || [],
            discardPiles: room.discardPiles || { player1: [], player2: [] }
        });
        
        // Уведомляем других игроков о новом подключении
        socket.to(roomCode).emit('player-joined', { userId, username: socket.username });
    });

    // Запрос колод
    socket.on('request-decks', () => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        // Отправляем колоды клиенту
        socket.emit('decks-data', {
            player1: room.settings.player1.deck || null,
            player2: room.settings.player2.deck || null
        });
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
                // НЕ удаляем игрока из комнаты - он может вернуться
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
