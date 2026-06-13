# Sangwoo Minecraft Clone (Multiplayer)

A simplified Minecraft-like game built with Three.js and Socket.io.

## Features
- **Multiplayer Support**: See other players and their movements in real-time.
- **Shared World**: Block placement and destruction are synchronized across all clients.
- 3D Voxel World
- First-person controls (WASD + Mouse)
- Jumping mechanics
- Block interaction:
    - Left Click to destroy blocks
    - Right Click to place blocks
- Crosshair for precise interaction

## How to Run
1. Install dependencies: `npm install`
2. Start the server: `npm start`
3. Open `http://localhost:3000` in multiple browser tabs to test multiplayer.

## Technologies Used
- HTML5 / CSS3
- JavaScript (ES6+)
- [Three.js](https://threejs.org/) for 3D rendering
- [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) for the backend
- [Socket.io](https://socket.io/) for real-time communication
