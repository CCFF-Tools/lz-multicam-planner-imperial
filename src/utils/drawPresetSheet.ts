import type { Venue, VenueCamera } from '../types';
import type { Units } from './units';
import { formatDimensions } from './units';
import { containExportImage, selectedPresetSheetLayout, type ExportRect, type presetSheetData } from './presetExportSheet';

const COLORS = { background: '#0f151e', panel: '#17212e', border: '#344354', heading: '#8dbcf0', text: '#e5eaf1', muted: '#aebdd0' };

/** Wrap long model/preset names; numeric strings remain on one line. */
export function sheetTextLines(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && ctx.measureText(`${line} ${word}`).width > width) { lines.push(line); line = ''; }
    for (const char of (line ? ` ${word}` : word)) {
      if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawPresetSheet(input: {
  camera: VenueCamera; cameraNumber: number; presetLabel: string; venue: Venue; projectVersion: number;
  timestamp: string; units: Units; frame: HTMLCanvasElement; plan: HTMLCanvasElement;
  data: ReturnType<typeof presetSheetData>;
}): HTMLCanvasElement {
  const layout = selectedPresetSheetLayout();
  const out = document.createElement('canvas');
  out.width = layout.width; out.height = layout.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, out.width, out.height);
  ctx.textBaseline = 'top';

  function text(value: string, x: number, y: number, width: number, size: number, color = COLORS.text, align: CanvasTextAlign = 'left', maxLines = 1, mono = false) {
    ctx.fillStyle = color; ctx.textAlign = align;
    let lines: string[];
    do {
      ctx.font = `${size}px ${mono ? 'monospace' : 'sans-serif'}`;
      lines = sheetTextLines(ctx, value, width);
      if (lines.length <= maxLines || size <= 14) break;
      size--;
    } while (size >= 14);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * (size + 3)));
  }
  function panel(rect: ExportRect, title: string, headerRight = '') {
    ctx.fillStyle = COLORS.panel; ctx.strokeStyle = COLORS.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 10); ctx.fill(); ctx.stroke();
    text(title, rect.x + 20, rect.y + 16, rect.width * .48, 23, COLORS.heading);
    if (headerRight) text(headerRight, rect.x + rect.width - 20, rect.y + 18, rect.width * .5 - 30, 18, COLORS.muted, 'right');
    ctx.beginPath(); ctx.moveTo(rect.x + 16, rect.y + 49); ctx.lineTo(rect.x + rect.width - 16, rect.y + 49); ctx.stroke();
  }
  function picture(src: HTMLCanvasElement, rect: ExportRect) {
    const fit = containExportImage(src.width, src.height, { x: rect.x + 12, y: rect.y + 57, width: rect.width - 24, height: rect.height - 93 });
    ctx.drawImage(src, fit.x, fit.y, fit.width, fit.height);
  }

  const number = String(input.cameraNumber).padStart(2, '0');
  ctx.fillStyle = '#223b55'; ctx.beginPath(); ctx.roundRect(24, 24, 80, 76, 12); ctx.fill();
  text(number, 64, 40, 70, 46, COLORS.text, 'center');
  text(input.camera.label, 124, 25, 1440, 40);
  text(`Camera ${number} · ${input.presetLabel} · ${input.camera.focalLength.toFixed(1)} mm · ${input.data.cameraModel}`, 124, 76, 1440, 21);
  text(`${input.venue.name} · Project v${input.projectVersion}`, 2536, 30, 890, 22, COLORS.text, 'right');
  text(input.timestamp, 2536, 69, 890, 20, COLORS.muted, 'right');
  panel(layout.cameraView, 'Simulated camera view', `${input.frame.width} × ${input.frame.height} · 16:9 · Focus ${input.data.focusDistance}`);
  picture(input.frame, layout.cameraView);
  panel(layout.plan2D, '2D Coverage Plan', formatDimensions(input.venue.widthM, input.venue.heightM, input.units));
  picture(input.plan, layout.plan2D);
  text(`Camera ${number} highlighted`, layout.plan2D.x + 16, layout.plan2D.y + layout.plan2D.height - 26, 300, 17, input.camera.color);
  text('X/Y origin: bottom-left room corner', layout.plan2D.x + layout.plan2D.width - 16, layout.plan2D.y + layout.plan2D.height - 26, 450, 17, COLORS.muted, 'right');

  input.data.sections.forEach((section, index) => {
    const rect = layout.sections[index]; panel(rect, section.title);
    const labelWidth = [165, 255, 335, 230][index];
    section.rows.forEach(([label, value], row) => {
      const y = rect.y + 66 + row * 46;
      text(label, rect.x + 20, y, labelWidth, 20, COLORS.muted);
      text(value, rect.x + rect.width - 20, y, rect.width - labelWidth - 60, 20, COLORS.text, 'right', index === 0 && row < 2 ? 2 : 1, !(index === 0 && row < 2) && !(index === 1 && row === 4));
    });
  });
  return out;
}
