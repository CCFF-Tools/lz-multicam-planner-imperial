import { describe, expect, it } from 'vitest';
import { applyCameraViewVisibility } from '../utils/cameraViewVisibility';

describe('rendered camera-view fleet visibility', () => {
  it('hides only the camera producing the current image', () => {
    const cameraA = { visible: true };
    const cameraB = { visible: true };
    const cameraC = { visible: true };
    const fleet = new Map([
      ['a', cameraA],
      ['b', cameraB],
      ['c', cameraC],
    ]);
    applyCameraViewVisibility(fleet, 'b');
    expect(cameraA.visible).toBe(true);
    expect(cameraB.visible).toBe(false);
    expect(cameraC.visible).toBe(true);
  });

  it('restores the previous model when Multiview renders the next camera', () => {
    const cameraA = { visible: true };
    const cameraB = { visible: true };
    const fleet = new Map([['a', cameraA], ['b', cameraB]]);
    applyCameraViewVisibility(fleet, 'a');
    applyCameraViewVisibility(fleet, 'b');
    expect(cameraA.visible).toBe(true);
    expect(cameraB.visible).toBe(false);
  });
});
