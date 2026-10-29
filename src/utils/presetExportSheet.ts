import type { Camera, Lens, Venue, VenueCamera } from '../types';
import type { Units } from './units';
import { formatLengthWithUnit } from './units';
import { kameraBildwinkel } from './bildwinkel';
import { computeDof } from './fov';
import { effectiveCameraPos } from './camera';
import { resolveFixedMountLocation } from './fixedMount';
import { mountTypeLabel } from '../i18n/mount';

export interface ExportRect { x: number; y: number; width: number; height: number }

/** Identical panel geometry for every preset, independent of room shape. */
export function selectedPresetSheetLayout() {
  const dataWidths = [710, 650, 630, 462];
  let x = 24;
  return {
    width: 2560, height: 1440, headerHeight: 116,
    cameraView: { x: 24, y: 136, width: 1620, height: 956 },
    plan2D: { x: 1664, y: 136, width: 872, height: 956 },
    sections: dataWidths.map(width => {
      const rect = { x, y: 1112, width, height: 304 };
      x += width + 20;
      return rect;
    }),
  };
}

/** Contain the entire image; never stretch or crop camera framing or room geometry. */
export function containExportImage(width: number, height: number, rect: ExportRect): ExportRect {
  const scale = Math.min(rect.width / width, rect.height / height);
  const w = width * scale, h = height * scale;
  return { x: rect.x + (rect.width - w) / 2, y: rect.y + (rect.height - h) / 2, width: w, height: h };
}

/** The room, not its background bitmap or wall bounding box, defines the datum. */
export function bottomLeftCameraPosition(cam: VenueCamera, roomDepthM: number) {
  const pos = effectiveCameraPos(cam);
  return { x: pos.x, y: roomDepthM - pos.y };
}

export interface PresetSheetSection { title: string; rows: Array<[string, string]> }

export function presetSheetData(cam: VenueCamera, venue: Venue, catalog: { customCameras: Camera[]; customLenses: Lens[] }, units: Units) {
  const optics = kameraBildwinkel(cam, catalog);
  if (!optics) throw new Error(`Missing camera or lens: ${cam.label}`);
  const { camDef, lensDef, sensor, fov, hDeg, vDeg } = optics;
  const dof = computeDof(sensor, cam.focalLength, cam.aperture, cam.focusDistance, cam.extenderActive);
  const length = (m: number) => Number.isFinite(m) ? formatLengthWithUnit(m, units) : '∞';
  const position = bottomLeftCameraPosition(cam, venue.heightM);
  const mount = cam.mountType ?? 'tripod';
  const fixed = resolveFixedMountLocation(cam, camDef.type === 'ptz', venue.ceilingHeightM);
  const sections: PresetSheetSection[] = [
    { title: 'Camera & Optics', rows: [
      ['Camera model', `${camDef.manufacturer} ${camDef.model}`],
      ['Lens model', `${lensDef.manufacturer} ${lensDef.model}`],
      ['Sensor size', `${sensor.widthMm} × ${sensor.heightMm} mm`],
      ['Focal length', `${cam.focalLength.toFixed(1)} mm${cam.extenderActive > 1 ? ` × ${cam.extenderActive}` : ''}`],
      ['Aperture', `f/${cam.aperture}`],
    ] },
    { title: 'Camera Position', rows: [
      ['Lens elevation', length(cam.z)], ['Pan', `${cam.pan.toFixed(1)}°`], ['Tilt', `${cam.tilt.toFixed(1)}°`],
      ['Camera position (X/Y)', `${length(position.x)} / ${length(position.y)}`],
      ['Mount', mount === 'fixed' ? `Fixed · ${fixed === 'wall' ? 'Wall' : 'Ceiling'}` : mountTypeLabel((_k, en) => en, mount)],
    ] },
    { title: 'Field of View', rows: [
      ['Horizontal field of view', `${hDeg.toFixed(2)}°`],
      ['Vertical field of view', `${vDeg.toFixed(2)}°`],
      ['Image width at focal plane', length(fov.imageWidthAtDistance)],
      // The viewport is 16:9, including when the camera has a 4:3/3:2 sensor.
      ['Image height at focal plane', length(fov.imageWidthAtDistance * 9 / 16)],
    ] },
    { title: 'Depth of Field', rows: [
      ['Near focus', length(dof.nearLimit)], ['Far focus', length(dof.farLimit)], ['Hyperfocal distance', length(dof.hyperfocal)],
    ] },
  ];
  return { sections, focusDistance: length(cam.focusDistance), cameraModel: `${camDef.manufacturer} ${camDef.model}` };
}
