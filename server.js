const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '/')));

const players = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initialize new player
    players[socket.id] = {
        id: socket.id,
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
    };

    // Send current players to the new player
    socket.emit('currentPlayers', players);

    // Notify others about the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle player movement
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].position = movementData.position;
            players[socket.id].rotation = movementData.rotation;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Handle block placement
    socket.on('blockPlaced', (blockData) => {
        socket.broadcast.emit('blockPlaced', blockData);
    });

    // Handle block destruction
    socket.on('blockDestroyed', (blockData) => {
        socket.broadcast.emit('blockDestroyed', blockData);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
