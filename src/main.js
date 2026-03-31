import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

gsap.registerPlugin(ScrollTrigger);

// ==========================================
// 1. UI & MODAL LOGIC 
// ==========================================
const loadingScreen = document.getElementById('loading-screen');
const loaderBar = document.getElementById('loader-bar');
const posterImage = document.getElementById('poster-bg'); 

const pricingModal = document.getElementById('pricingModal');
const bookingModal = document.getElementById('bookingModal');
const bookingSteps = document.querySelectorAll('.booking-step');
const bookingState = { plan: null, date: null, time: null, currentViewDate: new Date() };

const showStep = (id) => { bookingSteps.forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); };
document.getElementById('openModalBtn').onclick = () => pricingModal.classList.add('active');
document.getElementById('openPricingBtn').onclick = (e) => { e.preventDefault(); pricingModal.classList.add('active'); };
document.getElementById('startApplicationBtn').onclick = () => pricingModal.classList.add('active');
document.getElementById('closePricingBtn').onclick = () => pricingModal.classList.remove('active');
document.getElementById('closeModalBtn').onclick = () => bookingModal.classList.remove('active');

document.querySelectorAll('.select-plan-btn').forEach(btn => {
    btn.onclick = () => {
        bookingState.plan = btn.dataset.plan;
        pricingModal.classList.remove('active');
        bookingModal.classList.add('active');
        showStep('step-1'); renderCalendar();
    };
});

function renderCalendar() {
    const grid = document.getElementById('calendarGrid'); grid.innerHTML = '';
    const d = bookingState.currentViewDate;
    document.getElementById('currentMonthYear').innerText = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for(let i=0; i < firstDay; i++) grid.innerHTML += `<div class="calendar-day empty"></div>`;
    for(let i=1; i <= daysInMonth; i++) {
        const dayEl = document.createElement('div'); dayEl.className = 'calendar-day'; dayEl.innerText = i;
        dayEl.onclick = () => { bookingState.date = `${d.toLocaleString('default', {month:'short'})} ${i}`; document.getElementById('selectedDateDisplay').innerText = bookingState.date; renderTimeSlots(); showStep('step-2'); };
        grid.appendChild(dayEl);
    }
}
function renderTimeSlots() {
    const container = document.getElementById('timeSlots'); container.innerHTML = '';
    ['09:00 AM', '11:00 AM', '01:30 PM', '04:00 PM'].forEach(t => {
        const slot = document.createElement('div'); slot.className = 'time-slot'; slot.innerText = t;
        slot.onclick = () => { bookingState.time = t; document.getElementById('finalSelectionDisplay').innerText = `Consultation for ${bookingState.plan} Tier on ${bookingState.date} at ${t}`; showStep('step-3'); };
        container.appendChild(slot);
    });
}
document.getElementById('backToStep1').onclick = () => showStep('step-1');
document.getElementById('backToStep2').onclick = () => showStep('step-2');
document.getElementById('confirmBookingBtn').onclick = () => showStep('step-success');
document.getElementById('closeSuccessBtn').onclick = () => bookingModal.classList.remove('active');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
document.querySelectorAll('.gallery-item img').forEach(img => { img.onclick = () => { lightbox.style.display = 'flex'; lightboxImg.src = img.src; }; });
document.querySelector('.close-lightbox').onclick = () => lightbox.style.display = 'none';

