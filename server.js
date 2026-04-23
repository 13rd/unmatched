const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

const rooms = new Map();

function createGameState() {
  return {
    points: [],
    chips: [],
    players: {},
    currentTurn: 'player1',
    backgroundImage: null
  };
}

function generateDefaultPoints() {
  const points = [];
  const centerX = 600;
  const centerY = 400;
  const rows = [0, 80, 160, 240];
  const counts = [1, 4, 6, 4];
  
  let id = 0;
  rows.forEach((offsetY, rowIndex) => {
    const count = counts[rowIndex];
    const spacing = 120;
    const startX = centerX - ((count - 1) * spacing) / 2;
    
    for (let i = 0; i < count; i++) {
      points.push({
        id: id++,
        x: startX + i * spacing,
        y: centerY + offsetY - 120
      });
    }
  });
  
  return points;
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('createRoom', (callback) => {
    const roomId = generateRoomId();
    const gameState = createGameState();
    gameState.points = generateDefaultPoints();
    rooms.set(roomId, gameState);
    
    socket.join(roomId);
    gameState.players[socket.id] = 'player1';
    
    socket.emit('roomCreated', {
      roomId,
      player: 'player1',
      players: Object.keys(gameState.players)
    });
    
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on('joinRoom', (roomId, callback) => {
    const gameState = rooms.get(roomId);
    
    if (!gameState) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }
    
    const existingPlayers = Object.keys(gameState.players).length;
    
    if (existingPlayers >= 2) {
      socket.emit('error', { message: 'Комната уже заполнена' });
      return;
    }
    
    socket.join(roomId);
    const player = existingPlayers === 0 ? 'player1' : 'player2';
    gameState.players[socket.id] = player;
    
    socket.emit('roomJoined', {
      roomId,
      player,
      players: Object.keys(gameState.players),
      gameState: serializeGameState(gameState)
    });
    
    io.to(roomId).emit('playerJoined', {
      player,
      players: Object.keys(gameState.players)
    });
    
    console.log(`Player ${socket.id} joined room ${roomId} as ${player}`);
  });

  socket.on('setBackground', (roomId, imageData) => {
    const gameState = rooms.get(roomId);
    if (gameState) {
      gameState.backgroundImage = imageData;
      io.to(roomId).emit('backgroundUpdated', imageData);
    }
  });

  socket.on('setPoints', (roomId, points) => {
    const gameState = rooms.get(roomId);
    if (gameState) {
      gameState.points = points;
      io.to(roomId).emit('pointsUpdated', points);
    }
  });

  socket.on('chipMoved', (roomId, data) => {
    const gameState = rooms.get(roomId);
    if (!gameState) return;
    
    const { chipId, x, y, pointId } = data;
    let chip = gameState.chips.find(c => c.id === chipId);
    
    if (!chip) {
      chip = {
        id: chipId,
        x,
        y,
        color: data.color,
        player: data.player,
        isMain: data.isMain,
        hp: data.isMain ? 10 : 5,
        maxHp: data.isMain ? 10 : 5
      };
      gameState.chips.push(chip);
    } else {
      chip.x = x;
      chip.y = y;
      chip.pointId = pointId;
    }
    
    io.to(roomId).emit('chipMoved', data);
  });

  socket.on('chipAttached', (roomId, data) => {
    io.to(roomId).emit('chipAttached', data);
  });

  socket.on('chipDetached', (roomId, data) => {
    io.to(roomId).emit('chipDetached', data);
  });

  socket.on('updateHP', (roomId, data) => {
    const gameState = rooms.get(roomId);
    if (!gameState) return;
    
    const chip = gameState.chips.find(c => c.id === data.chipId);
    if (chip) {
      chip.hp = data.hp;
    }
    
    io.to(roomId).emit('hpUpdated', data);
  });

  socket.on('resetGame', (roomId) => {
    const gameState = rooms.get(roomId);
    if (gameState) {
      gameState.chips = [];
      io.to(roomId).emit('gameReset');
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    rooms.forEach((gameState, roomId) => {
      if (gameState.players[socket.id]) {
        delete gameState.players[socket.id];
        
        io.to(roomId).emit('playerLeft', { player: socket.id });
        
        if (Object.keys(gameState.players).length === 0) {
          setTimeout(() => {
            const state = rooms.get(roomId);
            if (state && Object.keys(state.players).length === 0) {
              rooms.delete(roomId);
              console.log(`Room ${roomId} deleted (empty)`);
            }
          }, 300000);
        }
      }
    });
  });
});

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function serializeGameState(gameState) {
  return {
    points: gameState.points,
    chips: gameState.chips,
    currentTurn: gameState.currentTurn,
    backgroundImage: gameState.backgroundImage
  };
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});