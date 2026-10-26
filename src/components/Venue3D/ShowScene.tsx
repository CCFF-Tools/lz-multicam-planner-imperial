// ───────────────────────────────────────────────────────────────────────────
// Kulisse der 3D-Ansicht: Render-Pipeline, Halle, Publikum, Showlicht,
// LED-Waende, Abdeckungskeile.
//
// Alles hier ist Bild, nicht Planung — Vorschau und Sichtlinien rechnen
// nicht damit. Die Bausteine kommen aus `@avplan/scene3d` (Kopie unter
// src/avplan/scene3d); hier steht nur, was MultiCam daraus zusammensetzt.
// Teuer ist nur, was die Qualitaetsstufe erlaubt: echte Scheinwerfer und
// Schatten nach `StufenWerte`, das Publikum als Instanzen.
// ───────────────────────────────────────────────────────────────────────────
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PLANUNGS_BODEN } from './planungsLook';
import { wendeLookAn, type RenderLook } from '../Render3D/renderLook';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { CeilingMaterial, CeilingZone, Stage, Venue, VenueCamera } from '../../types';
import { stageTopZ } from '../../utils/stageBody';
import { coverageWedge } from '../../utils/view3dScene';
import { publikumsBild } from '../../utils/raum';
import { showLichtAus, showRig } from '../../utils/showRig';
import { videowandNormal, type RaumBoden, type RaumWand, type VenueVideoWall } from '../../avplan/floorplan';
import { DEFAULT_CEILING_MATERIAL, normaliseCeilingZone } from '../../utils/ceiling';
import {
  HINTERGRUENDE,
  SZENEN_ZEIT,
  SzenenPipeline,
  entsorge,
  erzeugeKuppel,
  erzeugeLedLicht,
  erzeugeLedWand,
  erzeugePublikum,
  erzeugeScheinwerfer,
  erzeugeSitze,
  erzeugeTraverse,
  erzeugeTribuene,
  erzeugeUmgebungslicht,
  oberflaechenMaterial,
  wendeHintergrundAn,
  type HintergrundArt,
  type Hintergrund,
  type Qualitaet,
  type Stufe,
  type StufenWerte,
  type Tiefenschaerfe,
} from '../../avplan/scene3d';

/** Gibt ein selbst gebautes Three-Objekt frei, sobald es ersetzt wird. */
function useEntsorgen(obj: THREE.Object3D | null): void {
  useEffect(() => () => { if (obj) entsorge(obj); }, [obj]);
}

/* ── Pipeline: rendert statt react-three-fiber (useFrame mit Prioritaet 1) ── */
export function ScenePipeline({ quality, look, dof, onWerte }: {
  quality: Qualitaet;
  /** Derselbe Look wie im gerenderten Kamerabild (Render3D/renderLook). */
  look: RenderLook;
  dof: Tiefenschaerfe | null;
  onWerte: (w: StufenWerte, stufe: Stufe) => void;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const ref = useRef<SzenenPipeline | null>(null);
  const onWerteRef = useRef(onWerte);
  useEffect(() => { onWerteRef.current = onWerte; }, [onWerte]);
  const lookRef = useRef(look);
  useEffect(() => { lookRef.current = look; }, [look]);

  useEffect(() => {
    const p = new SzenenPipeline(gl, scene, camera, { qualitaet: quality, stufeGeaendert: (st, w) => onWerteRef.current(w, st) });
    wendeLookAn(p, lookRef.current);
    ref.current = p;
    onWerteRef.current(p.werte, p.stufe);
    return () => { p.dispose(); ref.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene]);
  useEffect(() => { ref.current?.setKamera(camera); }, [camera]);
  useEffect(() => { ref.current?.setGroesse(size.width, size.height); }, [size.width, size.height]);
  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    p.setQualitaet(quality);
    onWerteRef.current(p.werte, p.stufe);
  }, [quality]);
  useEffect(() => { ref.current?.setTiefenschaerfe(dof); }, [dof]);
  useEffect(() => {
    if (ref.current) wendeLookAn(ref.current, look);
  }, [look]);
  useFrame((state, dt) => {
    SZENEN_ZEIT.value = state.clock.elapsedTime;
    ref.current?.render(dt);
  }, 1);
  return null;
}

