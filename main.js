import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { io } from 'socket.io-client';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10); // Start higher and back to see the world

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x87ceeb); // Ensure background color is set on renderer too
document.body.appendChild(renderer.domElement);

// Socket Initialization
let socket;
try {
    if (typeof io !== 'undefined') {
        socket = io();
    }
} catch (e) {
    console.error("Socket.io initialization failed:", e);
}

const remotePlayers = {};
const playerGeometry = new THREE.BoxGeometry(0.5, 1.8, 0.5);
const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x0000ff }); // Blue for other players

if (socket) {
    socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (id !== socket.id) {
                addRemotePlayer(players[id]);
            }
        });
    });

    socket.on('newPlayer', (playerInfo) => {
        addRemotePlayer(playerInfo);
    });

    socket.on('playerMoved', (playerInfo) => {
        if (remotePlayers[playerInfo.id]) {
            remotePlayers[playerInfo.id].position.copy(playerInfo.position);
            remotePlayers[playerInfo.id].rotation.y = playerInfo.rotation.y;
        }
    });

    socket.on('playerDisconnected', (id) => {
        if (remotePlayers[id]) {
            scene.remove(remotePlayers[id]);
            delete remotePlayers[id];
        }
    });

    socket.on('blockPlaced', (blockData) => {
        const material = blockMaterials[blockData.type] || groundMaterial;
        const newBlock = new THREE.Mesh(blockGeometry, material);
        newBlock.position.set(blockData.x, blockData.y, blockData.z);
        scene.add(newBlock);
        worldBlocks.push(newBlock);
    });

    socket.on('blockDestroyed', (blockData) => {
        const blockToRemove = worldBlocks.find(b => 
            Math.round(b.position.x) === Math.round(blockData.x) && 
            Math.round(b.position.y) === Math.round(blockData.y) && 
            Math.round(b.position.z) === Math.round(blockData.z)
        );
        if (blockToRemove) {
            scene.remove(blockToRemove);
            worldBlocks.splice(worldBlocks.indexOf(blockToRemove), 1);
        }
    });
}

function addRemotePlayer(playerInfo) {
    const remotePlayer = new THREE.Mesh(playerGeometry, playerMaterial);
    remotePlayer.position.copy(playerInfo.position);
    scene.add(remotePlayer);
    remotePlayers[playerInfo.id] = remotePlayer;
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Bright white light
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(50, 100, 50); // Position the light
directionalLight.castShadow = true; // Enable shadows
scene.add(directionalLight);

// Ground - Voxel World Generation
const blockSize = 1;
const worldWidth = 32;
const worldDepth = 32;

const blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 }); // Green for grass
const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 }); // Grey for stone
const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown for dirt
const woodMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 }); // Dark brown for wood
const lavaMaterial = new THREE.MeshLambertMaterial({ color: 0xff4500, emissive: 0xff0000 }); // Glowing lava

const blockMaterials = {
    'grass': groundMaterial,
    'dirt': dirtMaterial,
    'stone': stoneMaterial,
    'wood': woodMaterial,
    'lava': lavaMaterial
};

const worldBlocks = []; // To store references to all blocks in the world

for (let x = -worldWidth / 2; x < worldWidth / 2; x++) {
    for (let z = -worldDepth / 2; z < worldDepth / 2; z++) {
        // Top layer (Grass)
        let block = new THREE.Mesh(blockGeometry, groundMaterial);
        block.position.set(x * blockSize, -0.5 * blockSize, z * blockSize);
        scene.add(block);
        worldBlocks.push(block);

        // Dirt layer
        block = new THREE.Mesh(blockGeometry, dirtMaterial);
        block.position.set(x * blockSize, -1.5 * blockSize, z * blockSize);
        scene.add(block);
        worldBlocks.push(block);

        // Lava layer (At the very bottom)
        block = new THREE.Mesh(blockGeometry, lavaMaterial);
        block.position.set(x * blockSize, -2.5 * blockSize, z * blockSize);
        scene.add(block);
        worldBlocks.push(block);
    }
}

