// 3D Avatar Tracking Face Script
// Features: 3D Face that follows mouse cursor (Top Left Corner)

if (typeof THREE === 'undefined') {
    console.warn('Three.js not loaded for Avatar');
}

document.addEventListener('DOMContentLoaded', () => {
    initAvatarFace();
});

function initAvatarFace() {
    const container = document.getElementById('avatar-canvas');
    if (!container) return;

    // Force "Normal Size" and "Matching Place" (Top Left Corner)
    container.style.width = '180px';
    container.style.height = '180px';
    container.style.position = 'fixed';
    container.style.top = '100px';   // Below Navbar
    container.style.left = '20px';   // Left align
    container.style.bottom = 'auto'; // Reset bottom
    container.style.right = 'auto';  // Reset right
    container.style.zIndex = '50';
    container.classList.remove('hidden'); // Ensure visible

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100); // 1:1 Aspect since it's 200x200
    camera.position.z = 8;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(180, 180); // Match container
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x33ccff, 0.8);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // --- AVATAR GROUP ---
    const avatar = new THREE.Group();
    scene.add(avatar);

    // Head
    const headGeo = new THREE.SphereGeometry(2.5, 32, 32);
    const headMat = new THREE.MeshToonMaterial({
        color: 0x111111,
        emissive: 0x222222,
        emissiveIntensity: 0.2
    });
    const head = new THREE.Mesh(headGeo, headMat);
    avatar.add(head);

    // Eyes Group (For independent movement)
    const eyesGroup = new THREE.Group();
    avatar.add(eyesGroup);

    // Eye Geometry
    const eyeGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x33ccff });

    // Left Eye
    const leftEye = new THREE.Group();
    const leMesh = new THREE.Mesh(eyeGeo, eyeMat);
    const lpMesh = new THREE.Mesh(pupilGeo, pupilMat);
    lpMesh.position.z = 0.5; // Pupil in front
    leftEye.add(leMesh);
    leftEye.add(lpMesh);
    leftEye.position.set(-1, 0.5, 2);
    eyesGroup.add(leftEye);

    // Right Eye
    const rightEye = new THREE.Group();
    const reMesh = new THREE.Mesh(eyeGeo, eyeMat);
    const rpMesh = new THREE.Mesh(pupilGeo, pupilMat);
    rpMesh.position.z = 0.5;
    rightEye.add(reMesh);
    rightEye.add(rpMesh);
    rightEye.position.set(1, 0.5, 2);
    eyesGroup.add(rightEye);

    // Mouth (Anticipation / Expression)
    const mouthGeo = new THREE.TorusGeometry(0.8, 0.1, 8, 16, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x33ccff });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.rotation.x = Math.PI;
    mouth.position.set(0, -1, 2.2);
    avatar.add(mouth);

    // Headphones (Tech look)
    const earGeo = new THREE.CylinderGeometry(1, 1, 0.5, 32);
    const earMat = new THREE.MeshStandardMaterial({ color: 0x33ccff });
    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-2.6, 0, 0);
    avatar.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(2.6, 0, 0);
    avatar.add(rightEar);

    const bandGeo = new THREE.TorusGeometry(2.8, 0.2, 16, 32, Math.PI);
    const band = new THREE.Mesh(bandGeo, earMat);
    band.position.y = 0;
    avatar.add(band);


    // --- MOUSE TRACKING ---
    let mouseX = 0;
    let mouseY = 0;
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    document.addEventListener('mousemove', (event) => {
        // Normalize mouse position (-1 to 1)
        mouseX = (event.clientX - windowHalfX) / windowHalfX;
        mouseY = (event.clientY - windowHalfY) / windowHalfY;
    });

    // --- ANIMATION TRACKING ---
    function animate() {
        requestAnimationFrame(animate);

        // Head looks slightly towards mouse
        avatar.rotation.y = THREE.MathUtils.lerp(avatar.rotation.y, mouseX * 0.5, 0.1);
        avatar.rotation.x = THREE.MathUtils.lerp(avatar.rotation.x, mouseY * 0.5, 0.1);

        // Eyes track mouse more aggressively
        eyesGroup.rotation.y = THREE.MathUtils.lerp(eyesGroup.rotation.y, mouseX * 0.8, 0.15);
        eyesGroup.rotation.x = THREE.MathUtils.lerp(eyesGroup.rotation.x, mouseY * 0.8, 0.15);

        renderer.render(scene, camera);
    }
    animate();

    // Resize
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}