/* ── Umgebungslicht, Kuppel, Nebel ── */
export function Atmosphere({ look, diagM, domeRadius, hintergrund }: { look: HintergrundArt; diagM: number; domeRadius: number; hintergrund?: Hintergrund }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const kuppel = useMemo(() => erzeugeKuppel(domeRadius), [domeRadius]) as THREE.Mesh;
  useEntsorgen(kuppel);
  useEffect(() => {
    const u = erzeugeUmgebungslicht(gl);
    scene.environment = u.textur;
    return () => { scene.environment = null; u.dispose(); };
  }, [gl, scene]);
  useEffect(() => {
    wendeHintergrundAn(scene, kuppel, hintergrund ?? HINTERGRUENDE[look], diagM);
    return () => { scene.fog = null; };
  }, [scene, kuppel, look, diagM, hintergrund]);
  useFrame(() => { kuppel.position.copy(camera.position); });
  return <primitive object={kuppel} />;
}

/* ── Halle: Boden, Waende, Decke ── */
function ceilingSurfaceMaterial(material: CeilingMaterial, widthM: number, depthM: number): THREE.MeshStandardMaterial {
  if (typeof document === 'undefined') {
    return new THREE.MeshStandardMaterial({ color: material === 'drop-tile' ? '#d9d8d1' : '#ece9e2', roughness: 0.95, side: THREE.FrontSide });
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.MeshStandardMaterial({ color: '#e8e5de', roughness: 0.95, side: THREE.FrontSide });
  if (material === 'drop-tile') {
    ctx.fillStyle = '#d9d8d1';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#8b8b86';
    ctx.lineWidth = 4;
    ctx.strokeRect(1, 1, 126, 126);
    ctx.strokeStyle = '#eeeeea';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 118, 118);
  } else {
    ctx.fillStyle = '#ece9e2';
    ctx.fillRect(0, 0, 128, 128);
    // Deterministic fine speckle gives drywall enough texture for focus checks.
    for (let i = 0; i < 260; i += 1) {
      const x = (i * 47) % 128;
      const y = (i * 83) % 128;
      ctx.fillStyle = i % 3 === 0 ? '#d8d4cc55' : '#ffffff44';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const moduleM = material === 'drop-tile' ? 0.6 : 1.5;
  texture.repeat.set(Math.max(1, widthM / moduleM), Math.max(1, depthM / moduleM));
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, color: '#ffffff', roughness: 0.96, side: THREE.FrontSide });
}

function clippedCeilingZones(zones: CeilingZone[], widthM: number, depthM: number): CeilingZone[] {
  return zones.map(normaliseCeilingZone).map((zone) => {
    const left = Math.max(0, zone.x - zone.widthM / 2);
    const right = Math.min(widthM, zone.x + zone.widthM / 2);
    const top = Math.max(0, zone.y - zone.depthM / 2);
    const bottom = Math.min(depthM, zone.y + zone.depthM / 2);
    return { ...zone, x: (left + right) / 2, y: (top + bottom) / 2, widthM: Math.max(0, right - left), depthM: Math.max(0, bottom - top) };
  }).filter((zone) => zone.widthM > 0.01 && zone.depthM > 0.01);
}

