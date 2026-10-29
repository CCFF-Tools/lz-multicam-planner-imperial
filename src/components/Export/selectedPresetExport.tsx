import { createRoot } from 'react-dom/client';
import type { VenueCamera } from '../../types';
import { useStore } from '../../store/useStore';
import type { Units } from '../../utils/units';
import { collectPresetArtifacts, type CameraExportJob } from '../../utils/exportBatch';
import { drawPresetSheet } from '../../utils/drawPresetSheet';
import { presetSheetData } from '../../utils/presetExportSheet';
import Venue2D from '../Venue2D/Venue2D';
import KameraBildHost from '../Render3D/KameraBildHost';
import { renderPreset3D } from '../Render3D/kameraBild3d';

export interface PresetExportArtifact { filename: string; blob: Blob }
export const safeFilePart = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'export';
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function detachedRoot() {
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  Object.assign(container.style, { position: 'fixed', left: '-30000px', top: '0', width: '1200px', height: '1200px', pointerEvents: 'none' });
  document.body.appendChild(container);
  const root = createRoot(container);
  return { root, dispose: () => { root.unmount(); container.remove(); } };
}

/** Uses the actual plan component, including drawings/overlays, without touching its live instance. */
export async function capturePresetPlan(camera: VenueCamera): Promise<HTMLCanvasElement> {
  const host = detachedRoot();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const capture = await new Promise<() => HTMLCanvasElement | null>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('The floor plan did not finish loading.')), 30000);
      host.root.render(<Venue2D exportCamera={camera} onExportReady={resolve} />);
    });
    const canvas = capture();
    if (!canvas) throw new Error('The floor plan could not be captured.');
    return canvas;
  } finally {
    clearTimeout(timer);
    host.dispose();
  }
}

/** The live store, selection, layout, view preferences and framing are read-only throughout. */
export async function exportSelectedPresets(jobs: CameraExportJob[], units: Units, progress: (current: number, total: number) => void) {
  const state = useStore.getState();
  const timestamp = new Date().toLocaleString('en-US');
  const host = detachedRoot();
  try {
    return await collectPresetArtifacts(jobs, async (job, camera) => {
      const data = presetSheetData(camera, state.venue, state, units);
      host.root.render(<KameraBildHost exportOnly cameraOverride={camera} />);
      const plan = await capturePresetPlan(camera);
      const frame = document.createElement('canvas');
      const deadline = Date.now() + 30000;
      while (!renderPreset3D(camera, frame)) {
        if (Date.now() > deadline) throw new Error('The rendered camera scene did not finish loading.');
        await pause(100);
      }
      const cameraNumber = state.cameras.findIndex(c => c.id === camera.id) + 1;
      const out = drawPresetSheet({
        camera, cameraNumber,
        presetLabel: job.displayLabel ?? '', titleOverride: job.titleOverride, venue: state.venue, projectVersion: state.projectVersion,
        timestamp, units, frame, plan, data,
      });
      const blob = await new Promise<Blob | null>(resolve => out.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG encoding failed.');
      return {
        filename: `Camera_${String(cameraNumber).padStart(2, '0')}_${safeFilePart(camera.label)}_${safeFilePart(job.variantLabel ?? 'preset')}_${safeFilePart(state.venue.name)}_v${state.projectVersion}.png`,
        blob,
      };
    }, progress);
  } finally { host.dispose(); }
}
