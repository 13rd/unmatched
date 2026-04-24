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

    // Создание новой комнаты
    socket.on('create-room', (settings) => {
        const roomCode = generateRoomCode();
        
        rooms.set(roomCode, {
            settings: settings,
            chips: [],
            players: [socket.id],
            createdAt: Date.now()
        });
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`Комната создана: ${roomCode}`);
        socket.emit('room-created', { roomCode, settings });
    });

    // Подключение к существующей комнате
    socket.on('join-room', (roomCode) => {
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('room-error', 'Комната не найдена');
            return;
        }
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        room.players.push(socket.id);
        
        console.log(`Игрок ${socket.id} присоединился к комнате ${roomCode}`);
        
        // Отправляем текущее состояние игры новому игроку
        socket.emit('room-joined', {
            roomCode,
            settings: room.settings,
            chips: room.chips
        });
        
        // Уведомляем других игроков о новом подключении
        socket.to(roomCode).emit('player-joined', socket.id);
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

    // Отключение игрока
    socket.on('disconnect', () => {
        console.log('Отключение:', socket.id);
        
        if (socket.roomCode) {
            const room = rooms.get(socket.roomCode);
            if (room) {
                room.players = room.players.filter(id => id !== socket.id);
                
                // Уведомляем других игроков
                socket.to(socket.roomCode).emit('player-left', socket.id);
                
                // Удаляем комнату только если она пустая И прошло больше 5 минут с создания
                const roomAge = Date.now() - room.createdAt;
                if (room.players.length === 0 && roomAge > 300000) {
                    rooms.delete(socket.roomCode);
                    console.log(`Комната ${socket.roomCode} удалена (неактивна)`);
                } else if (room.players.length === 0) {
                    console.log(`Комната ${socket.roomCode} пуста, но сохранена для переподключения`);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
