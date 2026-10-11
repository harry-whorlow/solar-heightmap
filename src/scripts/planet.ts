import * as THREE from "three";
import { createCameraRig } from "./camera-rig";
import { createSpinControls } from "./spin-controls";
import { HeightMapGeometry, loadColorMap, loadHeightMap } from "./height-map-geometry";
import { createTopoMaterial } from "./topo-material";
import { captureScene, parseScene } from "./scene-state";

const canvas = document.querySelector<HTMLCanvasElement>("#planet-canvas");
const exaggerationInput =
  document.querySelector<HTMLInputElement>("#exaggeration");
const exaggerationValue = document.querySelector<HTMLOutputElement>(
  "#exaggeration-value",
);
const contourInput = document.querySelector<HTMLSelectElement>("#contours");
const heatmapInput = document.querySelector<HTMLInputElement>("#heatmap");
const materialInput = document.querySelector<HTMLInputElement>("#material");
const surfaceInput = document.querySelector<HTMLInputElement>("#surface");
const freeCamInput = document.querySelector<HTMLInputElement>("#free-cam");
const distanceInput = document.querySelector<HTMLInputElement>("#distance");
const distanceValue =
  document.querySelector<HTMLOutputElement>("#distance-value");
const copySceneButton =
  document.querySelector<HTMLButtonElement>("#copy-scene");

if (canvas) {
  const body = canvas.dataset.body ?? "moon";
  const radiusKm = Number(canvas.dataset.radiusKm);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  scene.add(camera);

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(5, 2, -3);
  camera.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const rig = createCameraRig(camera, {
    position: new THREE.Vector3(0, 1.05, 1.4),
    target: new THREE.Vector3(0, 0.95, 0),
    minRadius: 1.25,
    maxRadius: 6,
  });
  rig.setFree(freeCamInput?.checked ?? false);
  freeCamInput?.addEventListener("change", () =>
    rig.setFree(freeCamInput.checked),
  );

  const altitudeKm = () => Number(distanceInput?.value ?? 1300);
  const updateDistance = () => {
    rig.setDistance(1 + altitudeKm() / radiusKm);
    if (distanceValue) {
      distanceValue.value = `${altitudeKm().toLocaleString("en")} km`;
    }
  };
  distanceInput?.addEventListener("input", updateDistance);
  updateDistance();

  const planet = new THREE.Group();
  scene.add(planet);
  const spin = createSpinControls(planet, camera, canvas, { autoSpeed: 0.02 });

  const initialScene = parseScene(canvas.dataset.scene);
  if (initialScene) {
    if (distanceInput) distanceInput.value = String(initialScene.distanceKm);
    if (freeCamInput) freeCamInput.checked = initialScene.freeCam;
    rig.setFree(initialScene.freeCam);
    updateDistance();
    rig.setPose(
      new THREE.Vector3(...initialScene.camera.position),
      new THREE.Quaternion(...initialScene.camera.quaternion),
    );
    planet.quaternion.set(...initialScene.planet.quaternion);
  }

  copySceneButton?.addEventListener("click", async () => {
    const state = captureScene(camera, planet, {
      distanceKm: altitudeKm(),
      freeCam: freeCamInput?.checked ?? false,
    });
    try {
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      copySceneButton.textContent = "Copied";
    } catch {
      console.log(state);
      copySceneButton.textContent = "Copy failed (see console)";
    }
    setTimeout(() => (copySceneButton.textContent = "Copy scene"), 1500);
  });

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const timer = new THREE.Timer();
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.1);
    rig.update(dt);
    spin.update(dt);
    renderer.render(scene, camera);
  });

  const exaggeration = () => Number(exaggerationInput?.value ?? 10);
  const data = await loadHeightMap(body);
  const colorMap = data.meta.colorFile ? await loadColorMap(data.meta.colorFile) : null;
  if (!colorMap && materialInput) {
    materialInput.checked = false;
    materialInput.disabled = true;
  }
  const geometry = new HeightMapGeometry(data, exaggeration());
  const contourInterval = () => Number(contourInput?.value ?? 1);
  const material = createTopoMaterial({
    heightMap: geometry.heightTexture,
    minKm: data.meta.minKm,
    maxKm: data.meta.maxKm,
    contourIntervalKm: contourInterval(),
    heatmap: heatmapInput?.checked ?? true,
    surface: surfaceInput?.checked ?? true,
    colorMap,
    material: materialInput?.checked ?? false,
  });
  planet.add(new THREE.Mesh(geometry, material));

  let pending = false;
  exaggerationInput?.addEventListener("input", () => {
    if (exaggerationValue) exaggerationValue.value = `${exaggeration()}×`;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      geometry.setExaggeration(exaggeration());
      pending = false;
    });
  });

  contourInput?.addEventListener("change", () =>
    material.setContourInterval(contourInterval()),
  );
  // Heat map and material both tint the surface, so only one can be on at a time.
  heatmapInput?.addEventListener("change", () => {
    if (heatmapInput.checked && materialInput?.checked) {
      materialInput.checked = false;
      material.setMaterial(false);
    }
    material.setHeatmap(heatmapInput.checked);
  });
  materialInput?.addEventListener("change", () => {
    if (materialInput.checked && heatmapInput?.checked) {
      heatmapInput.checked = false;
      material.setHeatmap(false);
    }
    material.setMaterial(materialInput.checked);
  });
  surfaceInput?.addEventListener("change", () => {
    if (!surfaceInput.checked && contourInput && contourInterval() === 0) {
      contourInput.value = "1";
      material.setContourInterval(1);
    }
    material.setSurface(surfaceInput.checked);
  });
}
