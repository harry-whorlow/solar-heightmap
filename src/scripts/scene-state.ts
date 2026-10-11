import * as THREE from "three";

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

/** A snapshot of the camera and planet, pasted into a page's `scene` prop to set where it starts. */
export interface SceneState {
  distanceKm: number;
  freeCam: boolean;
  camera: { position: Vec3; quaternion: Quat };
  planet: { quaternion: Quat };
}

const round = (values: number[]) => values.map((v) => Number(v.toFixed(5)));

export function captureScene(
  camera: THREE.Camera,
  planet: THREE.Object3D,
  { distanceKm, freeCam }: Pick<SceneState, "distanceKm" | "freeCam">,
): SceneState {
  return {
    distanceKm,
    freeCam,
    camera: {
      position: round(camera.position.toArray()) as Vec3,
      quaternion: round(camera.quaternion.toArray()) as Quat,
    },
    planet: { quaternion: round(planet.quaternion.toArray()) as Quat },
  };
}

export function parseScene(json: string | undefined): SceneState | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as SceneState;
  } catch {
    console.warn("Ignoring invalid scene", json);
    return null;
  }
}
