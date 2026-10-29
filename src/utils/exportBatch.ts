import type { Lens, VenueCamera } from '../types';

export interface CameraExportJob {
  cam: VenueCamera;
  focalOverride?: number;
  variantLabel?: string;
  displayLabel?: string;
  cameraOverride?: Partial<VenueCamera>;
}

export const presetExportKey = (cameraId: string, presetNumber: number): string => JSON.stringify([cameraId, presetNumber]);

/** Builds a deterministic queue while retaining invalid cameras for error reporting. */
export function cameraExportJobs(
  cameras: VenueCamera[],
  wideTele: boolean,
  lensFor: (camera: VenueCamera) => Pick<Lens, 'focalLengthMin' | 'focalLengthMax'> | undefined,
): CameraExportJob[] {
  const jobs: CameraExportJob[] = [];
  for (const cam of cameras) {
    if (!wideTele) {
      jobs.push({ cam });
      continue;
    }
    const lens = lensFor(cam);
    if (!lens) {
      jobs.push({ cam });
    } else if (lens.focalLengthMin === lens.focalLengthMax) {
      jobs.push({ cam, focalOverride: lens.focalLengthMin, variantLabel: `${lens.focalLengthMin}mm` });
    } else {
      jobs.push({ cam, focalOverride: lens.focalLengthMin, variantLabel: `wide_${lens.focalLengthMin}mm` });
      jobs.push({ cam, focalOverride: lens.focalLengthMax, variantLabel: `tele_${lens.focalLengthMax}mm` });
    }
  }
  return jobs;
}

/** Builds jobs only for the explicitly selected, project-persisted PTZ presets. */
export function presetExportJobs(cameras: VenueCamera[], selected: ReadonlySet<string>): CameraExportJob[] {
  const jobs: CameraExportJob[] = [];
  for (const cam of cameras) {
    for (const preset of [...(cam.presets ?? [])].sort((a, b) => a.number - b.number)) {
      if (!selected.has(presetExportKey(cam.id, preset.number))) continue;
      jobs.push({
        cam,
        variantLabel: `preset_${preset.number}_${preset.name}`,
        displayLabel: `Preset #${preset.number} — ${preset.name}`,
        cameraOverride: {
          pan: preset.pan,
          tilt: preset.tilt,
          focalLength: preset.focalLength,
          focusDistance: preset.focusDistance,
          ...(preset.aperture !== undefined ? { aperture: preset.aperture } : {}),
          ...(preset.trackOffset !== undefined ? { trackOffset: preset.trackOffset } : {}),
          ...(preset.savedAtPosition ? {
            x: preset.savedAtPosition.x,
            y: preset.savedAtPosition.y,
            z: preset.savedAtPosition.z,
          } : {}),
          lockedPersonId: undefined,
        },
      });
    }
  }
  return jobs;
}

/** Pure queue orchestration: every output receives its own recalled camera value. */
export async function collectPresetArtifacts<T>(jobs: CameraExportJob[], render: (job: CameraExportJob, camera: VenueCamera) => Promise<T>, progress: (current: number, total: number) => void) {
  const artifacts: T[] = [], failures: string[] = [];
  for (let i = 0; i < jobs.length; i++) {
    progress(i + 1, jobs.length);
    const job = jobs[i];
    const camera = { ...job.cam, ...job.cameraOverride, focalLength: job.focalOverride ?? job.cameraOverride?.focalLength ?? job.cam.focalLength };
    try { artifacts.push(await render(job, camera)); }
    catch (error) { failures.push(`${camera.label} · ${job.displayLabel ?? 'Preset'}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { artifacts, failures };
}
