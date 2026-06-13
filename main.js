import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { io } from 'socket.io-client';

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x87ceeb);
document.body.appendChild(renderer.domElement);

// --- TNT Texture ---
function createTNTMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 128, 128);
    
    // Stripes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 40, 128, 48);
    
    // Text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TNT', 64, 75);
    
    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshLambertMaterial({ map: texture });
}

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(50, 100, 50);
scene.add(directionalLight);

// --- Materials & Blocks ---
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const blockMaterials = {
    'grass': new THREE.MeshLambertMaterial({ color: 0x00ff00 }),
    'dirt': new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    'stone': new THREE.MeshLambertMaterial({ color: 0x888888 }),
    'wood': new THREE.MeshLambertMaterial({ color: 0x654321 }),
    'lava': new THREE.MeshLambertMaterial({ color: 0xff4500, emissive: 0xff0000 }),
    'tnt': createTNTMaterial()
};

const worldBlocks = [];
const worldWidth = 80;
const worldDepth = 80;

for (let x = -worldWidth / 2; x < worldWidth / 2; x++) {
    for (let z = -worldDepth / 2; z < worldDepth / 2; z++) {
        createBlock(x, -0.5, z, 'grass');
        createBlock(x, -1.5, z, 'dirt');
        createBlock(x, -2.5, z, 'lava');
    }
}

function createBlock(x, y, z, type) {
    const block = new THREE.Mesh(blockGeometry, blockMaterials[type]);
    block.position.set(Math.round(x), Math.round(y), Math.round(z));
    block.userData.type = type;
    scene.add(block);
    worldBlocks.push(block);
    return block;
}

// --- Sword (Viewmodel) ---
const swordGroup = new THREE.Group();
const swordHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), new THREE.MeshLambertMaterial({color:0x3d2b1f}));
const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.03), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
swordBlade.position.y = 0.4;
swordGroup.add(swordHandle);
swordGroup.add(swordBlade);
swordGroup.position.set(0.5, -0.5, -0.8);
swordGroup.rotation.x = Math.PI / 4;
camera.add(swordGroup);
scene.add(camera);

let isAttacking = false;
let attackTime = 0;

// --- Creeper ---
class Creeper {
    constructor(x, y, z) {
        this.group = new THREE.Group();
        const green = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), green);
        head.position.y = 1.45;
        this.group.add(head);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), green);
        body.position.y = 0.8;
        this.group.add(body);
        this.group.position.set(x, y, z);
        scene.add(this.group);
    }
    update(delta, playerPos) {
        const dir = new THREE.Vector3().subVectors(playerPos, this.group.position);
        dir.y = 0;
        if (dir.length() < 15 && dir.length() > 1.2) {
            dir.normalize();
            this.group.position.add(dir.multiplyScalar(1.5 * delta));
            this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
        }
    }
}
const creepers = Array.from({length: 15}, () => new Creeper((Math.random()-0.5)*60, 0, (Math.random()-0.5)*60));

// --- Controls ---
const controls = new PointerLockControls(camera, document.body);
const pocket = document.getElementById('pocket');
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const crosshair = document.getElementById('crosshair');

let selectedBlockIndex = 0;
const inventory = ['grass', 'dirt', 'stone', 'wood', 'tnt', 'sword'];
const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();

document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') {
        if (pocket.style.display === 'flex') {
            pocket.style.display = 'none';
            controls.lock();
        } else {
            controls.unlock();
            pocket.style.display = 'flex';
        }
        return;
    }
    if (!controls.isLocked) return;

    switch (e.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'Space': velocity.y += 350 * 0.05; break;
        case 'Digit1': selectedBlockIndex = 0; updateUI(); break;
        case 'Digit2': selectedBlockIndex = 1; updateUI(); break;
        case 'Digit3': selectedBlockIndex = 2; updateUI(); break;
        case 'Digit4': selectedBlockIndex = 3; updateUI(); break;
        case 'Digit5': selectedBlockIndex = 4; updateUI(); break;
        case 'Digit6': selectedBlockIndex = 5; updateUI(); break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
    }
});