function ceilingGroup(widthM: number, depthM: number, baseHeightM: number | undefined, baseMaterial: CeilingMaterial, rawZones: CeilingZone[]): THREE.Group {
  const group = new THREE.Group();
  const zones = clippedCeilingZones(rawZones, widthM, depthM);
  if (baseHeightM !== undefined) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(widthM, 0);
    shape.lineTo(widthM, depthM);
    shape.lineTo(0, depthM);
    shape.closePath();
    for (const zone of zones) {
      const left = zone.x - zone.widthM / 2;
      const right = zone.x + zone.widthM / 2;
      const top = zone.y - zone.depthM / 2;
      const bottom = zone.y + zone.depthM / 2;
      const hole = new THREE.Path();
      hole.moveTo(left, top);
      hole.lineTo(left, bottom);
      hole.lineTo(right, bottom);
      hole.lineTo(right, top);
      hole.closePath();
      shape.holes.push(hole);
    }
    const base = new THREE.Mesh(new THREE.ShapeGeometry(shape), ceilingSurfaceMaterial(baseMaterial, widthM, depthM));
    base.rotation.x = Math.PI / 2;
    base.position.y = baseHeightM;
    base.receiveShadow = true;
    group.add(base);
  }
  for (const zone of zones) {
    const material = ceilingSurfaceMaterial(zone.material, zone.widthM, zone.depthM);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(zone.widthM, zone.depthM), material);
    plane.rotation.x = Math.PI / 2;
    plane.position.set(zone.x, zone.heightM, zone.y);
    plane.receiveShadow = true;
    group.add(plane);
    if (baseHeightM !== undefined && Math.abs(baseHeightM - zone.heightM) > 0.01) {
      const vertical = Math.abs(baseHeightM - zone.heightM);
      const mid = (baseHeightM + zone.heightM) / 2;
      const fasciaMaterial = new THREE.MeshStandardMaterial({ color: zone.material === 'drop-tile' ? '#b5b4ae' : '#ddd9d1', roughness: 0.95 });
      const sides: [number, number, number, number][] = [
        [zone.x, zone.y - zone.depthM / 2, zone.widthM, 0],
        [zone.x, zone.y + zone.depthM / 2, zone.widthM, 0],
        [zone.x - zone.widthM / 2, zone.y, zone.depthM, Math.PI / 2],
        [zone.x + zone.widthM / 2, zone.y, zone.depthM, Math.PI / 2],
      ];
      for (const [x, z, length, rotationY] of sides) {
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(length, vertical, 0.012), fasciaMaterial);
        fascia.position.set(x, mid, z);
        fascia.rotation.y = rotationY;
        group.add(fascia);
      }
    }
  }
  return group;
}

export function Arena({ venue, show, offen = false, planungsBoden = PLANUNGS_BODEN.dunkel, showCeiling = show }: { venue: Venue; show: boolean; offen?: boolean; planungsBoden?: string; showCeiling?: boolean }) {
  // Gewaehlte Boden- und Wandoberflaechen gelten auch ohne Showlicht (#191);
  // ohne Wahl bleibt der Planungs-Look schlicht.
  const gewaehlt = venue.floorMaterial;
  const boden: RaumBoden = gewaehlt ?? 'concrete';
  const w = venue.widthM;
  const d = venue.heightM;
  // Unter freiem Himmel stehen keine Hallenwaende und keine Decke.
  const decke = offen ? undefined : venue.ceilingHeightM;
  const ceilingMaterial = venue.ceilingMaterial ?? DEFAULT_CEILING_MATERIAL;
  const ceilingZones = offen ? [] : venue.ceilingZones ?? [];
  const wandArt = venue.wallMaterial;
  const obj = useMemo(() => {
    const g = new THREE.Group();
    const flaeche = new THREE.Mesh(new THREE.PlaneGeometry(w, d), show || gewaehlt ? oberflaechenMaterial(boden, { breiteM: w, tiefeM: d }) : new THREE.MeshStandardMaterial({ color: planungsBoden, roughness: 1 }));
    flaeche.rotation.x = -Math.PI / 2;
    flaeche.position.set(w / 2, 0, d / 2);
    flaeche.receiveShadow = true;
    g.add(flaeche);
    if (show) {
      // Umgebung ausserhalb der Halle: dunkler Beton, der im Nebel auslaeuft.
      const aussen = new THREE.Mesh(new THREE.PlaneGeometry(w * 6 + 400, d * 6 + 400), oberflaechenMaterial('concrete', { breiteM: w * 6 + 400, tiefeM: d * 6 + 400, farbe: '#3a3a3a' }));
      aussen.rotation.x = -Math.PI / 2;
      aussen.position.set(w / 2, -0.02, d / 2);
      aussen.receiveShadow = true;
      g.add(aussen);
    }
    if ((show || wandArt) && decke) {
      // Innenseiten nach innen: von aussen (Draufsicht, Rundgang) bleiben
      // Waende und Decke durchsichtig, von innen sind sie da.
      // Ohne gewaehlte Wandoberflaeche (#171) bleibt die dunkle Halle.
      const schlicht = new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.92, side: THREE.FrontSide });
      const seiten: [number, number, number, number][] = [[w / 2, 0, w, 0], [w / 2, d, w, Math.PI], [0, d / 2, d, Math.PI / 2], [w, d / 2, d, -Math.PI / 2]];
      for (const [x, z, laenge, rot] of seiten) {
        const wand = wandArt ? oberflaechenMaterial(wandArt, { breiteM: laenge, tiefeM: decke }) : schlicht;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(laenge, decke), wand);
        m.position.set(x, decke / 2, z);
        m.rotation.y = rot;
        m.receiveShadow = true;
        g.add(m);
      }
    }
    // Camera renders always need a ceiling; the free planning view can keep
    // the overhead open so objects remain easy to edit from above.
    if (showCeiling && (decke !== undefined || ceilingZones.length > 0)) g.add(ceilingGroup(w, d, decke, ceilingMaterial, ceilingZones));
    return g;
  }, [w, d, boden, gewaehlt, decke, ceilingMaterial, ceilingZones, wandArt, show, showCeiling, planungsBoden]);
  useEntsorgen(obj);
  return obj ? <primitive object={obj} /> : null;
}

