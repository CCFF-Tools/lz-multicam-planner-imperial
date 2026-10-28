// Physical camera fleet for the shared high-quality camera renderer.
// It intentionally contains no labels, FOV volumes, hit targets, or edit
// gizmos: those are planning aids, while camera bodies and supports are real
// scene objects that must occlude and appear in other cameras' pictures.
import { useCallback, useMemo } from 'react';
import type * as THREE from 'three';
import { useStore } from '../../store/useStore';
import { getCameraById } from '../../data/cameras';
import { getLensById } from '../../data/lenses';
import { effectiveCameraPos } from '../../utils/camera';
import { kameraModell, type KameraModell } from '../../utils/kameraModell';
import type { Detail, Tally } from '../../avplan/scene3d';
import type { VenueCamera } from '../../types';
import { useKameraRig } from './useKameraRig';
import RigStructure from './RigStructure';
import { Bediener } from './KameraModell';

interface CameraSceneRigProps {
  cam: VenueCamera;
  modell: KameraModell;
  operator: boolean;
  register: (cameraId: string, node: THREE.Group | null) => void;
}

function CameraSceneRig({ cam, modell, operator, register }: CameraSceneRigProps) {
  const position = effectiveCameraPos(cam);
  const { rig } = useKameraRig(modell, { x: position.x, y: position.y, z: cam.z, pan: cam.pan, tilt: cam.tilt });
  const attach = useCallback((node: THREE.Group | null) => register(cam.id, node), [cam.id, register]);
  return (
    <group ref={attach}>
      <primitive object={rig.gruppe} />
      {modell.skelett && <RigStructure cam={cam} isSelected={false} />}
      {operator && modell.bediener && (
        <Bediener id={cam.id} pose={modell.bediener} x={position.x} y={position.y} z={cam.z} pan={cam.pan} />
      )}
    </group>
  );
}

export default function CameraSceneFleet({ register, operators }: {
  register: (cameraId: string, node: THREE.Group | null) => void;
  operators: boolean;
}) {
  const cameras = useStore((state) => state.cameras);
  const customCameras = useStore((state) => state.customCameras);
  const customLenses = useStore((state) => state.customLenses);
  const programCameraId = useStore((state) => state.programCameraId);
  const ceilingHeightM = useStore((state) => state.venue.ceilingHeightM);
  const detail: Detail = cameras.length <= 16 ? 'hoch' : 'niedrig';
  const models = useMemo(() => {
    const result = new Map<string, KameraModell>();
    for (const cam of cameras) {
      const tally: Tally = cam.id === programCameraId ? 'rot' : 'aus';
      result.set(cam.id, kameraModell(
        cam,
        getCameraById(cam.cameraId, customCameras),
        getLensById(cam.lensId, customLenses),
        { detail, tally, deckeM: ceilingHeightM },
      ));
    }
    return result;
  }, [cameras, customCameras, customLenses, programCameraId, detail, ceilingHeightM]);

  return cameras.map((cam) => (
    <CameraSceneRig key={cam.id} cam={cam} modell={models.get(cam.id)!} operator={operators} register={register} />
  ));
}
