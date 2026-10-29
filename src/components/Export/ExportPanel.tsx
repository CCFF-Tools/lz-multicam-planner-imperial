import { useCallback, useEffect, useState } from 'react';
import { useStore, APP_VERSION } from '../../store/useStore';
import { getCameraById, getEffectiveSensor, getAdapterInfo } from '../../data/cameras';
import { getLensById } from '../../data/lenses';
import { computeFov, computeDof, personHeightInFrame } from '../../utils/fov';
import { getExportRegistry } from '../../store/exportRegistry';
import type { VenueCamera } from '../../types';
import { cameraSheetFingerprint } from '../../utils/documentContent';
import { presetRows } from '../../utils/ptzPresets';
import {
  UNSTATED,
  cardExtraRows,
  commsLines,
  kitLines,
  riggingLines,
} from '../../utils/cameraCardExtras';
import { stampForStand, stampLine } from '../../utils/documentStamp';
import { coverageLines, reachReport } from '../../utils/lensReach';
import { paintLines } from '../../utils/paintState';
import { shadingLines } from '../../utils/shadingCapability';
import { registryLines } from '../../utils/paintRegistry';
import { useTranslation, format } from '../../i18n';
import { WEBGL_POWER_PREFERENCE } from '../../utils/gpuInfo';
import { useUnits } from '../../store/units';
import { formatDimensions, formatLengthWithUnit } from '../../utils/units';
import { createZip } from '../../utils/zip';
import { cameraExportJobs, presetExportJobs, presetExportKey } from '../../utils/exportBatch';
import { withTransientProjectState } from '../../store/transientProjectState';
import { useBedarf3D } from '../Render3D/kameraBild3d';

export type ExportMode = 'current' | 'all' | 'widetele' | 'all-widetele' | 'selected-presets';

interface ExportDetail {
  mode?: ExportMode;
  presetKeys?: string[];
}

interface ExportArtifact {
  filename: string;
  blob: Blob;
}

/** Export optics are temporary UI state and must not dirty the project. */
function setExportCamera(camera: VenueCamera): void {
  withTransientProjectState(() => {
    useStore.setState((state) => ({
      cameras: state.cameras.map((current) => current.id === camera.id ? camera : current),
    }));
  });
}

const safeFilePart = (value: string): string => value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'export';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Listens for the 'multicam-export' custom event and generates a combined PNG
 * containing: camera label, 2D plan, 3D screenshot, Preview, and Calculator data.
 *
 * The detail.mode controls which renders are emitted:
 *   - 'current'       → one PNG of the currently-selected camera at its current focal length
 *   - 'all'           → one PNG per camera at each camera's current focal length
 *   - 'widetele'      → two PNGs for the selected camera: at min and max focal length
 *   - 'all-widetele'  → two PNGs per camera (wide + tele)
 */