/* ── Gezeichnete Wand mit der Wandoberflaeche des Raums (#171) ──
   Putz ist gestrichen und nimmt die Farbe der Wand an; die anderen
   Oberflaechen haben ihre eigene. */
export function WallSurfaceMaterial({ art, laengeM, hoeheM, farbe }: { art: RaumWand; laengeM: number; hoeheM: number; farbe?: string }) {
  const mat = useMemo(
    () => oberflaechenMaterial(art, { breiteM: laengeM, tiefeM: hoeheM, farbe: art === 'plaster' ? farbe : undefined }),
    [art, laengeM, hoeheM, farbe],
  );
  useEffect(() => () => { mat.map?.dispose(); mat.roughnessMap?.dispose(); mat.dispose(); }, [mat]);
  return <primitive object={mat} attach="material" />;
}

/* ── Spielfeld mit Linien statt blauer Flaeche ── */
function feldTextur(breite: number, tiefe: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const px = 20;
  const c = document.createElement('canvas');
  c.width = Math.round(breite * px);
  c.height = Math.round(tiefe * px);
  const g = c.getContext('2d');
  if (!g) return null;
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(245,245,240,0.92)';
  g.lineWidth = 0.12 * px;
  const m = (v: number) => v * px;
  const lang = breite >= tiefe;
  const L = lang ? breite : tiefe;
  const B = lang ? tiefe : breite;
  g.save();
  if (!lang) { g.translate(c.width, 0); g.rotate(Math.PI / 2); }
  const rx = m(1);
  g.strokeRect(rx, rx, m(L - 2), m(B - 2));
  g.beginPath(); g.moveTo(m(L / 2), rx); g.lineTo(m(L / 2), m(B - 1)); g.stroke();
  g.beginPath(); g.arc(m(L / 2), m(B / 2), m(9.15), 0, Math.PI * 2); g.stroke();
  for (const seite of [0, 1]) {
    const x0 = seite ? m(L - 1 - 16.5) : rx;
    g.strokeRect(x0, m(B / 2 - 20.15), m(16.5), m(40.3));
    const x1 = seite ? m(L - 1 - 5.5) : rx;
    g.strokeRect(x1, m(B / 2 - 9.15), m(5.5), m(18.3));
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function FieldMesh({ stage }: { stage: Stage }) {
  const obj = useMemo(() => {
    const g = new THREE.Group();
    const rasen = new THREE.Mesh(new THREE.PlaneGeometry(stage.width, stage.height), oberflaechenMaterial('turf', { breiteM: stage.width, tiefeM: stage.height }));
    rasen.rotation.x = -Math.PI / 2;
    rasen.position.set(stage.x + stage.width / 2, 0.01, stage.y + stage.height / 2);
    rasen.receiveShadow = true;
    g.add(rasen);
    const tex = feldTextur(stage.width, stage.height);
    if (tex) {
      const linien = new THREE.Mesh(new THREE.PlaneGeometry(stage.width, stage.height), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      linien.rotation.x = -Math.PI / 2;
      linien.position.set(stage.x + stage.width / 2, 0.02, stage.y + stage.height / 2);
      linien.receiveShadow = true;
      g.add(linien);
    }
    return g;
  }, [stage.x, stage.y, stage.width, stage.height]);
  useEntsorgen(obj);
  return obj ? <primitive object={obj} /> : null;
}

/* ── Podest mit schwarzem Buehnenboden und Molton ── */
export function StageBodyReal({ stage }: { stage: Stage }) {
  const top = Math.max(0.05, stageTopZ(stage));
  const obj = useMemo(() => {
    const g = new THREE.Group();
    const deck = oberflaechenMaterial('stage', { breiteM: stage.width, tiefeM: stage.height });
    const molton = new THREE.MeshStandardMaterial({ color: '#0a0a0b', roughness: 1 });
    const koerper = new THREE.Mesh(new THREE.BoxGeometry(stage.width, top, stage.height), [molton, molton, deck, molton, molton, molton]);
    koerper.position.set(stage.x + stage.width / 2, top / 2, stage.y + stage.height / 2);
    koerper.castShadow = true;
    koerper.receiveShadow = true;
    g.add(koerper);
    return g;
  }, [stage.x, stage.y, stage.width, stage.height, top]);
  useEntsorgen(obj);
  return obj ? <primitive object={obj} /> : null;
}

/* ── Publikum, Sitze, Tribuenen ── */
export function CrowdAndSeating({ venue, cameras, persons, walls, max }: {
  venue: Venue;
  cameras: { x: number; y: number }[];
  persons: { x: number; y: number }[];
  walls: { x1: number; y1: number; x2: number; y2: number }[];
  max: number;
}) {
  const bild = useMemo(() => publikumsBild({
    widthM: venue.widthM, depthM: venue.heightM, stages: venue.stages, cameras, persons, walls, blocks: venue.seatingBlocks,
  }), [venue.widthM, venue.heightM, venue.stages, venue.seatingBlocks, cameras, persons, walls]);
  const obj = useMemo(() => {
    const g = new THREE.Group();
    if (bild.menschen.length) g.add(erzeugePublikum(bild.menschen, { max }));
    if (bild.sitze.length) g.add(erzeugeSitze(bild.sitze));
    for (const t of bild.tribuenen) {
      const m = erzeugeTribuene(t);
      if (m) g.add(m);
    }
    return g;
  }, [bild, max]);
  useEntsorgen(obj);
  return obj ? <primitive object={obj} /> : null;
}

/* ── Showlicht: Traversen, Scheinwerfer mit Kegel im Dunst ── */
export function ShowRig({ venue, look, werte, draussen }: { venue: Venue; look: { x: number; y: number }; werte: StufenWerte; draussen: boolean }) {
  const einstellung = useMemo(() => showLichtAus(venue.showLight), [venue.showLight]);
  const rig = useMemo(() => showRig(venue.stages, look, venue, einstellung), [venue, look, einstellung]);
  // Unter freiem Himmel verteilt sich der Dunst — dieselbe Einstellung wirkt schwaecher.
  const dunst = einstellung.haze * (draussen ? 0.64 : 1);
  const obj = useMemo(() => {
    const g = new THREE.Group();
    for (const t of rig.traversen) g.add(erzeugeTraverse(new THREE.Vector3(...t.von), new THREE.Vector3(...t.nach)));
    // Echte Lichter zuerst fuer die Front (Gesichter) und das Flutlicht; die
    // Beams bleiben Kegel im Dunst mit Lichtfleck.
    let spots = 0;
    let schatten = 0;
    const mitte = rig.lampen.filter((l) => l.art !== 'beam');
    const wichtig = new Set(mitte.filter((_, i) => i % Math.max(1, Math.ceil(mitte.length / werte.maxSpots)) === 0));
    for (const l of rig.lampen) {
      const licht = wichtig.has(l) && spots < werte.maxSpots;
      if (licht) spots++;
      const schattenJa = licht && werte.schatten && schatten < werte.maxSchatten && l.art === 'wash';
      if (schattenJa) schatten++;
      g.add(erzeugeScheinwerfer({
        von: new THREE.Vector3(...l.von),
        nach: new THREE.Vector3(...l.nach),
        farbe: l.farbe,
        feldwinkelDeg: l.feldwinkelDeg,
        dunst: l.art === 'wash' ? dunst * 0.45 : dunst,
        intensitaet: l.intensitaet,
        // Breite Kegel sind weich, dort reichen halb so viele Schritte.
        strahlSchritte: l.feldwinkelDeg > 15 ? Math.ceil(werte.strahlSchritte / 2) : werte.strahlSchritte,
        licht,
        schatten: schattenJa,
        lichtStaerke: l.art === 'flut' ? 120 : l.art === 'wash' ? 140 : 60,
        fleck: l.art !== 'flut',
      }));
    }
    return g;
  }, [rig, werte, dunst]);
  useEntsorgen(obj);
  return obj ? <primitive object={obj} /> : null;
}


/* ── LED-Waende ── */
const LED_FARBEN: [string, string][] = [['#ff7a2e', '#3a2bd8'], ['#2b6bff', '#b02bd8'], ['#ffb347', '#d8402b']];

export function LedWalls({ walls, maxLichter }: { walls: VenueVideoWall[]; maxLichter: number }) {
  const obj = useMemo(() => {
    const g = new THREE.Group();
    walls.map(videowandNormal).forEach((w, i) => {
      const [a, b] = LED_FARBEN[i % LED_FARBEN.length];
      const monitor = w.displayType === 'monitor';
      const wand = monitor ? new THREE.Group() : erzeugeLedWand({ breiteM: w.widthM, hoeheM: w.heightM, farbeA: a, farbeB: b, helligkeit: 1.8 });
      if (monitor) {
        const bezel = new THREE.Mesh(new THREE.BoxGeometry(w.widthM, w.heightM, 0.06), new THREE.MeshStandardMaterial({ color: '#181818', roughness: 0.5 }));
        bezel.position.y = w.heightM / 2;
        bezel.castShadow = true; bezel.receiveShadow = true;
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.01, w.widthM - 0.03), Math.max(0.01, w.heightM - 0.03)), new THREE.MeshBasicMaterial({ color: '#536b80', toneMapped: false }));
        screen.position.set(0, w.heightM / 2, 0.031);
        wand.add(bezel, screen);
      }
      if (!monitor && i < maxLichter) wand.add(erzeugeLedLicht({ breiteM: w.widthM, hoeheM: w.heightM, farbe: new THREE.Color(a).lerp(new THREE.Color(b), 0.5), staerke: 1.2 }));
      // Bodenstuetzen, damit eine hoch haengende Wand nicht schwebt.
      if (!monitor && w.bottomM > 0.3) {
        const stahl = new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.5, metalness: 0.6 });
        for (const s of [-1, 1]) {
          const st = new THREE.Mesh(new THREE.BoxGeometry(0.25, w.bottomM, 0.25), stahl);
          st.position.set((s * w.widthM) / 2.4, -w.bottomM / 2, -0.2);
          st.castShadow = true;
          wand.add(st);
        }
      }
      wand.position.set(w.x, w.bottomM, w.y);
      wand.rotation.y = -(w.rotationDeg * Math.PI) / 180;
      g.add(wand);
    });
    return g;
  }, [walls, maxLichter]);
  useEntsorgen(obj);
  return obj ? <primitive object={obj} /> : null;
}

