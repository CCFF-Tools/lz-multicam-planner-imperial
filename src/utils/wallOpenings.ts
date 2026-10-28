// Eine Wand mit Tür- und Fensteröffnungen als Quader (#205).
//
// WARUM STÜCKE UND KEIN LOCH. Three.js kann ein Loch nur über CSG oder eine
// Extrusion mit Innenring — beides zieht eine Abhängigkeit oder baut die
// Geometrie bei jeder Änderung neu. Eine Wand mit Öffnungen ist aber nur die
// Summe weniger Quader: links daneben, rechts daneben, Brüstung darunter,
// Sturz darüber. Das sind dieselben Box-Geometrien, die die 3D-Ansicht
// ohnehin zeichnet, und es bleibt richtig, wenn jemand die Wandhöhe ändert.
import type { VenueWallOpening } from '../avplan/floorplan';
import type { Wall } from '../types';
import { wallPathSegments } from './wallPath';

export interface WandStueck {
  /** Mitte des Quaders in Plan-Metern. */
  x: number;
  y: number;
  /** Unterkante über dem Boden und Höhe. */
  unten: number;
  hoehe: number;
  /** Länge entlang der Wand. */
  laenge: number;
  /** Winkel der Wand (Radiant, mathematisch). */
  winkel: number;
}

export const WAND_DICKE_M = 0.15;

export type DoorSwing = NonNullable<VenueWallOpening['doorSwing']>;
export type DoorHardware = NonNullable<VenueWallOpening['doorHardware']>;

export interface DoorPlanSymbol {
  hinge: { x: number; y: number };
  closedLatch: { x: number; y: number };
  openLatch: { x: number; y: number };
  arc: { x: number; y: number }[];
}

export interface DoorHardwarePlacement {
  x: number;
  y: number;
  angle: number;
  height: number;
}

export const resolvedDoorSwing = (opening: VenueWallOpening): DoorSwing => opening.doorSwing ?? 'left-in';

export const resolvedDoorHardware = (opening: VenueWallOpening): DoorHardware =>
  opening.doorHardware ?? (opening.material === 'glass' ? 'pull' : 'lever');

/** Wandstärke dieser Wand; ohne Angabe die bisherige Vorgabe. */
export const wandDicke = (w: Pick<Wall, 'thicknessM'>): number =>
  typeof w.thicknessM === 'number' && w.thicknessM > 0.01 ? w.thicknessM : WAND_DICKE_M;

function stueckeImIntervall(
  w: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2' | 'cx' | 'cy'>,
  von: number,
  bis: number,
  unten: number,
  hoch: number,
): WandStueck[] {
  const out: WandStueck[] = [];
  for (const segment of wallPathSegments(w)) {
    const start = Math.max(von, segment.fromM);
    const end = Math.min(bis, segment.toM);
    if (end - start < 1e-6) continue;
    const t0 = (start - segment.fromM) / segment.lengthM;
    const t1 = (end - segment.fromM) / segment.lengthM;
    const ax = segment.a.x + (segment.b.x - segment.a.x) * t0;
    const ay = segment.a.y + (segment.b.y - segment.a.y) * t0;
    const bx = segment.a.x + (segment.b.x - segment.a.x) * t1;
    const by = segment.a.y + (segment.b.y - segment.a.y) * t1;
    out.push({
      x: (ax + bx) / 2,
      y: (ay + by) / 2,
      unten,
      hoehe: hoch,
      laenge: Math.hypot(bx - ax, by - ay),
      winkel: Math.atan2(by - ay, bx - ax),
    });
  }
  return out;
}

/** The centre-line pieces occupied by one opening, including curved walls. */
export function wandOeffnungStuecke(
  w: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2' | 'cx' | 'cy'>,
  opening: VenueWallOpening,
): WandStueck[] {
  const path = wallPathSegments(w);
  const length = path.length > 0 ? path[path.length - 1].toM : 0;
  const from = Math.max(0, Math.min(length, opening.offset));
  const to = Math.max(from, Math.min(length, opening.offset + opening.width));
  const bottom = Math.max(0, opening.bottom);
  const height = Math.max(0, opening.top - bottom);
  if (to - from < 1e-6 || height < 1e-6) return [];
  return stueckeImIntervall(w, from, to, bottom, height);
}

/** Architectural 90-degree swing symbol for a door in plan view. */
export function doorPlanSymbol(
  w: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2' | 'cx' | 'cy'>,
  opening: VenueWallOpening,
): DoorPlanSymbol | null {
  const pieces = wandOeffnungStuecke(w, opening);
  if (pieces.length === 0) return null;
  const first = pieces[0];
  const last = pieces[pieces.length - 1];
  const start = {
    x: first.x - Math.cos(first.winkel) * first.laenge / 2,
    y: first.y - Math.sin(first.winkel) * first.laenge / 2,
  };
  const end = {
    x: last.x + Math.cos(last.winkel) * last.laenge / 2,
    y: last.y + Math.sin(last.winkel) * last.laenge / 2,
  };
  const swing = resolvedDoorSwing(opening);
  const leftHinge = swing.startsWith('left');
  const inward = swing.endsWith('in');
  const hinge = leftHinge ? start : end;
  const closedLatch = leftHinge ? end : start;
  const closedAngle = Math.atan2(closedLatch.y - hinge.y, closedLatch.x - hinge.x);
  // The wall path's left side is "in". Reversing the closed vector for a
  // right hinge also reverses the signed quarter turn needed to reach it.
  const direction = (leftHinge === inward) ? 1 : -1;
  const radius = Math.hypot(closedLatch.x - hinge.x, closedLatch.y - hinge.y);
  const steps = 12;
  const arc = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = closedAngle + direction * Math.PI / 2 * index / steps;
    return { x: hinge.x + Math.cos(angle) * radius, y: hinge.y + Math.sin(angle) * radius };
  });
  return { hinge, closedLatch, openLatch: arc[arc.length - 1], arc };
}

