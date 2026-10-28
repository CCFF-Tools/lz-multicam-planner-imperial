import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../store/useStore';
import { getExportRegistry } from '../store/exportRegistry';
import { captureCurrentShot } from '../utils/captureShot';
import type { VenueCamera } from '../types';

const camera = (cameraId: string): VenueCamera => ({
  id: 'cam-capture',
  label: 'CAM 7',
  cameraId,
  lensId: 'ptz-sony-srg-x120',
  x: 12.3,
  y: 4.5,
  z: 2.1,
  pan: 37,
  tilt: -12,
  focalLength: 42,
  aperture: 3.2,
  focusDistance: 9.4,
  color: '#00aaff',
  extenderActive: 1,
  trackOffset: 0.75,
});

beforeEach(() => {
  const registry = getExportRegistry();
  registry.renderPreviewOffscreen = null;
  registry.capturePreviewCanvas = null;
  useStore.setState({
    cameras: [],
    selectedCameraId: null,
    shotlists: [],
    activeShotlistId: null,
    currentShotId: null,
    customCameras: [],
  });
});

describe('captureCurrentShot', () => {
  it('captures the complete camera pose and documents a matching numbered PTZ preset', () => {
    const cam = camera('birddog-p200');
    useStore.setState({ cameras: [cam], selectedCameraId: cam.id });

    const result = captureCurrentShot();
    expect(result).toMatchObject({ ok: true, hadThumbnail: false, ptzPresetNumber: 1 });

    const state = useStore.getState();
    const captured = state.shotlists[0].shots[0];
    expect(captured).toMatchObject({
      cameraId: cam.id,
      ptzPresetNumber: 1,
      state: {
        x: 12.3, y: 4.5, z: 2.1, pan: 37, tilt: -12,
        focalLength: 42, aperture: 3.2, focusDistance: 9.4, trackOffset: 0.75,
      },
    });
    expect(state.cameras[0].presets).toEqual([
      expect.objectContaining({
        number: 1,
        name: captured.name,
        pan: 37,
        tilt: -12,
        focalLength: 42,
        focusDistance: 9.4,
        savedAtPosition: { x: 12.3, y: 4.5, z: 2.1 },
      }),
    ]);
  });

  it('does not create device presets for a non-PTZ camera', () => {
    const cam = camera('sony-hdc-3500');
    useStore.setState({ cameras: [cam], selectedCameraId: cam.id });

    const result = captureCurrentShot();
    expect(result.ptzPresetNumber).toBeUndefined();
    expect(useStore.getState().shotlists[0].shots[0].ptzPresetNumber).toBeUndefined();
    expect(useStore.getState().cameras[0].presets).toBeUndefined();
  });
});