export default function ExportPanel() {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [presetPickerOpen, setPresetPickerOpen] = useState(false);
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(() => new Set());
  useBedarf3D(presetPickerOpen || exporting);
  const { cameras, venue, persons, projectVersion } = useStore();
  const { t } = useTranslation();
  const units = useUnits((s) => s.units);
  const length = useCallback((meters: number) => formatLengthWithUnit(meters, units), [units]);

  const capture2DCanvas = useCallback((): HTMLCanvasElement | null => {
    const registry = getExportRegistry();
    if (typeof registry.capture2DExport === 'function') {
      try {
        return registry.capture2DExport();
      } catch { /* fall through */ }
    }
    return document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
  }, []);

  const capture3DCanvas = useCallback((): HTMLCanvasElement | null => {
    const canvases = document.querySelectorAll('canvas');
    for (const c of canvases) {
      if (c.closest('[data-venue3d]')) return c;
    }
    for (const c of canvases) {
      const ctx = c.getContext('webgl2', { powerPreference: WEBGL_POWER_PREFERENCE }) || c.getContext('webgl', { powerPreference: WEBGL_POWER_PREFERENCE });
      if (ctx) return c;
    }
    return null;
  }, []);

  const capturePreviewCanvas = useCallback((renderedEnglish = false): HTMLCanvasElement | null => {
    const registry = getExportRegistry();
    if (typeof registry.renderPreviewOffscreen === 'function') {
      try {
        const canvas = registry.renderPreviewOffscreen(
          960,
          renderedEnglish ? { rendered: true, english: true } : undefined,
        );
        if (canvas) return canvas;
      } catch { /* fall through */ }
    }
    if (renderedEnglish) return null;
    if (typeof registry.capturePreviewCanvas === 'function') {
      try { return registry.capturePreviewCanvas(); } catch { /* fall through */ }
    }
    return null;
  }, []);

  /** Wait two animation frames + a settle delay for Konva/R3F to paint at new dimensions. */
  const waitForPaint = useCallback(async (settleMs = 250) => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTimeout(resolve, settleMs);
      }));
    });
  }, []);

  /** Render a single export PNG for a given camera + optional focal length override. */
  const renderOne = useCallback(async (baseCam: VenueCamera, opts?: {
    focalOverride?: number;
    variantLabel?: string;
    displayLabel?: string;
    extraSettleMs?: number;
    cameraOverride?: Partial<VenueCamera>;
  }) => {
    const overriddenCam = { ...baseCam, ...opts?.cameraOverride };
    const targetCam = { ...overriddenCam, focalLength: opts?.focalOverride ?? overriddenCam.focalLength };
    const camDef = getCameraById(targetCam.cameraId, useStore.getState().customCameras);
    const lensDef = getLensById(targetCam.lensId, useStore.getState().customLenses);
    if (!camDef || !lensDef) return null;

    const focalLength = targetCam.focalLength;
    const sensor = getEffectiveSensor(camDef, lensDef, targetCam.useSpeedbooster, targetCam.sensorModeIndex, targetCam.activeMount);
    const adapterInfo = getAdapterInfo(camDef, lensDef, targetCam.useSpeedbooster, targetCam.activeMount);
    const fov = computeFov(sensor, focalLength, targetCam.focusDistance, targetCam.extenderActive, lensDef.squeeze ?? 1);
    const dof = computeDof(sensor, focalLength, targetCam.aperture, targetCam.focusDistance, targetCam.extenderActive);
    const personPx = personHeightInFrame(sensor.heightMm, focalLength * targetCam.extenderActive, targetCam.focusDistance);
    const rigging = riggingLines(targetCam, units);
    const comms = commsLines(targetCam);
    const kit = kitLines(targetCam);
    const deckung = reachReport({
      cameras: [targetCam],
      persons,
      optics: () => ({ sensor, lens: lensDef }),
    }).rows[0] ?? null;
    const deckungZeilen = coverageLines(deckung, units);
    const bildZeilen = [...paintLines(targetCam), ...registryLines(targetCam)];
    const shading = shadingLines(targetCam);
    const notes = (targetCam.notes ?? '').trim();

    // Apply override to the store so the live preview/2D/3D paint with the right state,
    // then wait one frame so the canvases update before we capture them.
    const originalCam = useStore.getState().cameras.find((camera) => camera.id === targetCam.id) ?? baseCam;
    const originalSelected = useStore.getState().selectedCameraId;
    const needSelectionChange = useStore.getState().selectedCameraId !== targetCam.id;
    const needCameraChange = opts?.focalOverride !== undefined || opts?.cameraOverride !== undefined;

    if (needSelectionChange) useStore.getState().selectCamera(targetCam.id);
    if (needCameraChange) setExportCamera(targetCam);
    const extra = opts?.extraSettleMs ?? 0;
    if (needSelectionChange || needCameraChange || extra > 0) await waitForPaint(250 + extra);

    const plan2D = capture2DCanvas();
    const view3D = capture3DCanvas();
    const previewCanvas = capturePreviewCanvas();

    // ── Layout constants ──
    const EW = 1920;
    const padding = 20;
    const headerH = 80;
    const tileW = (EW - padding * 3) / 2;
    const tileH = Math.round(tileW * 9 / 16);
    const lineH = 22;
    const sectionHeight = (rows: number, visible = true) => visible ? 8 + lineH + rows * lineH : 0;
    const noteLines = notes
      ? notes.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 70)), 0)
      : 0;
    const calcContentH = 50 + lineH + 4
      + (16 + (adapterInfo ? 1 : 0)) * lineH + 6
      + sectionHeight(rigging.length)
      + sectionHeight(comms.length)
      + sectionHeight(kit.length, kit.length > 0)
      + sectionHeight(deckungZeilen.length, deckungZeilen.length > 0)
      + sectionHeight(bildZeilen.length, bildZeilen.length > 0)
      + sectionHeight(shading.length)
      + (notes ? 8 + lineH + noteLines * 16 : 0)
      + 16;
    const calcTileH = Math.max(tileH, calcContentH);
    const listedCameraCount = cameras.filter((camera) => (
      getCameraById(camera.cameraId, useStore.getState().customCameras)
      && getLensById(camera.lensId, useStore.getState().customLenses)
    )).length;
    const summaryH = Math.max(80, 64 + Math.ceil(listedCameraCount / 3) * 18);
    // Eigenes Band fuer die Stempelzeile (ADR-004). Der vorhandene
    // `padding`-Streifen unten sind 20 px -- eine 13-px-Zeile daringequetscht
    // klebte am Rand und waere beim Beschneiden das erste, was wegfaellt.
    const stampH = 30;
    // Bedarf 14 — die Preset-Tabelle bekommt eigene Hoehe, und zwar nur wenn
    // es Presets GIBT. Ein fester Block waere auf jeder Karte ohne PTZ eine
    // leere Flaeche, und die Karte ist ohnehin schon voll.
    const presetZeilen = presetRows(targetCam, units);
    const presetRowH = 18;
    const presetH = presetZeilen.length > 0 ? 40 + presetZeilen.length * presetRowH + 12 : 0;
    const totalH =
      headerH + padding + tileH + padding + calcTileH + padding + summaryH +
      (presetH > 0 ? padding + presetH : 0) + padding + stampH;

    const out = document.createElement('canvas');
    out.width = EW;
    out.height = totalH;
    const ctx = out.getContext('2d')!;

    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, EW, totalH);

    // ── Header ──
    ctx.fillStyle = '#1a1d27';
    ctx.fillRect(0, 0, EW, headerH);
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    const variant = opts?.variantLabel ? ` — ${opts.variantLabel}` : '';
    ctx.fillText(`${targetCam.label}${variant} — ${camDef.manufacturer} ${camDef.model}`, padding, 36);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '16px sans-serif';
    ctx.fillText(format(t('preview.export.lensLine', 'Lens: {mfr} {model} @ {fl}mm'), { mfr: lensDef.manufacturer, model: lensDef.model, fl: focalLength.toFixed(1) }), padding, 60);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.fillText(format(t('preview.export.headerMeta', '{venue} — Project v{pv} — LZ Multicam Planner v{av}'), { venue: venue.name, pv: projectVersion, av: APP_VERSION }), EW - padding, 30);
    ctx.fillText(format(t('preview.export.exportedAt', 'Exported: {when}'), { when: new Date().toLocaleString() }), EW - padding, 50);
    if (adapterInfo) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(format(t('preview.export.adapter', 'Adapter: {name}'), { name: adapterInfo.name }), EW - padding, 70);
    }

    // ── Tile helper: letterbox to preserve aspect ratio ──
    function drawTile(srcCanvas: HTMLCanvasElement | null, x: number, y: number, label: string) {
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(x, y, tileW, tileH);

      if (srcCanvas && srcCanvas.width > 0 && srcCanvas.height > 0) {
        const srcRatio = srcCanvas.width / srcCanvas.height;
        const tileRatio = tileW / tileH;
        let dw: number, dh: number;
        if (srcRatio > tileRatio) {
          dw = tileW;
          dh = tileW / srcRatio;
        } else {
          dh = tileH;
          dw = tileH * srcRatio;
        }
        const dx = x + (tileW - dw) / 2;
        const dy = y + (tileH - dh) / 2;
        ctx.drawImage(srcCanvas, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = '#1a1d27';
        ctx.fillRect(x, y, tileW, tileH);
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(format(t('preview.export.notAvailable', '{label} — not available'), { label }), x + tileW / 2, y + tileH / 2);
      }
      ctx.strokeStyle = '#2a2d3a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, tileW, tileH);
      ctx.fillStyle = '#000000aa';
      ctx.fillRect(x, y, 160, 28);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 8, y + 19);
    }

    drawTile(plan2D, padding, headerH + padding, t('preview.export.tile2d', '2D plan'));
    drawTile(view3D, padding * 2 + tileW, headerH + padding, t('preview.export.tile3d', '3D view'));
    drawTile(previewCanvas, padding, headerH + padding + tileH + padding, t('preview.export.tilePreview', 'Camera preview'));

    // Calculator data tile
    const calcX = padding * 2 + tileW;
    const calcY = headerH + padding + tileH + padding;
    ctx.fillStyle = '#1a1d27';
    ctx.fillRect(calcX, calcY, tileW, calcTileH);
    ctx.strokeStyle = '#2a2d3a';
    ctx.lineWidth = 2;
    ctx.strokeRect(calcX, calcY, tileW, calcTileH);

    ctx.fillStyle = '#000000aa';
    ctx.fillRect(calcX, calcY, 200, 28);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(t('preview.export.calcData', 'Calculator / data'), calcX + 8, calcY + 19);

    const cx = calcX + 20;
    let cy = calcY + 50;
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(t('preview.export.cameraOptics', 'CAMERA & OPTICS'), cx, cy); cy += lineH + 4;

    ctx.font = '13px monospace';
    ctx.fillStyle = '#e5e7eb';
    // Label column is padded to a fixed width so translated labels stay aligned;
    // an explicit `color` (not a text-prefix match) drives the accent colouring.
    const GREEN = '#22c55e';
    type DataLine = { label?: string; value?: string; raw?: string; color?: string; gap?: boolean };
    const lines: DataLine[] = [
      { label: t('preview.export.d.camera', 'Camera:'), value: `${camDef.manufacturer} ${camDef.model}` },
      { label: t('preview.export.d.sensor', 'Sensor:'), value: `${sensor.name} (${sensor.widthMm.toFixed(1)}×${sensor.heightMm.toFixed(1)}mm, ×${sensor.cropFactor.toFixed(2)})` },
      { label: t('preview.export.d.mount', 'Mount:'), value: `${camDef.mount}` },
      { label: t('preview.export.d.lens', 'Lens:'), value: `${lensDef.manufacturer} ${lensDef.model}` },
      { label: t('preview.export.d.focalLength', 'Focal length:'), value: `${focalLength.toFixed(1)}mm${targetCam.extenderActive > 1 ? ` (×${targetCam.extenderActive} = ${(focalLength * targetCam.extenderActive).toFixed(0)}mm)` : ''}` },
      { label: t('preview.export.d.aperture', 'Aperture:'), value: `f/${targetCam.aperture}` },
      { label: t('preview.export.d.focusDist', 'Focus dist:'), value: length(targetCam.focusDistance) },
      { label: t('preview.export.d.position', 'Position:'), value: `X=${length(targetCam.x)} Y=${length(targetCam.y)} Z=${length(targetCam.z)}` },
      { raw: `Pan: ${targetCam.pan.toFixed(1)}°  Tilt: ${targetCam.tilt.toFixed(1)}°` },
      { gap: true },
      { label: t('preview.export.d.fovH', 'FOV H:'), value: `${fov.horizontalDeg.toFixed(2)}°`, color: GREEN },
      { label: t('preview.export.d.fovV', 'FOV V:'), value: `${fov.verticalDeg.toFixed(2)}°`, color: GREEN },
      { label: t('preview.export.d.image', 'Image:'), value: formatDimensions(fov.imageWidthAtDistance, fov.imageHeightAtDistance, units) },
      { label: t('preview.export.d.eqFl', '35mm eq FL:'), value: `${fov.equivalentFocalLength.toFixed(0)}mm` },
      { label: t('preview.export.d.dof', 'DoF:'), value: `${length(dof.nearLimit < 0.01 ? 0 : dof.nearLimit)} – ${dof.farLimit === Infinity ? '∞' : length(dof.farLimit)}`, color: GREEN },
      { label: t('preview.export.d.hyperfocal', 'Hyperfocal:'), value: length(dof.hyperfocal) },
      { label: `${t('preview.export.d.person', 'Person')} ${length(1.8)}:`, value: `${personPx.toFixed(0)}px / 1080 (${((personPx / 1080) * 100).toFixed(1)}%)`, color: GREEN },
    ];
    if (adapterInfo) {
      const lossStr = adapterInfo.lightLossStops > 0 ? `−${adapterInfo.lightLossStops}T` : adapterInfo.lightLossStops < 0 ? `+${Math.abs(adapterInfo.lightLossStops)}T` : '0T';
      lines.push({ label: t('preview.export.d.adapter', 'Adapter:'), value: `${adapterInfo.name} (${lossStr})`, color: '#f59e0b' });
    }

    lines.forEach((ln) => {
      if (ln.gap) { cy += 6; return; }
      ctx.fillStyle = ln.color ?? '#e5e7eb';
      ctx.fillText(ln.raw ?? (ln.label!.padEnd(14) + ln.value), cx, cy);
      cy += lineH;
    });

    // ── BEDARFE 59/60/61 — Rigging, Comms und Kit auf die Karte ──
    //
    // Diese Bloecke stehen IMMER da, auch wenn nichts eingetragen ist. Eine
    // weggelassene Zeile liest sich als „gibt es nichts zu sagen"; genau daran
    // scheitert der Zettel heute. „nicht angegeben" liest sich als Auftrag.
    cy += 8;
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('RIGGING', cx, cy);
    cy += lineH;
    ctx.font = '13px monospace';
    ctx.fillStyle = '#e5e7eb';
    for (const line of rigging) {
      ctx.fillStyle = line.includes(UNSTATED) ? '#f59e0b' : '#e5e7eb';
      ctx.fillText(line, cx, cy);
      cy += lineH;
    }

    cy += 8;
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('COMMS', cx, cy);
    cy += lineH;
    ctx.font = '13px monospace';
    for (const line of comms) {
      ctx.fillStyle = line.includes(UNSTATED) ? '#f59e0b' : '#e5e7eb';
      ctx.fillText(line, cx, cy);
      cy += lineH;
    }

    if (kit.length > 0) {
      cy += 8;
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('KIT AN DIESER POSITION', cx, cy);
      cy += lineH;
      ctx.font = '13px monospace';
      ctx.fillStyle = '#e5e7eb';
      for (const k of kit) {
        ctx.fillText(`· ${k}`, cx, cy);
        cy += lineH;
      }
    }

    // ── BEDARF 58 — der Deckungsauftrag und ob die Optik ihn schafft ──
    //
    // Ueber `reachReport` und nicht mit einer eigenen Rechnung: die Engstelle
    // entscheidet, sonst stuende auf dem Blatt etwas anderes als in der
    // Leiste. Ohne Auftrag steht hier NICHTS — anders als bei Rigging und
    // Comms fehlt hier keine Angabe, sondern eine Anforderung, die niemand
    // gestellt hat.
    if (deckungZeilen.length > 0) {
      cy += 8;
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('DECKUNGSAUFTRAG', cx, cy);
      cy += lineH;
      ctx.font = '13px monospace';
      const erreicht = deckung?.verdict.kind === 'reachable';
      for (const line of deckungZeilen) {
        ctx.fillStyle = line.startsWith('Optik:') && !erreicht ? '#f59e0b' : '#e5e7eb';
        ctx.fillText(line, cx, cy);
        cy += lineH;
      }
    }

    // ── BEDARF 63 — der Bildzustand dieser Position ──
    //
    // Ohne Eintrag steht hier NICHTS: eine Position, fuer die niemand einen
    // Bildzustand vorgesehen hat, bekommt keine Frage gestellt. MIT Eintrag
    // stehen alle vier Zeilen da, auch die leeren — eine weggelassene liest
    // sich als „dazu gibt es nichts zu sagen".
    // Bedarf 47 — Platz und Body-Nummer stehen im selben Block wie der
    // Bildzustand: „wo ist er" ist die zweite Haelfte derselben Frage, und
    // ein eigener Kasten daneben zerrisse sie.
    if (bildZeilen.length > 0) {
      cy += 8;
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('BILDZUSTAND', cx, cy);
      cy += lineH;
      ctx.font = '13px monospace';
      for (const line of bildZeilen) {
        ctx.fillStyle = line.includes(UNSTATED) ? '#f59e0b' : '#e5e7eb';
        ctx.fillText(line, cx, cy);
        cy += lineH;
      }
    }

    // ── BEDARF 48 — der Fernsteuerweg und was er hergibt ──
    //
    // Steht IMMER da, wie Rigging und Comms. Der Bedarf will die Luecke zur
    // Planungszeit sichtbar haben statt in der Probe — eine weggelassene
    // Zeile waere genau die Probe.
    cy += 8;
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('SCHATTIERUNG', cx, cy);
    cy += lineH;
    ctx.font = '13px monospace';
    for (const line of shading) {
      ctx.fillStyle = line.includes(UNSTATED) ? '#f59e0b' : '#e5e7eb';
      ctx.fillText(line, cx, cy);
      cy += lineH;
    }

    // ── Notes (only if filled) ──
    if (notes) {
      cy += 8;
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(t('preview.export.notes', 'NOTES'), cx, cy);
      cy += lineH;

      ctx.font = '12px monospace';
      ctx.fillStyle = '#e5e7eb';
      const noteMaxW = tileW - 40; // matches cx padding on both sides
      const noteLineH = 16;

      // Word-wrap inside the calc tile, respecting hard newlines in the user's text
      const wrap = (text: string): string[] => {
        const out: string[] = [];
        for (const rawLine of text.split('\n')) {
          if (!rawLine) { out.push(''); continue; }
          const words = rawLine.split(/\s+/);
          let cur = '';
          for (const w of words) {
            const test = cur ? `${cur} ${w}` : w;
            if (ctx.measureText(test).width > noteMaxW && cur) {
              out.push(cur);
              cur = w;
            } else {
              cur = test;
            }
          }
          if (cur) out.push(cur);
        }
        return out;
      };

      const wrappedLines = wrap(notes);
      for (const line of wrappedLines) {
        ctx.fillText(line, cx, cy);
        cy += noteLineH;
      }
    }

    // ── Camera list summary ──
    const summaryY = calcY + calcTileH + padding;
    ctx.fillStyle = '#1a1d27';
    ctx.fillRect(padding, summaryY, EW - padding * 2, summaryH);
    ctx.strokeStyle = '#2a2d3a';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, summaryY, EW - padding * 2, summaryH);

    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(t('preview.export.allCameras', 'ALL CAMERAS IN PROJECT'), padding + 16, summaryY + 24);

    ctx.font = '12px monospace';
    const colW = (EW - padding * 2 - 32) / 3;
    let row = 0;
    let col = 0;
    cameras.forEach((c) => {
      const cd = getCameraById(c.cameraId, useStore.getState().customCameras);
      const ld = getLensById(c.lensId, useStore.getState().customLenses);
      if (!cd || !ld) return;
      const sx = padding + 16 + col * colW;
      const sy = summaryY + 46 + row * 18;
      const isSelected = c.id === targetCam.id;
      ctx.fillStyle = isSelected ? '#3b82f6' : '#9ca3af';
      ctx.font = isSelected ? 'bold 12px monospace' : '12px monospace';
      ctx.fillText(`${c.label}: ${cd.manufacturer} ${cd.model} + ${ld.model.substring(0, 30)}`, sx, sy);
      col++;
      if (col >= 3) { col = 0; row++; }
    });

    // ── PTZ-Presets (Bedarf 14) ──
    // Nummer -> benannter Shot -> Segment, genau die drei Spalten des
    // Bedarfs, plus Optik (ein Shot ohne Brennweite ist nicht nachstellbar)
    // und Stand (nur damit ist „ist das noch aktuell?" beantwortbar).
    if (presetH > 0) {
      const py = summaryY + summaryH + padding;
      ctx.fillStyle = '#1a1d27';
      ctx.fillRect(padding, py, EW - padding * 2, presetH);
      ctx.strokeStyle = '#2a2d3a';
      ctx.lineWidth = 2;
      ctx.strokeRect(padding, py, EW - padding * 2, presetH);

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('PTZ-PRESETS', padding + 16, py + 24);

      const spalten = [padding + 16, padding + 70, padding + 400, padding + 700, EW - padding - 120];
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#6b7280';
      ['NR', 'SHOT', 'SEGMENT', 'OPTIK', 'STAND'].forEach((h, i) => ctx.fillText(h, spalten[i], py + 40));

      ctx.font = '12px monospace';
      presetZeilen.forEach((r, i) => {
        const ry = py + 40 + (i + 1) * presetRowH;
        ctx.fillStyle = '#93c5fd';
        ctx.fillText(r.nummer, spalten[0], ry);
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText(r.shot.substring(0, 40), spalten[1], ry);
        ctx.fillStyle = '#9ca3af';
        ctx.fillText((r.segment || '—').substring(0, 32), spalten[2], ry);
        ctx.fillText(r.optik, spalten[3], ry);
        ctx.fillText(r.stand, spalten[4], ry);
      });
    }

    // ── Stempelzeile (ADR-004) ──
    // Was auf DIESEM Blatt steht, geht ein: die eigene Kamera samt Optik und
    // Aufstellung, die Notiz, und die Kameraliste am Fuss -- die ist auf der
    // Karte zu sehen, also gehoert sie in den Fingerabdruck. Die Kachelbilder
    // brauchen keine eigenen Zeilen: sie sind Renderings genau dieses
    // Zustands und wuerden dieselben Zeilen liefern.
    //
    // Keine Revision und damit keine Abweichungs-Behauptung (Regel 2): der
    // MultiCam-Planner zaehlt Aenderungen (`projectVersion`), statt Staende
    // festzuschreiben. Diese Zahl steht bereits in der Kopfzeile -- sie kann
    // aber kollidieren, wenn zwei Leute dieselbe Datei unterschiedlich
    // weiterbearbeiten. Genau diese Luecke schliesst der Fingerabdruck.
    const stamp = stampForStand({
      project: venue.name || 'MultiCam',
      current: cameraSheetFingerprint({
        label: `${targetCam.label}${variant}`,
        camera: `${camDef.manufacturer} ${camDef.model}`,
        lens: `${lensDef.manufacturer} ${lensDef.model}`,
        optik: [
          focalLength, targetCam.extenderActive, targetCam.aperture, targetCam.focusDistance,
          sensor.name, sensor.widthMm, sensor.heightMm, camDef.mount, targetCam.activeMount ?? '',
          targetCam.useSpeedbooster ? 'sb' : '', targetCam.sensorModeIndex ?? '',
          fov.horizontalDeg.toFixed(2), fov.verticalDeg.toFixed(2),
          dof.nearLimit.toFixed(2), String(dof.farLimit), dof.hyperfocal.toFixed(2),
          personPx.toFixed(0),
        ],
        position: [targetCam.x, targetCam.y, targetCam.z, targetCam.pan, targetCam.tilt],
        adapter: adapterInfo?.name,
        notes: targetCam.notes ?? '',
        // Was auf dem Blatt steht, geht ein.
        presets: presetZeilen.map((r) => [r.nummer, r.shot, r.segment, r.optik, r.stand]),
        // Bedarfe 59/60/61 — dieselbe Regel: ein geaenderter Comms-Kanal ist
        // ein anderes Blatt, auch wenn Kamera und Optik gleich blieben. Und
        // genau dieser Fall ist der, bei dem jemand mit dem alten Zettel auf
        // den falschen Kanal schaltet.
        extras: cardExtraRows(targetCam, units),
        // Bedarf 58 — dieselbe Regel wie bei Rigging/Comms: was auf dem Blatt
        // zu SEHEN ist, geht in den Fingerabdruck. Ein verschobener Standort
        // oder eine getauschte Optik macht aus „erreichbar" ein „reicht nicht
        // heran" — und dann ist es ein anderes Blatt.
        coverage: deckungZeilen,
        alle: cameras.map((c) => {
          const cd = getCameraById(c.cameraId, useStore.getState().customCameras);
          const ld = getLensById(c.lensId, useStore.getState().customLenses);
          return {
            id: c.id,
            label: c.label,
            camera: cd ? `${cd.manufacturer} ${cd.model}` : '',
            lens: ld ? `${ld.manufacturer} ${ld.model}` : '',
          };
        }),
      }),
      now: new Date(),
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px monospace';
    ctx.fillText(stampLine(stamp), padding, totalH - stampH + 18);

    // ── Artifact ──
    const filename = `${safeFilePart(targetCam.label)}${opts?.variantLabel ? `_${safeFilePart(opts.variantLabel)}` : ''}_${safeFilePart(venue.name)}_v${projectVersion}.png`;
    const blob = await new Promise<Blob | null>((resolve) => {
      out.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });

    // ── Restore overrides ──
    if (needCameraChange) setExportCamera(originalCam);
    if (needSelectionChange) useStore.getState().selectCamera(originalSelected);
    return blob ? { filename, blob } satisfies ExportArtifact : null;
  }, [cameras, venue, persons, projectVersion, capture2DCanvas, capture3DCanvas, capturePreviewCanvas, waitForPaint, t, length, units]);

  const generateExport = useCallback(async (mode: ExportMode = 'current', presetKeys: ReadonlySet<string> = new Set()) => {
    const state = useStore.getState();
    const currentCam = state.cameras.find((c) => c.id === state.selectedCameraId);
    const targetCams = (mode === 'all' || mode === 'all-widetele' || mode === 'selected-presets')
      ? state.cameras
      : currentCam ? [currentCam] : [];

    if (targetCams.length === 0) {
      alert(t('preview.export.noCameras', 'No cameras to export. Add a camera first.'));
      return;
    }

    setExporting(true);

    if (mode === 'selected-presets') {
      try {
        const { exportSelectedPresets } = await import('./selectedPresetExport');
        const result = await exportSelectedPresets(presetExportJobs(targetCams, presetKeys), units,
          (current, total) => setExportProgress({ current, total }));
        if (result.artifacts.length) {
          const archive = await createZip(result.artifacts.map(a => ({ name: a.filename, data: a.blob })));
          downloadBlob(archive, `${safeFilePart(state.venue.name)}_camera_exports_v${state.projectVersion}.zip`);
        }
        if (result.failures.length) alert(`Some preset exports failed:\n${result.failures.join('\n')}`);
      } catch (error) {
        alert(`Preset export failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setExporting(false);
        setExportProgress({ current: 0, total: 0 });
      }
      return;
    }

    let restoreLayout: (() => void) | null = null;
    const registry = getExportRegistry();
    if (typeof registry.prepareForExport === 'function') {
      try {
        const prep = await registry.prepareForExport();
        if (prep) restoreLayout = prep.restore;
      } catch { /* fall through */ }
    }

    const framingApi = registry.framing3D;
    let savedFraming: import('../../store/exportRegistry').FramingState | null = null;
    if (framingApi) {
      try {
        savedFraming = framingApi.save();
        framingApi.fitVenue(state.venue.widthM, state.venue.heightM);
        // Allow the framing change to render — the WebGL drawing buffer needs at
        // least one paint at the new camera before the capture has visible content.
        await waitForPaint(500);
      } catch { savedFraming = null; }
    }

    const originalSelected = state.selectedCameraId;
    const originalCameras = new Map(state.cameras.map((camera) => [camera.id, camera]));
    const wantsWideTele = mode === 'widetele' || mode === 'all-widetele';

    const jobs = cameraExportJobs(targetCams, wantsWideTele, (camera) => (
          getLensById(camera.lensId, useStore.getState().customLenses)
        ));

    if (jobs.length === 0) {
      if (framingApi && savedFraming) {
        try { framingApi.apply(savedFraming); } catch { /* ignore */ }
      }
      if (restoreLayout) restoreLayout();
      setExporting(false);
      return;
    }

    setExportProgress({ current: 0, total: jobs.length });

    const artifacts: ExportArtifact[] = [];
    try {
      for (let i = 0; i < jobs.length; i++) {
        setExportProgress({ current: i + 1, total: jobs.length });
        const artifact = await renderOne(jobs[i].cam, {
          focalOverride: jobs[i].focalOverride,
          variantLabel: jobs[i].variantLabel,
          displayLabel: jobs[i].displayLabel,
          cameraOverride: jobs[i].cameraOverride,
          // The first capture in the batch needs extra settle time so the WebGL
          // 3D canvas, freshly resized by the layout swap and the framing change,
          // actually paints visible content before drawImage reads from it.
          extraSettleMs: i === 0 ? 400 : 0,
        });
        if (artifact) artifacts.push(artifact);
      }

      if (artifacts.length === 1 && mode === 'current') {
        downloadBlob(artifacts[0].blob, artifacts[0].filename);
      } else if (artifacts.length > 0) {
        const archive = await createZip(artifacts.map((artifact) => ({ name: artifact.filename, data: artifact.blob })));
        const safeVenue = state.venue.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Venue';
        downloadBlob(archive, `${safeVenue}_camera_exports_v${state.projectVersion}.zip`);
      }
      if (artifacts.length !== jobs.length) {
        alert(format(t('preview.export.incomplete', 'Exported {done} of {total} images. Check that every camera and lens still exists.'), { done: artifacts.length, total: jobs.length }));
      }
    } finally {
      // Restore original selection (renderOne handles per-camera restore but final
      // cleanup ensures we land on whatever was selected before the batch).
      useStore.getState().selectCamera(originalSelected);
      for (const camera of originalCameras.values()) setExportCamera(camera);
      if (framingApi && savedFraming) {
        try { framingApi.apply(savedFraming); } catch { /* ignore */ }
      }
      if (restoreLayout) restoreLayout();
      setExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  }, [renderOne, t, units]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ExportDetail>).detail;
      const mode = detail?.mode ?? 'current';
      if (mode === 'selected-presets') {
        if (detail?.presetKeys) {
          void generateExport('selected-presets', new Set(detail.presetKeys));
          return;
        }
        setSelectedPresets(new Set());
        setPresetPickerOpen(true);
      } else {
        void generateExport(mode);
      }
    };
    window.addEventListener('multicam-export', handler);
    return () => window.removeEventListener('multicam-export', handler);
  }, [generateExport]);

  const presetOptions = cameras.flatMap((camera) => [...(camera.presets ?? [])]
    .sort((a, b) => a.number - b.number)
    .map((preset) => ({ camera, preset, key: presetExportKey(camera.id, preset.number) })));

  if (exporting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bc-scrim">
        <div className="bc-dialog p-6 text-bc-text-bright text-center min-w-[260px]">
          <div className="animate-pulse mb-2">{t('preview.export.generating', 'Generating export…')}</div>
          {exportProgress.total > 1 && (
            <div className="text-xs text-bc-muted">
              {exportProgress.current} / {exportProgress.total}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (presetPickerOpen) {
    const allKeys = presetOptions.map((option) => option.key);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bc-scrim p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="preset-export-title" className="bc-dialog flex max-h-[80vh] w-full max-w-xl flex-col p-5 text-bc-text-bright">
          <h2 id="preset-export-title" className="text-lg font-bold">{t('preview.export.presets.title', 'Export camera presets')}</h2>
          <p className="mt-1 text-sm text-bc-muted">{t('preview.export.presets.desc', 'Choose the numbered PTZ presets to render. Each selected preset becomes one PNG in a ZIP.')}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="bc-btn-soft text-xs" onClick={() => setSelectedPresets(new Set(allKeys))}>{t('preview.export.presets.all', 'Select all')}</button>
            <button type="button" className="bc-btn-soft text-xs" onClick={() => setSelectedPresets(new Set())}>{t('preview.export.presets.clear', 'Clear')}</button>
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto border border-bc-border">
            {presetOptions.length === 0 ? (
              <p className="p-4 text-sm text-bc-dim">{t('preview.export.presets.empty', 'No numbered camera presets are saved in this project.')}</p>
            ) : presetOptions.map(({ camera, preset, key }) => (
              <label key={key} className="flex cursor-pointer items-start gap-3 border-b border-bc-border px-3 py-2 last:border-b-0 hover:bg-bc-hover">
                <input
                  type="checkbox"
                  checked={selectedPresets.has(key)}
                  onChange={(event) => setSelectedPresets((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(key); else next.delete(key);
                    return next;
                  })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{camera.label} · #{preset.number} · {preset.name}</span>
                  <span className="block text-xs text-bc-dim">{preset.focalLength.toFixed(1)} mm · pan {preset.pan.toFixed(1)}° · tilt {preset.tilt.toFixed(1)}° · {length(preset.focusDistance)}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="bc-btn-soft" onClick={() => setPresetPickerOpen(false)}>{t('preview.export.presets.cancel', 'Cancel')}</button>
            <button
              type="button"
              className="bc-btn-primary"
              disabled={selectedPresets.size === 0}
              onClick={() => {
                const selected = new Set(selectedPresets);
                setPresetPickerOpen(false);
                void generateExport('selected-presets', selected);
              }}
            >
              {format(t('preview.export.presets.export', 'Export {count}'), { count: selectedPresets.size })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