/** Latch-side placement shared by all 3D door hardware styles. */
export function doorHardwarePlacement(
  w: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2' | 'cx' | 'cy'>,
  opening: VenueWallOpening,
): DoorHardwarePlacement | null {
  const pieces = wandOeffnungStuecke(w, opening);
  if (pieces.length === 0) return null;
  const leftHinge = resolvedDoorSwing(opening).startsWith('left');
  const piece = leftHinge ? pieces[pieces.length - 1] : pieces[0];
  const endpointSign = leftHinge ? 1 : -1;
  const inset = Math.min(0.14, piece.laenge * 0.25);
  return {
    x: piece.x + Math.cos(piece.winkel) * (endpointSign * (piece.laenge / 2 - inset)),
    y: piece.y + Math.sin(piece.winkel) * (endpointSign * (piece.laenge / 2 - inset)),
    angle: piece.winkel,
    height: opening.bottom + Math.min(1, Math.max(0.55, (opening.top - opening.bottom) * 0.48)),
  };
}

/** Vertical reveal faces at the left and right edges of valid openings. */
export function wandOeffnungsLaibungen(w: Wall, hoeheM: number): WandStueck[] {
  return (w.openings ?? []).flatMap((opening) => {
    const bottom = Math.max(0, Math.min(hoeheM, opening.bottom));
    const top = Math.max(0, Math.min(hoeheM, opening.top));
    const pieces = wandOeffnungStuecke(w, { ...opening, bottom, top });
    if (pieces.length === 0) return [];
    const first = pieces[0];
    const last = pieces[pieces.length - 1];
    return [
      {
        x: first.x - Math.cos(first.winkel) * first.laenge / 2,
        y: first.y - Math.sin(first.winkel) * first.laenge / 2,
        unten: bottom,
        hoehe: top - bottom,
        laenge: 0,
        winkel: first.winkel,
      },
      {
        x: last.x + Math.cos(last.winkel) * last.laenge / 2,
        y: last.y + Math.sin(last.winkel) * last.laenge / 2,
        unten: bottom,
        hoehe: top - bottom,
        laenge: 0,
        winkel: last.winkel,
      },
    ];
  });
}

/**
 * Die Quader einer Wand. Ohne Öffnungen ist es genau einer — dieselbe Lage
 * wie bisher, damit sich an bestehenden Projekten nichts verschiebt.
 */
export function wandStuecke(w: Wall, hoeheM: number): WandStueck[] {
  const pfad = wallPathSegments(w);
  const laenge = pfad.length > 0 ? pfad[pfad.length - 1].toM : 0;
  if (laenge < 1e-6) return [];
  const oeffnungen = (w.openings ?? [])
    .map((o) => ({
      von: Math.max(0, Math.min(laenge, o.offset)),
      bis: Math.max(0, Math.min(laenge, o.offset + o.width)),
      unten: Math.max(0, Math.min(hoeheM, o.bottom)),
      oben: Math.max(0, Math.min(hoeheM, o.top)),
    }))
    .filter((o) => o.bis - o.von > 0.01 && o.oben - o.unten > 0.01)
    .sort((a, b) => a.von - b.von || a.unten - b.unten);
  if (!oeffnungen.length) return stueckeImIntervall(w, 0, laenge, 0, hoeheM);

  // Split the wall into horizontal slabs at every opening edge, then subtract
  // the union of all vertical opening ranges in each slab. The earlier
  // left-to-right cursor only worked when opening spans never overlapped. A
  // transom above a door/window could therefore put a second wall slab back
  // through the lower pane and change its apparent glass opacity.
  const stuecke: WandStueck[] = [];
  const kanten = [...new Set([0, laenge, ...oeffnungen.flatMap((o) => [o.von, o.bis])])].sort((a, b) => a - b);
  for (let index = 1; index < kanten.length; index += 1) {
    const von = kanten[index - 1];
    const bis = kanten[index];
    if (bis - von < 1e-6) continue;
    const mitte = (von + bis) / 2;
    const vertikal = oeffnungen
      .filter((o) => o.von < mitte && o.bis > mitte)
      .map((o) => ({ unten: o.unten, oben: o.oben }))
      .sort((a, b) => a.unten - b.unten || a.oben - b.oben);
    let unten = 0;
    for (const frei of vertikal) {
      if (frei.unten > unten + 0.01) {
        stuecke.push(...stueckeImIntervall(w, von, bis, unten, frei.unten - unten));
      }
      unten = Math.max(unten, frei.oben);
    }
    if (hoeheM - unten > 0.01) {
      stuecke.push(...stueckeImIntervall(w, von, bis, unten, hoeheM - unten));
    }
  }
  return stuecke;
}