// Inventory System
let selectedBlockIndex = 0;
const inventory = ['grass', 'dirt', 'stone', 'wood'];
const hotbarSlots = document.querySelectorAll('.slot');

function updateInventoryUI() {
    hotbarSlots.forEach((slot, index) => {
        if (index === selectedBlockIndex) {
            slot.classList.add('active');
        } else {
            slot.classList.remove('active');
        }
    });
}

// Player Controls
const controls = new PointerLockControls(camera, document.body);

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const crosshair = document.getElementById('crosshair');

if (instructions) {
    instructions.addEventListener('click', function () {
        controls.lock();
    });
}

controls.addEventListener('lock', function () {
    if (instructions) instructions.style.display = 'none';
    if (blocker) blocker.style.display = 'none';
    if (crosshair) crosshair.style.display = 'block';
});

controls.addEventListener('unlock', function () {
    if (blocker) blocker.style.display = 'block';
    if (instructions) instructions.style.display = 'block';
    if (crosshair) crosshair.style.display = 'none';
});

scene.add(controls.object);

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();

document.addEventListener('keydown', function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            if (canJump === true) velocity.y += 350;
            canJump = false;
            break;
        case 'Digit1':
            selectedBlockIndex = 0;
            updateInventoryUI();
            break;
        case 'Digit2':
            selectedBlockIndex = 1;
            updateInventoryUI();
            break;
        case 'Digit3':
            selectedBlockIndex = 2;
            updateInventoryUI();
            break;
        case 'Digit4':
            selectedBlockIndex = 3;
            updateInventoryUI();
            break;
    }
});

document.addEventListener('keyup', function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
});

// Block Interaction
const raycaster = new THREE.Raycaster();

document.addEventListener('mousedown', function (event) {
    if (controls.isLocked === true) {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(worldBlocks);

        if (intersects.length > 0) {
            const intersect = intersects[0];

            if (event.button === 0) { // Left click to destroy
                const pos = intersect.object.position;
                if (socket) socket.emit('blockDestroyed', { x: pos.x, y: pos.y, z: pos.z });
                scene.remove(intersect.object);
                worldBlocks.splice(worldBlocks.indexOf(intersect.object), 1);
            } else if (event.button === 2) { // Right click to place
                const normal = intersect.face.normal;
                const newBlockPosition = new THREE.Vector3().copy(intersect.object.position).add(normal);
                const blockType = inventory[selectedBlockIndex];
                const material = blockMaterials[blockType];

                if (socket) socket.emit('blockPlaced', { 
                    x: newBlockPosition.x, 
                    y: newBlockPosition.y, 
                    z: newBlockPosition.z,
                    type: blockType
                });
                
                const newBlock = new THREE.Mesh(blockGeometry, material);
                newBlock.position.copy(newBlockPosition);
                scene.add(newBlock);
                worldBlocks.push(newBlock);
            }
        }
    }
});

document.addEventListener('contextmenu', function (event) {
    event.preventDefault(); // Prevent context menu on right click
});


let prevTime = performance.now();

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked === true) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // this ensures consistent movements in all directions

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        controls.object.position.y += (velocity.y * delta); // new behavior

        if (controls.object.position.y < 1) {
            velocity.y = 0;
            controls.object.position.y = 1;
            canJump = true;
        }

        // Lava Check (Simple)
        if (controls.object.position.y < -1.5) {
            // Respawn if falling into lava
            controls.object.position.set(0, 5, 10);
            velocity.set(0, 0, 0);
        }

        // Emit movement to server
        if (socket) {
            socket.emit('playerMovement', {
                position: controls.object.position,
                rotation: {
                    y: controls.object.rotation.y
                }
            });
        }
    }

    renderer.render(scene, camera);

    prevTime = time;
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
