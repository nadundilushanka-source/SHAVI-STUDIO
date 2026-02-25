// 3D Animation Script - Shavi Studio
// Effect: Floating Professional Icons 
// (Camera, Video, Code, Palette - Abstract Representations)

if (typeof THREE === 'undefined') {
    console.error('Three.js not loaded');
}

document.addEventListener('DOMContentLoaded', () => {
    initThreeJs();
});

function initThreeJs() {
    const canvasContainer = document.getElementById('hero-canvas');
    if (!canvasContainer) return;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(50, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
    camera.position.z = 35; // Moved back to make icons look normal size

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasContainer.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x33ccff, 0.8);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0x0EA5E9, 0.8);
    pointLight2.position.set(-10, -10, 5);
    scene.add(pointLight2);

    // --- ICONS GROUP ---
    const iconsGroup = new THREE.Group();
    scene.add(iconsGroup);

    // Material Style: Glassy / Tech
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x111111,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.8,
        transmission: 0.2, // glass-like 
        clearcoat: 1.0
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
        color: 0x33ccff,
        emissive: 0x33ccff,
        emissiveIntensity: 0.5,
        wireframe: true
    });

    // 1. ABSTRACT CAMERA (Photography/Video)
    const cameraGroup = new THREE.Group();

    // Body
    const camBody = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 1), glassMaterial);
    cameraGroup.add(camBody);

    // Lens
    const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 32), accentMaterial);
    camLens.rotation.x = Math.PI / 2;
    camLens.position.z = 0.6;
    cameraGroup.add(camLens);

    cameraGroup.position.set(-8, 5, -5);
    cameraGroup.rotation.z = -0.2;
    iconsGroup.add(cameraGroup);


    // 2. ABSTRACT MONITOR / SCREEN (Web Design)
    const monitorGroup = new THREE.Group();

    // Screen
    const screenGeo = new THREE.BoxGeometry(3, 2, 0.2);
    const screenMat = [
        glassMaterial, glassMaterial, glassMaterial, glassMaterial,
        new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x111111 }), // Front 
        glassMaterial
    ];
    const screen = new THREE.Mesh(screenGeo, screenMat);
    monitorGroup.add(screen);

    // Code Lines (Abstract)
    const lineGeo = new THREE.PlaneGeometry(2, 0.1);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x33ccff });

    const line1 = new THREE.Mesh(lineGeo, lineMat);
    line1.position.z = 0.11;
    line1.position.y = 0.3;
    monitorGroup.add(line1);

    const line2 = new THREE.Mesh(lineGeo, lineMat);
    line2.position.z = 0.11;
    line2.scale.x = 0.7;
    line2.position.x = -0.3;
    monitorGroup.add(line2);

    monitorGroup.position.set(8, -2, -8);
    monitorGroup.rotation.y = -0.4;
    iconsGroup.add(monitorGroup);


    // 3. DESIGN PALETTE / SHAPES (Branding)
    const designGroup = new THREE.Group();

    const palette = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 7), glassMaterial);
    palette.rotation.x = Math.PI / 4;
    designGroup.add(palette);

    const sphere1 = new THREE.Mesh(new THREE.SphereGeometry(0.3), accentMaterial);
    sphere1.position.set(0.8, 0.5, 0.5);
    designGroup.add(sphere1);

    const sphere2 = new THREE.Mesh(new THREE.SphereGeometry(0.3), accentMaterial);
    sphere2.position.set(-0.8, 0, 0.5);
    designGroup.add(sphere2);

    designGroup.position.set(-5, -6, 0);
    iconsGroup.add(designGroup);


    // 4. FLOATING PARTICLES (Data/Magic)
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 80;
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 40;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({
        size: 0.12,
        color: 0x33ccff,
        transparent: true,
        opacity: 0.4
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);


    // --- MOUSE INTERACTION ---
    let mouseX = 0;
    let mouseY = 0;
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX - windowHalfX) * 0.001;
        mouseY = (event.clientY - windowHalfY) * 0.001;
    });

    // --- ANIMATION LOOP ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();

        // Rotate Icons Slowly

        // Camera Float
        cameraGroup.rotation.y = mouseX * 0.8 + Math.sin(time * 0.5) * 0.1;
        cameraGroup.rotation.x = mouseY * 0.8 + Math.cos(time * 0.3) * 0.1;
        cameraGroup.position.y = 5 + Math.sin(time) * 0.5;

        // Monitor Float
        monitorGroup.rotation.y = -0.4 + mouseX * 0.5;
        monitorGroup.rotation.x = mouseY * 0.5 + Math.sin(time * 0.4) * 0.05;
        monitorGroup.position.y = -2 + Math.cos(time * 0.8) * 0.5;

        // Design Palette Float
        designGroup.rotation.z = time * 0.2; // Spin slowly
        designGroup.position.y = -6 + Math.sin(time * 1.2) * 0.3;

        // Particles
        particles.rotation.y = time * 0.05;

        renderer.render(scene, camera);
    }
    animate();

    // Resize
    window.addEventListener('resize', () => {
        camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    });
}
