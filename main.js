// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue background

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
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

const worldBlocks = []; // To store references to all blocks in the world

for (let x = -worldWidth / 2; x < worldWidth / 2; x++) {
    for (let z = -worldDepth / 2; z < worldDepth / 2; z++) {
        // Ground layer
        let block = new THREE.Mesh(blockGeometry, groundMaterial);
        block.position.set(x * blockSize, -0.5 * blockSize, z * blockSize);
        scene.add(block);
        worldBlocks.push(block);

        // A layer of dirt under the grass
        block = new THREE.Mesh(blockGeometry, dirtMaterial);
        block.position.set(x * blockSize, -1.5 * blockSize, z * blockSize);
        scene.add(block);
        worldBlocks.push(block);

        // A layer of stone under the dirt
        block = new THREE.Mesh(blockGeometry, stoneMaterial);
        block.position.set(x * blockSize, -2.5 * blockSize, z * blockSize);
        scene.add(block);
        worldBlocks.push(block);
    }
}

// Player Controls
const controls = new THREE.PointerLockControls(camera, document.body);

const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const crosshair = document.getElementById('crosshair');

instructions.addEventListener('click', function () {
    controls.lock();
});

controls.addEventListener('lock', function () {
    instructions.style.display = 'none';
    blocker.style.display = 'none';
    crosshair.style.display = 'block';
});

controls.addEventListener('unlock', function () {
    blocker.style.display = 'block';
    instructions.style.display = 'block';
    crosshair.style.display = 'none';
});

scene.add(controls.getObject());

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
const mouse = new THREE.Vector2();

let placeBlockType = new THREE.MeshLambertMaterial({ color: 0xff0000 }); // Red block to place

document.addEventListener('mousedown', function (event) {
    if (controls.isLocked === true) {
        // Use the center of the screen for raycasting when pointer is locked
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

        const intersects = raycaster.intersectObjects(worldBlocks);

        if (intersects.length > 0) {
            const intersect = intersects[0];

            if (event.button === 0) { // Left click to destroy
                scene.remove(intersect.object);
                worldBlocks.splice(worldBlocks.indexOf(intersect.object), 1);
            } else if (event.button === 2) { // Right click to place
                const normal = intersect.face.normal;
                const newBlockPosition = new THREE.Vector3().copy(intersect.object.position).add(normal);

                const newBlock = new THREE.Mesh(blockGeometry, placeBlockType);
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

        controls.getObject().position.y += (velocity.y * delta); // new behavior

        if (controls.getObject().position.y < 1) {
            velocity.y = 0;
            controls.getObject().position.y = 1;
            canJump = true;
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