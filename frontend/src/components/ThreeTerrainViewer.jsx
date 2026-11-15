import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ThreeTerrainViewer = ({
  type = 'MOON',
  title = '[SPACE TARGET]',
  subtitle = 'Moon • g=1.62 m/s²',
  beaconText = 'TARGET • 89.9°',
  viewMode = 'normal', // 'normal' | 'dem' | 'roughness'
  pitch = 0,
  roll = 0,
  onTerrainClick,
  onCameraChange,
  syncedCameraState
}) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const terrainMeshRef = useRef(null);
  const roverGroupRef = useRef(null);

  const isMoon = type === 'MOON' || type === 'moon';
  const isMars = type === 'MARS' || type === 'mars';

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Escena Three.js
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const bgColor = isMoon ? 0x15191d : isMars ? 0x242321 : 0x1c2321;
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.015);

    // Cámara
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.set(0, 18, 28);
    camera.lookAt(0, 2, 0);

    // Renderizador WebGL
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, isMoon ? 0.35 : isMars ? 0.45 : 0.55);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, isMoon ? 2.4 : isMars ? 2.0 : 1.8);
    sunLight.position.set(25, 35, 20);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const rimColor = isMoon ? 0xb9c6cc : isMars ? 0xbda085 : 0xa4b69d;
    const rimLight = new THREE.DirectionalLight(rimColor, 0.6);
    rimLight.position.set(-20, 10, -20);
    scene.add(rimLight);

    // Terreno 3D Procedural
    const gridRes = 64;
    const planeGeo = new THREE.PlaneGeometry(40, 40, gridRes, gridRes);
    planeGeo.rotateX(-Math.PI / 2);

    const pos = planeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const distFromCenter = Math.sqrt(x * x + z * z);

      let y = 0;
      if (isMoon) {
        const craterRadius = 9;
        if (distFromCenter < craterRadius) {
          y = -4.2 + Math.pow(distFromCenter / craterRadius, 2) * 4.2;
        } else if (distFromCenter < craterRadius + 3.5) {
          const rimFactor = (distFromCenter - craterRadius) / 3.5;
          y = Math.sin(rimFactor * Math.PI) * 1.8;
        } else {
          y = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 0.5;
        }
      } else if (isMars) {
        y = Math.sin(x * 0.2) * 2.5 + Math.cos(z * 0.15) * 1.5;
        if (x > -5 && x < 5) {
          y -= 3.5 * Math.cos((x / 5) * (Math.PI / 2));
        }
      } else {
        // Tierra análogo (desierto / lago / cañón)
        y = Math.sin(x * 0.25) * 1.2 + Math.cos(z * 0.3) * 0.8;
      }

      // Micro rugosidad
      y += (Math.sin(x * 2.5) + Math.cos(z * 2.5)) * 0.15;
      pos.setY(i, y);
    }

    planeGeo.computeVertexNormals();

    // Material según modo de sombreado
    let terrainMat;
    if (viewMode === 'dem') {
      terrainMat = new THREE.MeshStandardMaterial({
        color: isMoon ? 0xb9c6cc : isMars ? 0xbda085 : 0xa4b69d,
        wireframe: true,
        roughness: 0.8
      });
    } else if (viewMode === 'roughness') {
      terrainMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 1.0,
        metalness: 0.1
      });
    } else {
      const baseCol = isMoon ? 0x64748b : isMars ? 0x9a3412 : 0x78716c;
      terrainMat = new THREE.MeshStandardMaterial({
        color: baseCol,
        roughness: 0.9,
        metalness: 0.05,
        flatShading: true
      });
    }

    const terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // Baliza interactiva en el centro
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(0, 0, 0);

    const pinGeo = new THREE.CylinderGeometry(0.15, 0.05, 3.5, 8);
    const pinMat = new THREE.MeshBasicMaterial({ color: rimColor });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.y = 1.75;
    beaconGroup.add(pin);

    const headGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 3.5;
    beaconGroup.add(head);

    scene.add(beaconGroup);

    // Controles de ratón para rotación orbital
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotX = 0.3;
    let rotY = 0;
    let camDistance = 32;

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      rotY -= dx * 0.008;
      rotX = Math.max(0.1, Math.min(Math.PI / 2.2, rotX + dy * 0.008));

      if (onCameraChange) {
        onCameraChange({ x: rotX, y: rotY }, camDistance);
      }
    };

    const onMouseUp = () => { isDragging = false; };

    const onWheel = (e) => {
      camDistance = Math.max(12, Math.min(60, camDistance + e.deltaY * 0.03));
      if (onCameraChange) {
        onCameraChange({ x: rotX, y: rotY }, camDistance);
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel);

    // Loop de render
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Usar estado sincronizado de cámara si está disponible
      const currentRotX = syncedCameraState ? syncedCameraState.rotation.x : rotX;
      const currentRotY = syncedCameraState ? syncedCameraState.rotation.y : rotY;
      const currentDist = syncedCameraState ? syncedCameraState.distance : camDistance;

      camera.position.x = currentDist * Math.sin(currentRotY) * Math.cos(currentRotX);
      camera.position.z = currentDist * Math.cos(currentRotY) * Math.cos(currentRotX);
      camera.position.y = currentDist * Math.sin(currentRotX);
      camera.lookAt(0, 0, 0);

      head.position.y = 3.5 + Math.sin(Date.now() * 0.004) * 0.2;

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [type, viewMode, syncedCameraState]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Etiqueta flotante */}
      <div className="absolute top-3 left-3 z-10 bg-[#1d2328]/85 border border-[#48535b] backdrop-blur-md rounded-lg px-3 py-1.5 text-xs shadow-lg pointer-events-none">
        <div className="text-[10px] font-mono font-bold text-slate-400">{beaconText}</div>
        <div className="font-bold text-slate-100">{title}</div>
        <div className="text-[10px] text-slate-400">{subtitle}</div>
      </div>

      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};

export default ThreeTerrainViewer;
