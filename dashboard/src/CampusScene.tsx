import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BuildingRecord } from "./api";

interface CampusSceneProps {
  buildings: BuildingRecord[];
  onBuildingSelect: (buildingId: string) => void;
}

const BUILDING_CONFIG = [
  {
    id: "B01",
    name: "Academic Building",
    position: [-8, 0, 0] as [number, number, number],
    width: 5.2,
    depth: 5,
    floors: 4,
    color: 0x287bd4,
  },
  {
    id: "B02",
    name: "Technology Building",
    position: [0, 0, -2] as [number, number, number],
    width: 5.8,
    depth: 5.4,
    floors: 5,
    color: 0x13a6b5,
  },
  {
    id: "B03",
    name: "Innovation Building",
    position: [8, 0, 0] as [number, number, number],
    width: 5.2,
    depth: 5,
    floors: 3,
    color: 0x7868d8,
  },
];

export default function CampusScene({
  buildings,
  onBuildingSelect,
}: CampusSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onBuildingSelect);
  const buildingsRef = useRef(buildings);

  useEffect(() => {
    selectRef.current = onBuildingSelect;
  }, [onBuildingSelect]);

  useEffect(() => {
    buildingsRef.current = buildings;
  }, [buildings]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrame = 0;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081321);
    scene.fog = new THREE.Fog(0x081321, 28, 65);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      150,
    );

    camera.position.set(19, 16, 24);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.minDistance = 13;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.target.set(0, 3, 0);

    scene.add(new THREE.AmbientLight(0x9dbbdf, 1.7));

    const hemisphere = new THREE.HemisphereLight(
      0x9ccfff,
      0x152b38,
      1.5,
    );
    scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(-12, 22, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -28;
    keyLight.shadow.camera.right = 28;
    keyLight.shadow.camera.top = 28;
    keyLight.shadow.camera.bottom = -28;
    scene.add(keyLight);

    const cyanLight = new THREE.PointLight(0x19bfff, 45, 30);
    cyanLight.position.set(0, 9, -5);
    scene.add(cyanLight);

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x14283a,
      roughness: 0.9,
      metalness: 0.05,
    });

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(65, 65),
      groundMaterial,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(65, 52, 0x28506c, 0x19354b);
    grid.position.y = -0.1;
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];

    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.24;
    });

    scene.add(grid);

    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c3042,
      roughness: 0.85,
    });

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(25, 0.08, 2.4),
      roadMaterial,
    );
    road.position.set(0, -0.02, 7);
    road.receiveShadow = true;
    scene.add(road);

    const roadLineMaterial = new THREE.MeshBasicMaterial({
      color: 0x35bdf5,
      transparent: true,
      opacity: 0.55,
    });

    for (let i = -11; i <= 11; i += 2) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.015, 0.055),
        roadLineMaterial,
      );
      line.position.set(i, 0.03, 7);
      scene.add(line);
    }

    const clickableMeshes: THREE.Object3D[] = [];
    const buildingGroups: THREE.Group[] = [];

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8be7ff,
      emissive: 0x087ca8,
      emissiveIntensity: 0.58,
      metalness: 0.25,
      roughness: 0.16,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18,
    });

    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b3852,
      metalness: 0.62,
      roughness: 0.3,
    });

    const addBox = (
      parent: THREE.Object3D,
      geometry: THREE.BoxGeometry,
      material: THREE.Material,
      position: [number, number, number],
      castShadow = true,
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    BUILDING_CONFIG.forEach((config, index) => {
      const group = new THREE.Group();
      group.position.set(...config.position);
      group.userData.buildingId = config.id;

      const height = config.floors * 1.65;
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: 0.24,
        metalness: 0.5,
        roughness: 0.28,
      });

      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: index === 1 ? 0x1c344c : 0x172d43,
        metalness: 0.48,
        roughness: 0.34,
      });

      const body = addBox(
        group,
        new THREE.BoxGeometry(config.width, height, config.depth),
        bodyMaterial,
        [0, height / 2, 0],
      );

      body.userData.buildingId = config.id;
      body.userData.isBuilding = true;
      clickableMeshes.push(body);

      // Floor separation and glass windows.
      for (let floor = 0; floor < config.floors; floor++) {
        const floorY = floor * 1.65 + 0.83;

        const strip = addBox(
          group,
          new THREE.BoxGeometry(config.width + 0.08, 0.07, config.depth + 0.08),
          accentMaterial,
          [0, floor * 1.65 + 0.05, 0],
        );
        strip.userData.buildingId = config.id;
        clickableMeshes.push(strip);

        for (let window = 0; window < 4; window++) {
          const x = (window - 1.5) * (config.width / 4.3);

          const frontWindow = addBox(
            group,
            new THREE.BoxGeometry(0.66, 0.88, 0.055),
            glassMaterial,
            [x, floorY, config.depth / 2 + 0.035],
            false,
          );

          const sideWindow = addBox(
            group,
            new THREE.BoxGeometry(0.055, 0.88, 0.66),
            glassMaterial,
            [config.width / 2 + 0.035, floorY, x * 0.72],
            false,
          );

          frontWindow.userData.buildingId = config.id;
          sideWindow.userData.buildingId = config.id;
          clickableMeshes.push(frontWindow, sideWindow);
        }
      }

      // Roof and architectural details.
      const roof = addBox(
        group,
        new THREE.BoxGeometry(config.width + 0.4, 0.22, config.depth + 0.4),
        roofMaterial,
        [0, height + 0.12, 0],
      );
      roof.userData.buildingId = config.id;
      clickableMeshes.push(roof);

      const roofAccent = addBox(
        group,
        new THREE.BoxGeometry(config.width * 0.48, 0.12, 0.24),
        accentMaterial,
        [0, height + 0.3, 0],
      );
      roofAccent.userData.buildingId = config.id;
      clickableMeshes.push(roofAccent);

      // Entrance.
      const entrance = addBox(
        group,
        new THREE.BoxGeometry(1.15, 1.65, 0.14),
        glassMaterial,
        [0, 0.84, config.depth / 2 + 0.09],
      );
      entrance.userData.buildingId = config.id;
      clickableMeshes.push(entrance);

      const entranceRoof = addBox(
        group,
        new THREE.BoxGeometry(1.65, 0.15, 0.85),
        accentMaterial,
        [0, 1.72, config.depth / 2 + 0.3],
      );
      entranceRoof.userData.buildingId = config.id;
      clickableMeshes.push(entranceRoof);

      // Building foundation.
      addBox(
        group,
        new THREE.BoxGeometry(config.width + 0.75, 0.18, config.depth + 0.75),
        roofMaterial,
        [0, -0.09, 0],
      );

      // Energy indicator.
      const indicator = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 16, 16),
        new THREE.MeshBasicMaterial({ color: config.color }),
      );
      indicator.position.set(config.width / 2 - 0.35, height + 0.65, 0);
      group.add(indicator);

      const indicatorLight = new THREE.PointLight(config.color, 2.5, 5);
      indicatorLight.position.copy(indicator.position);
      group.add(indicatorLight);

      // Building data label anchor.
      group.userData.indicator = indicator;
      group.userData.buildingIndex = index;

      scene.add(group);
      buildingGroups.push(group);
    });

    // Trees around the campus.
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x70533c,
    });

    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x267f70,
      roughness: 0.85,
    });

    const treePositions: [number, number, number][] = [
      [-13, 0, -7],
      [-13, 0, 4],
      [-5, 0, 10],
      [5, 0, 10],
      [13, 0, -7],
      [13, 0, 4],
      [-3, 0, -10],
      [4, 0, -11],
    ];

    treePositions.forEach(([x, y, z]) => {
      const tree = new THREE.Group();
      tree.position.set(x, y, z);

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.14, 0.8, 8),
        trunkMaterial,
      );
      trunk.position.y = 0.4;
      tree.add(trunk);

      const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(0.58, 12, 12),
        leafMaterial,
      );
      leaves.position.y = 1.1;
      leaves.scale.set(1, 1.15, 1);
      tree.add(leaves);

      scene.add(tree);
    });

    // Soft floating energy particles.
    const particleCount = 90;
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 35;
      particlePositions[i * 3 + 1] = Math.random() * 9 + 1;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );

    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0x4ccfff,
        size: 0.045,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
      }),
    );

    scene.add(particles);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();

      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const intersections = raycaster.intersectObjects(
        clickableMeshes,
        false,
      );

      const buildingId = intersections[0]?.object.userData.buildingId;

      if (typeof buildingId === "string") {
        selectRef.current(buildingId);
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const handleResize = () => {
      if (disposed) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      if (!width || !height) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();

    const animate = () => {
      if (disposed) return;

      animationFrame = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      buildingGroups.forEach((group, index) => {
        const indicator = group.userData.indicator as THREE.Mesh;
        indicator.position.y =
          BUILDING_CONFIG[index].floors * 1.65 + 0.65 +
          Math.sin(elapsed * 1.5 + index) * 0.12;
      });

      particles.rotation.y = elapsed * 0.012;
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();

      renderer.domElement.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );

      controls.dispose();

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();

          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });

      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="campus-scene-wrapper">
      <div className="campus-scene" ref={mountRef} />

      <div className="scene-overlay scene-top-left">
        <span className="scene-live-dot" />
        CAMPUS 3D MODEL
      </div>

      <div className="scene-overlay scene-top-right">
        <span>DRAG TO ROTATE</span>
        <span className="scene-control-divider">·</span>
        <span>SCROLL TO ZOOM</span>
      </div>

      <div className="scene-building-labels">
        {BUILDING_CONFIG.map((config) => {
          const data = buildingsRef.current.find(
            (item) => item.building_id === config.id,
          );

          return (
            <div className="scene-building-chip" key={config.id}>
              <span
                className="scene-building-dot"
                style={{ backgroundColor: `#${config.color.toString(16)}` }}
              />
              <div>
                <strong>{config.id}</strong>
                <span>
                  {data
                    ? `${data.total_energy_kwh.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })} kWh`
                    : config.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="scene-hint">
        <span className="scene-hint-icon">↗</span>
        Select a building to explore its energy dashboard
      </div>
    </div>
  );
}