/* ── Abdeckung am Boden: ein Keil je Kamera bis zum Schaerfepunkt ── */
export function CoverageWedge({ cam, hFovDeg, index, emphasis }: { cam: VenueCamera; hFovDeg: number; index: number; emphasis: boolean }) {
  const [a, b, c] = coverageWedge(cam, hFovDeg);
  const y = 0.03 + index * 0.002;
  const fill = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([a[0], y, a[1], c[0], y, c[1], b[0], y, b[1]]), 3));
    return g;
  }, [a[0], a[1], b[0], b[1], c[0], c[1], y]); // eslint-disable-line react-hooks/exhaustive-deps
  const edges = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const aim = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      a[0], y, a[1], b[0], y, b[1],
      b[0], y, b[1], c[0], y, c[1],
      c[0], y, c[1], a[0], y, a[1],
      // Sehlinie von der Kamera (auf ihrer Hoehe) zum Ziel.
      a[0], cam.z, a[1], aim[0], y, aim[1],
    ]), 3));
    return g;
  }, [a[0], a[1], b[0], b[1], c[0], c[1], y, cam.z]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => () => { fill.dispose(); edges.dispose(); }, [fill, edges]);
  return (
    <group>
      <mesh geometry={fill}>
        <meshBasicMaterial color={cam.color} transparent opacity={emphasis ? 0.22 : 0.11} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={cam.color} transparent opacity={emphasis ? 0.95 : 0.6} toneMapped={false} />
      </lineSegments>
    </group>
  );
}
