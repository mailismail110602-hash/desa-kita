const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 2000,
  pingTimeout: 5000
});

app.use(express.static(path.join(__dirname, 'public')));

// File database lokal sederhana untuk menyimpan progres desa
const DATA_FILE = path.join(__dirname, 'desa-data.json');

let gameWorld = {
  kasDesa: { kayu: 0, batu: 0, jerami: 0 },
  buildings: [],
  contributions: {},
  rumahCount: 0
};

// Muat data jika ada
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE);
    gameWorld = JSON.parse(raw);
  } catch (e) {
    console.log("Membuat data dunia baru...");
  }
}

function saveWorld() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(gameWorld, null, 2));
}

// Manajemen Ruangan Desa (Maks 50 pemain per desa)
const ROOM_CAPACITY = 50;
let rooms = {
  'desa-1': { count: 0, players: {} }
};

io.on('connection', (socket) => {
  console.log(`Pemain terhubung: ${socket.id}`);

  let assignedRoom = 'desa-1';
  for (let r in rooms) {
    if (rooms[r].count < ROOM_CAPACITY) {
      assignedRoom = r;
      break;
    }
  }

  if (!rooms[assignedRoom]) {
    rooms[assignedRoom] = { count: 0, players: {} };
  }

  rooms[assignedRoom].count++;
  socket.join(assignedRoom);
  socket.room = assignedRoom;

  // Kirim data awal dunia ke pemain baru
  socket.emit('init-world', {
    world: gameWorld,
    room: assignedRoom,
    id: socket.id
  });

  socket.on('join-game', (userData) => {
    const name = (userData.name || 'Warga').substring(0, 12);
    const skinColor = userData.skinColor || '#f5d0b1';
    const hat = userData.hat || 'peci';
    const shirtColor = userData.shirtColor || '#8B4513';
    const expression = userData.expression || 'senyum';

    rooms[socket.room].players[socket.id] = {
      id: socket.id,
      name: name,
      x: 400 + Math.random() * 100 - 50,
      y: 400 + Math.random() * 100 - 50,
      skinColor: skinColor,
      hat: hat,
      shirtColor: shirtColor,
      expression: expression,
      dir: 'down',
      moving: false
    };

    io.to(socket.room).emit('update-players', rooms[socket.room].players);
  });

  socket.on('player-move', (data) => {
    const room = rooms[socket.room];
    if (room && room.players[socket.id]) {
      room.players[socket.id].x = data.x;
      room.players[socket.id].y = data.y;
      room.players[socket.id].dir = data.dir;
      room.players[socket.id].moving = data.moving;

      socket.to(socket.room).emit('player-moved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        dir: data.dir,
        moving: data.moving
      });
    }
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.room];
    if (room && room.players[socket.id]) {
      delete room.players[socket.id];
      room.count--;
      io.to(socket.room).emit('remove-player', socket.id);
    }
    console.log(`Pemain terputus: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server DESA KITA berjalan di http://localhost:${PORT}`);
});