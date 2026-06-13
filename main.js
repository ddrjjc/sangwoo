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
    'tnt': new THREE.MeshLambertMaterial({ color: 0xff0000 })
};

const worldBlocks = [];
const worldWidth = 64;
const worldDepth = 64;

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

// --- Player Model (Steve) ---
class PlayerModel {
    constructor() {
        this.group = new THREE.Group();
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdbac });
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x00ffff });
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x0000ff });

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
        head.position.y = 1.5;
        this.group.add(head);

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.25), shirtMat);
        body.position.y = 0.9;
        this.group.add(body);

        const legGeo = new THREE.BoxGeometry(0.24, 0.6, 0.24);
        const lLeg = new THREE.Mesh(legGeo, pantsMat);
        lLeg.position.set(-0.13, 0.3, 0);
        this.group.add(lLeg);
        const rLeg = new THREE.Mesh(legGeo, pantsMat);
        rLeg.position.set(0.13, 0.3, 0);
        this.group.add(rLeg);

        const armGeo = new THREE.BoxGeometry(0.24, 0.7, 0.24);
        const lArm = new THREE.Mesh(armGeo, shirtMat);
        lArm.position.set(-0.38, 0.9, 0);
        this.group.add(lArm);
        const rArm = new THREE.Mesh(armGeo, shirtMat);
        rArm.position.set(0.38, 0.9, 0);
        this.group.add(rArm);

        scene.add(this.group);
    }
    update(pos, rotY, isFirstPerson) {
        this.group.position.copy(pos);
        this.group.position.y -= 1.0; // Offset to feet
        this.group.rotation.y = rotY;
        this.group.visible = !isFirstPerson;
    }
}
const localPlayerModel = new PlayerModel();

// --- Creeper Mob ---
class Creeper {
    constructor(x, y, z) {
        this.group = new THREE.Group();
        const green = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const black = new THREE.MeshLambertMaterial({ color: 0x000000 });

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), green);
        head.position.y = 1.45;
        this.group.add(head);

        // Face details
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), black);
        eyeL.position.set(-0.12, 1.55, 0.23);
        this.group.add(eyeL);
        const eyeR = eyeL.clone();
        eyeR.position.x = 0.12;
        this.group.add(eyeR);
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.05), black);
        mouth.position.set(0, 1.35, 0.23);
        this.group.add(mouth);

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), green);
        body.position.y = 0.8;
        this.group.add(body);

        const legGeo = new THREE.BoxGeometry(0.25, 0.4, 0.25);
        for(let i=0; i<4; i++) {
            const leg = new THREE.Mesh(legGeo, green);
            leg.position.set(i<2? -0.15:0.15, 0.2, i%2==0? 0.15:-0.15);
            this.group.add(leg);
        }

        this.group.position.set(x, y, z);
        scene.add(this.group);
        this.speed = 1.5;
    }
    update(delta, playerPos) {
        const dir = new THREE.Vector3().subVectors(playerPos, this.group.position);
        dir.y = 0;
        const dist = dir.length();
        if (dist < 15 && dist > 1.2) {
            dir.normalize();
            this.group.position.add(dir.multiplyScalar(this.speed * delta));
            this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
        }
    }
}
const creepers = Array.from({length: 10}, () => new Creeper((Math.random()-0.5)*40, 0, (Math.random()-0.5)*40));

// --- Controls & Physics ---
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.object);
camera.position.set(0, 5, 10);

let isFirstPerson = true;
let selectedBlockIndex = 0;
const inventory = ['grass', 'dirt', 'stone', 'wood', 'tnt'];

const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let canJump = false;

document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'Space': if (canJump) velocity.y += 15; canJump = false; break;
        case 'F5': isFirstPerson = !isFirstPerson; break;
        case 'Digit1': selectedBlockIndex = 0; updateUI(); break;
        case 'Digit2': selectedBlockIndex = 1; updateUI(); break;
        case 'Digit3': selectedBlockIndex = 2; updateUI(); break;
        case 'Digit4': selectedBlockIndex = 3; updateUI(); break;
        case 'Digit5': selectedBlockIndex = 4; updateUI(); break;
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
}

// --- Interaction ---
const raycaster = new THREE.Raycaster();
document.addEventListener('mousedown', (e) => {
    if (!controls.isLocked) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(worldBlocks);
    if (intersects.length > 0) {
        const intersect = intersects[0];
        if (e.button === 0) {
            if (intersect.object.userData.type === 'lava') return;
            if (intersect.object.userData.type === 'tnt') setTimeout(() => explode(intersect.object.position.clone()), 1000);
            scene.remove(intersect.object);
            worldBlocks.splice(worldBlocks.indexOf(intersect.object), 1);
        } else if (e.button === 2) {
            const pos = new THREE.Vector3().copy(intersect.object.position).add(intersect.face.normal);
            createBlock(pos.x, pos.y, pos.z, inventory[selectedBlockIndex]);
        }
    }
});

function explode(pos) {
    const radius = 3;
    const targets = worldBlocks.filter(b => b.position.distanceTo(pos) <= radius && b.userData.type !== 'lava');
    targets.forEach(b => {
        scene.remove(b);
        worldBlocks.splice(worldBlocks.indexOf(b), 1);
    });
}

// --- Game Loop ---
let prevTime = performance.now();
const pPos = new THREE.Vector3(0, 5, 0); // Logic position

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 40.0 * delta; // Gravity

        direction.z = Number(moveState.forward) - Number(moveState.backward);
        direction.x = Number(moveState.right) - Number(moveState.left);
        direction.normalize();

        if (moveState.forward || moveState.backward) velocity.z -= direction.z * 400.0 * delta;
        if (moveState.left || moveState.right) velocity.x -= direction.x * 400.0 * delta;

        // Apply movement to logic position
        const moveVec = new THREE.Vector3(-velocity.x * delta, velocity.y * delta, -velocity.z * delta);
        const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        playerForward.y = 0; playerForward.normalize();
        const playerRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        playerRight.y = 0; playerRight.normalize();

        pPos.add(playerRight.multiplyScalar(-velocity.x * delta));
        pPos.add(playerForward.multiplyScalar(-velocity.z * delta));
        pPos.y += (velocity.y * delta);

        // Simple Voxel Collision
        let onGround = false;
        worldBlocks.forEach(b => {
            const dx = Math.abs(pPos.x - b.position.x);
            const dz = Math.abs(pPos.z - b.position.z);
            const dy = pPos.y - (b.position.y + 1); // 1 is block top
            if (dx < 0.7 && dz < 0.7 && dy > -0.1 && dy < 0.5 && velocity.y <= 0) {
                pPos.y = b.position.y + 1.5;
                velocity.y = 0;
                onGround = true;
            }
        });
        canJump = onGround;

        if (pPos.y < -20) { pPos.set(0, 5, 0); velocity.set(0,0,0); }

        localPlayerModel.update(pPos, camera.rotation.y, isFirstPerson);
        
        if (isFirstPerson) {
            camera.position.copy(pPos);
        } else {
            const offset = new THREE.Vector3(0, 1, 5).applyQuaternion(camera.quaternion);
            camera.position.copy(pPos).add(offset);
        }

        creepers.forEach(c => c.update(delta, pPos));
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
document.addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('instructions').addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { instructions.style.display = 'none'; blocker.style.display = 'none'; });
controls.addEventListener('unlock', () => { blocker.style.display = 'block'; instructions.style.display = 'block'; });
const hotbarSlots = document.querySelectorAll('.slot'); // Fix for undefined in earlier logic