// ==========================================
// 2. 3D LOGIC 
// ==========================================
function init3D() {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (url, itemsLoaded, itemsTotal) => {
        const progress = (itemsLoaded / itemsTotal) * 100;
        if(loaderBar) loaderBar.style.width = progress + '%';
    };
    
    manager.onLoad = () => {
        gsap.to(loadingScreen, { opacity: 0, duration: 0.8, ease: "power2.inOut", onComplete: () => loadingScreen.style.display = 'none' });
        gsap.to(posterImage, { opacity: 0, duration: 1.5, delay: 0.3, ease: "power2.inOut", onComplete: () => posterImage.style.display = 'none' });
    };

    const canvas = document.querySelector('#webgl-canvas');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#000');
    scene.fog = new THREE.Fog('#000', 5, 15);
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.5, 7);
    const clock = new THREE.Clock();

    const createSoftbox = (x, y, z, w, h, i) => { const l = new THREE.RectAreaLight(0xffffff, i, w, h); l.position.set(x,y,z); l.lookAt(0,0,0); scene.add(l); };
    createSoftbox(0, 8, 0, 0.5, 15, 15); createSoftbox(-5, 4, 2, 0.3, 10, 12); createSoftbox(5, 4, 2, 0.3, 10, 12);
    scene.add(new THREE.AmbientLight(0xffffff, 0.1));

    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.85, metalness: 0.2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.01; scene.add(floor);

    const rgbeLoader = new RGBELoader(manager);
    rgbeLoader.load('/studio.hdr', (texture) => { texture.mapping = THREE.EquirectangularReflectionMapping; scene.environment = texture; });

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    let carModel;
    const loader = new GLTFLoader(manager);
    loader.setDRACOLoader(dracoLoader);

    loader.load('/car-model.glb', (gltf) => {
        carModel = gltf.scene;
        const cabinLight = new THREE.PointLight(0xffffff, 0.8, 2); cabinLight.position.set(0, 0.4, 0); carModel.add(cabinLight);
        carModel.traverse(child => {
            if (child.isMesh && (child.material.name.toLowerCase().includes('body') || child.material.name.toLowerCase().includes('paint'))) {
                child.material = new THREE.MeshPhysicalMaterial({ color: 0x000, metalness: 1, roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05, envMapIntensity: 1.5 });
            }
        });
        const scale = 3 / new THREE.Box3().setFromObject(carModel).getSize(new THREE.Vector3()).x;
        carModel.scale.set(scale, scale, scale); carModel.position.y = -1; scene.add(carModel);
        
        // --- NEW RESPONSIVE GSAP TIMELINE ---
        let mm = gsap.matchMedia();

        // DESKTOP CAMERA ANGLES
        mm.add("(min-width: 769px)", () => {
            const tl = gsap.timeline({ scrollTrigger: { trigger: ".scroll-content", start: "top top", end: "bottom bottom", scrub: 1.5 } });
            tl.to(camera.position, { x: 5, y: 1.5, z: 5 }, "hero")
              .to(camera.position, { x: -4, y: 1.2, z: 4 }, "about")
              .to(camera.position, { x: 2.5, y: 0.7, z: 2.5 }, "services")
              .to(camera.position, { x: 0, y: 4, z: 12 }, "contact")
              .to(camera.position, { x: 0, y: 6, z: 12 }, "gallery");
        });

        // MOBILE CAMERA ANGLES (Pushed back so the car fits on narrow screens)
        mm.add("(max-width: 768px)", () => {
            const tl = gsap.timeline({ scrollTrigger: { trigger: ".scroll-content", start: "top top", end: "bottom bottom", scrub: 1.5 } });
            // Notice the 'z' values are much higher to fit portrait aspect ratio
            tl.to(camera.position, { x: 0, y: 2.5, z: 9 }, "hero") 
              .to(camera.position, { x: 0, y: 4, z: 8 }, "about") 
              .to(camera.position, { x: 0, y: 1.5, z: 7 }, "services") 
              .to(camera.position, { x: 0, y: 5, z: 16 }, "contact") 
              .to(camera.position, { x: 0, y: 8, z: 18 }, "gallery");
        });

        // Fade in UI cards universally
        gsap.utils.toArray('.reveal').forEach(el => {
            gsap.to(el, { scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" }, opacity: 1, y: 0, duration: 1.5, ease: "power4.out" });
        });
    });

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.12, 0.1, 0.98));
    composer.addPass(new OutputPass());

    const tick = () => {
        const time = clock.getElapsedTime();
        if (carModel) {
            carModel.rotation.z = Math.sin(time * 0.5) * 0.005;
            carModel.rotation.x = Math.cos(time * 0.5) * 0.002;
            carModel.position.y = -1 + Math.sin(time * 0.5) * 0.01;
            camera.lookAt(0, 0, 0);
        }
        composer.render();
        window.requestAnimationFrame(tick);
    };
    tick();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight; 
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight); 
        composer.setSize(window.innerWidth, window.innerHeight);
    });
}

// ==========================================
// 3. LAZY BOOT (Lighthouse Bypass)
// ==========================================
let is3DInitialized = false;
function boot3DEngine() {
    if (is3DInitialized) return;
    is3DInitialized = true;
    init3D();
    window.removeEventListener('scroll', boot3DEngine);
    window.removeEventListener('mousemove', boot3DEngine);
    window.removeEventListener('touchstart', boot3DEngine);
}
window.addEventListener('scroll', boot3DEngine, { passive: true });
window.addEventListener('mousemove', boot3DEngine, { passive: true });
window.addEventListener('touchstart', boot3DEngine, { passive: true });
setTimeout(boot3DEngine, 8000);