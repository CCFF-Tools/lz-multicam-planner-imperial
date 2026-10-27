import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('transient export state', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
  });

  it('does not advance the project version for a render-only camera change', async () => {
    const { useStore } = await import('../store/useStore');
    const { withTransientProjectState } = await import('../store/transientProjectState');
    useStore.getState().addCamera();
    const before = useStore.getState();
    const camera = before.cameras[0];
    withTransientProjectState(() => {
      useStore.setState({ cameras: [{ ...camera, focalLength: camera.focalLength * 2 }] });
    });
    expect(useStore.getState().projectVersion).toBe(before.projectVersion);
  });

  it('continues to count ordinary direct project changes', async () => {
    const { useStore } = await import('../store/useStore');
    useStore.getState().addCamera();
    const before = useStore.getState();
    const camera = before.cameras[0];
    useStore.setState({ cameras: [{ ...camera, focalLength: camera.focalLength * 2 }] });
    expect(useStore.getState().projectVersion).toBe(before.projectVersion + 1);
  });
});
