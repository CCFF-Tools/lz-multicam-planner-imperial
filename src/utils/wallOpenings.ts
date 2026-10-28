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
    .sort((a, b) => a.von - b.von);
  if (!oeffnungen.length) return stueckeImIntervall(w, 0, laenge, 0, hoeheM);

  const stuecke: WandStueck[] = [];
  let x = 0;
  for (const o of oeffnungen) {
    if (o.von > x + 0.01) stuecke.push(...stueckeImIntervall(w, x, o.von, 0, hoeheM));
    if (o.unten > 0.01) stuecke.push(...stueckeImIntervall(w, o.von, o.bis, 0, o.unten));
    if (hoeheM - o.oben > 0.01) stuecke.push(...stueckeImIntervall(w, o.von, o.bis, o.oben, hoeheM - o.oben));
    x = Math.max(x, o.bis);
  }
  if (laenge - x > 0.01) stuecke.push(...stueckeImIntervall(w, x, laenge, 0, hoeheM));
  return stuecke;
}
