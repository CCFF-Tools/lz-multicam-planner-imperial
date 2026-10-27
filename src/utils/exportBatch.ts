import type { Lens, VenueCamera } from '../types';

export interface CameraExportJob {
  cam: VenueCamera;
  focalOverride?: number;
  variantLabel?: string;
}

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
