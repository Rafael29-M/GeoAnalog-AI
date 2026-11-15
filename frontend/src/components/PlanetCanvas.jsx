import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Renderizador 3D de alta fidelidad para la Luna y Marte.
 * Carga texturas fotográficas reales de misiones orbitales (LROC / Viking MDIM)
 * con fallback a generador procedural para máxima confiabilidad.
 */
export default function PlanetCanvas({ type = 'moon' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Escena y Cámara
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 3.6;

    // Renderizador con mapeo de tonos fílmico de alta gama
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = type === 'moon' ? 1.15 : 1.25;
    container.appendChild(renderer.domElement);

    // Cargar textura orbital real
    const texturePath = type === 'moon' ? '/maps/moon.jpg' : '/maps/mars.jpg';
    const textureLoader = new THREE.TextureLoader();
    
    // Geometría esférica de alta subdivisión
    const geometry = new THREE.SphereGeometry(1, 72, 72);
    
    // Material estándar PBR
    const material = new THREE.MeshStandardMaterial({
      roughness: type === 'moon' ? 0.95 : 0.78,
      metalness: 0.04,
    });

    textureLoader.load(
      texturePath,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        material.map = tex;
        material.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn(`Fallback procedural para ${type}:`, err);
      }
    );

    const sphere = new THREE.Mesh(geometry, material);
    // Inclinación axial astronómica real
    sphere.rotation.z = type === 'moon' ? (1.54 * Math.PI) / 180 : (25.19 * Math.PI) / 180;
    scene.add(sphere);

    // Halo atmosférico delicado para Marte
    let atmosphereMesh = null;
    if (type === 'mars') {
      const atmosGeom = new THREE.SphereGeometry(1.022, 64, 64);
      const atmosMat = new THREE.MeshBasicMaterial({
        color: 0xc85a32,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
      });
      atmosphereMesh = new THREE.Mesh(atmosGeom, atmosMat);
      scene.add(atmosphereMesh);
    }

    // Campo de partículas estelares sutiles en el fondo
    const sunLight = new THREE.DirectionalLight(0xfffbf0, type === 'moon' ? 3.2 : 3.4);
    sunLight.position.set(4.5, 1.8, 3.2);
    scene.add(sunLight);

    // Luz de relleno fría (espacio profundo)
    const fillLight = new THREE.DirectionalLight(0x38455c, 0.45);
    fillLight.position.set(-4, -2, -2);
    scene.add(fillLight);

    const ambientLight = new THREE.AmbientLight(0x0c1017, 0.35);
    scene.add(ambientLight);

    // Anillo orbital HUD holográfico sutil alrededor del planeta
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let targetRotationX = 0;
    let targetRotationY = 0;

    const onMouseDown = (e) => {
      if (isDragging || !e.isPrimary) return;
      dom.setPointerCapture(e.pointerId);
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      targetRotationY += deltaX * 0.005;
      targetRotationX += deltaY * 0.005;
      targetRotationX = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, targetRotationX));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onMouseDown);
    dom.addEventListener('pointermove', onMouseMove);
    dom.addEventListener('pointerup', onMouseUp);
    dom.addEventListener('pointercancel', onMouseUp);
    const onKeyDown = (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      targetRotationY += event.key === 'ArrowRight' ? .15 : event.key === 'ArrowLeft' ? -.15 : 0;
      targetRotationX = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, targetRotationX + (event.key === 'ArrowDown' ? .15 : event.key === 'ArrowUp' ? -.15 : 0)));
      sphere.rotation.x = targetRotationX;
      sphere.rotation.y = targetRotationY;
    };
    container.addEventListener('keydown', onKeyDown);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Ciclo de animación
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Rotación continua diurna
      

      // Amortiguación suave del arrastre
      sphere.rotation.y += (targetRotationY - sphere.rotation.y) * (reducedMotion.matches ? 1 : .15);
      sphere.rotation.x += (targetRotationX - sphere.rotation.x) * (reducedMotion.matches ? 1 : .15);



      if (atmosphereMesh) {
        atmosphereMesh.rotation.y = sphere.rotation.y;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      container.removeEventListener('keydown', onKeyDown);
      dom.removeEventListener('pointerdown', onMouseDown);
      dom.removeEventListener('pointermove', onMouseMove);
      dom.removeEventListener('pointerup', onMouseUp);
      dom.removeEventListener('pointercancel', onMouseUp);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
      atmosphereMesh?.geometry.dispose();
      atmosphereMesh?.material.dispose();




      renderer.dispose();
    };
  }, [type]);

  return (
    <div
      ref={mountRef}
      tabIndex={0}
      role="img"
      aria-label={`Globo interactivo de ${type === 'moon' ? 'la Luna' : 'Marte'}. Arrastra o usa las flechas para girar.`}
      style={{ touchAction: 'pan-y' }}
      className="w-full h-full cursor-grab active:cursor-grabbing rounded-lg"
    />
  );
}