function updateUI() {
    document.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('active', i === selectedBlockIndex));
    swordGroup.visible = (inventory[selectedBlockIndex] === 'sword');
}

// --- TNT Logic ---
function explode(pos) {
    // Visual Flash
    const flash = new THREE.PointLight(0xffffff, 10, 10);
    flash.position.copy(pos);
    scene.add(flash);
    setTimeout(() => scene.remove(flash), 200);

    const radius = 5;
    const blocksToRemove = [];
    
    // Efficient distance check
    for (let i = worldBlocks.length - 1; i >= 0; i--) {
        const b = worldBlocks[i];
        if (b.position.distanceTo(pos) <= radius && b.userData.type !== 'lava') {
            scene.remove(b);
            worldBlocks.splice(i, 1);
        }
    }
}

// --- Interaction ---
const raycaster = new THREE.Raycaster();
document.addEventListener('mousedown', (e) => {
    if (!controls.isLocked) return;
    
    if (inventory[selectedBlockIndex] === 'sword') {
        isAttacking = true;
        attackTime = 0;
    }

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(worldBlocks);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        if (e.button === 0) {
            if (intersect.object.userData.type === 'lava') return;
            
            if (intersect.object.userData.type === 'tnt') {
                const tntBlock = intersect.object;
                const pos = tntBlock.position.clone();
                
                // Visual Fuse Feedback (Pulsing)
                let count = 0;
                const interval = setInterval(() => {
                    tntBlock.material.emissive.set(count % 2 === 0 ? 0xffffff : 0x000000);
                    count++;
                    if (count >= 10) {
                        clearInterval(interval);
                        explode(pos);
                    }
                }, 500);

                // Don't remove TNT immediately from scene, but remove from worldBlocks so it's not clicked again
                worldBlocks.splice(worldBlocks.indexOf(tntBlock), 1);
                setTimeout(() => scene.remove(tntBlock), 5000);
            } else {
                scene.remove(intersect.object);
                worldBlocks.splice(worldBlocks.indexOf(intersect.object), 1);
            }
        } else if (e.button === 2 && inventory[selectedBlockIndex] !== 'sword') {
            const pos = new THREE.Vector3().copy(intersect.object.position).add(intersect.face.normal);
            createBlock(pos.x, pos.y, pos.z, inventory[selectedBlockIndex]);
        }
    }
});

// --- Game Loop ---
let prevTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta * 0.1;

        const directionZ = Number(moveState.forward) - Number(moveState.backward);
        const directionX = Number(moveState.right) - Number(moveState.left);

        if (moveState.forward || moveState.backward) velocity.z -= directionZ * 400.0 * delta;
        if (moveState.left || moveState.right) velocity.x -= directionX * 400.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        controls.object.position.y += (velocity.y * delta);

        if (controls.object.position.y < 1) {
            velocity.y = 0;
            controls.object.position.y = 1;
        }

        if (isAttacking) {
            attackTime += delta * 15;
            swordGroup.rotation.x = Math.PI / 4 - Math.sin(attackTime) * 1.2;
            if (attackTime >= Math.PI) {
                isAttacking = false;
                swordGroup.rotation.x = Math.PI / 4;
            }
        }
        creepers.forEach(c => c.update(delta, controls.object.position));
    }
    renderer.render(scene, camera);
    prevTime = time;
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

instructions.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { 
    instructions.style.display = 'none'; 
    blocker.style.display = 'none'; 
    crosshair.style.display = 'block';
});
controls.addEventListener('unlock', () => { 
    if (pocket.style.display !== 'flex') {
        blocker.style.display = 'block'; 
        instructions.style.display = 'block'; 
    }
    crosshair.style.display = 'none';
});
updateUI();
