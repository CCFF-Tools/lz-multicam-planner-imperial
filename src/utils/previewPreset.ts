// Preview-Presets (#47) — gespeicherte Kamera-Posen zum Anfahren.
//
// Presets lagen bisher in einem globalen Topf: jedes Preset erschien bei jeder
// Kamera und fuhr die gerade aktive dorthin. Gedacht sind sie aber pro
// Kamera — eine Weitwinkel-Position von CAM 1 hat auf CAM 4 nichts zu suchen.
//
// `cameraId` ordnet ein Preset zu. Alt gespeicherte Presets haben das Feld
// nicht; sie werden NICHT weggeworfen (das waeren Nutzerdaten), sondern als
// "allgemein" gefuehrt und lassen sich per Klick einer Kamera zuordnen.
// Genauso behandelt werden Presets, deren Kamera es nicht mehr gibt — nach dem
// Laden eines anderen Projekts haben alle Kameras neue Ids, und ein stilles
// Loeschen wuerde die Sammlung des Nutzers vernichten.
//
// Reines Modul: kein Store, kein DOM.

import type { Shot, VenueCamera } from '../types';

export interface PreviewPreset {
  id: string;
  name: string;
  /** Kamera, zu der das Preset gehoert. Fehlt bei Altbestand. */
  cameraId?: string;
  focalLength: number;
  aperture: number;
  focusDistance: number;
  pan?: number;
  tilt?: number;
  /** Hoehe in Metern. */
  z?: number;
  /** Fahrweg (Dolly/Jib) in Metern. */
  trackOffset?: number;
  x?: number;
  y?: number;
  /** Project shot that supplied this transient recall item. */
  sourceShotId?: string;
}

/**
 * Adapts captured shots for the existing Preview recall control. The result is
 * transient: the shot list remains the only persisted source of truth.
 */
export function previewPresetsFromShots(shots: readonly Shot[], cameraId: string): PreviewPreset[] {
  return shots
    .filter((shot) => shot.cameraId === cameraId)
    .map((shot) => ({
      id: shot.id,
      sourceShotId: shot.id,
      name: shot.name,
      cameraId: shot.cameraId,
      focalLength: shot.state.focalLength,
      aperture: shot.state.aperture,
      focusDistance: shot.state.focusDistance,
      pan: shot.state.pan,
      tilt: shot.state.tilt,
      z: shot.state.z,
      trackOffset: shot.state.trackOffset,
      x: shot.state.x,
      y: shot.state.y,
    }));
}

export interface PresetGroups {
  /** Presets dieser Kamera. */
  own: PreviewPreset[];
  /**
   * Presets ohne Zuordnung — Altbestand oder Kamera geloescht. Sie bleiben
   * sichtbar und anwendbar, damit nichts verloren geht.
   */
  unassigned: PreviewPreset[];
}

/**
 * Teilt die Sammlung fuer die Anzeige auf. Presets ANDERER, noch existierender
 * Kameras tauchen bewusst nicht auf — genau das war der Fehler.
 */
export function groupPresets(
  presets: PreviewPreset[],
  cameraId: string | null | undefined,
  existingCameraIds: Iterable<string>,
): PresetGroups {
  const known = new Set(existingCameraIds);
  const own: PreviewPreset[] = [];
  const unassigned: PreviewPreset[] = [];
  for (const p of presets) {
    if (cameraId && p.cameraId === cameraId) own.push(p);
    else if (!p.cameraId || !known.has(p.cameraId)) unassigned.push(p);
  }
  return { own, unassigned };
}

/** Ordnet ein Preset einer Kamera zu (oder um). */
export function assignPreset(
  presets: PreviewPreset[],
  presetId: string,
  cameraId: string,
): PreviewPreset[] {
  return presets.map((p) => (p.id === presetId ? { ...p, cameraId } : p));
}

/** Kopiert ein Preset auf eine andere Kamera — das Original bleibt bestehen. */
export function copyPresetToCamera(
  presets: PreviewPreset[],
  presetId: string,
  cameraId: string,
  newId: string,
  nameSuffix = '',
): PreviewPreset[] {
  const src = presets.find((p) => p.id === presetId);
  if (!src) return presets;
  return [...presets, { ...src, id: newId, cameraId, name: `${src.name}${nameSuffix}` }];
}

/** true, wenn das Preset auch die Position im Raum enthaelt (nicht nur Optik). */
export function hasPose(p: PreviewPreset): boolean {
  return p.pan !== undefined || p.x !== undefined || p.z !== undefined;
}

const close = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) <= tolerance;
const closeAngle = (a: number, b: number, tolerance = 0.05): boolean => {
  const delta = ((((a - b) % 360) + 540) % 360) - 180;
  return Math.abs(delta) <= tolerance;
};

/**
 * Finds the preset represented by the camera's current pose and optics.
 * Optional pose fields only participate when that preset actually stores them.
 */
export function matchingPreset(presets: PreviewPreset[], camera: Pick<VenueCamera, 'focalLength' | 'aperture' | 'focusDistance' | 'pan' | 'tilt' | 'z' | 'trackOffset' | 'x' | 'y'>): PreviewPreset | undefined {
  return presets.find((p) => (
    close(p.focalLength, camera.focalLength, 0.01)
    && close(p.aperture, camera.aperture, 0.001)
    && close(p.focusDistance, camera.focusDistance, 0.01)
    && (p.pan === undefined || closeAngle(p.pan, camera.pan))
    && (p.tilt === undefined || closeAngle(p.tilt, camera.tilt))
    && (p.z === undefined || close(p.z, camera.z, 0.005))
    && (p.trackOffset === undefined || close(p.trackOffset, camera.trackOffset ?? 0, 0.005))
    && (p.x === undefined || close(p.x, camera.x, 0.005))
    && (p.y === undefined || close(p.y, camera.y, 0.005))
  ));
}

/** From Custom, next starts at the first preset and previous at the last. */
export function adjacentPreset(presets: PreviewPreset[], currentId: string | undefined, direction: -1 | 1): PreviewPreset | undefined {
  if (presets.length === 0) return undefined;
  const current = currentId ? presets.findIndex((p) => p.id === currentId) : -1;
  if (current < 0) return direction > 0 ? presets[0] : presets[presets.length - 1];
  return presets[(current + direction + presets.length) % presets.length];
}
