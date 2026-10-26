import LengthInput, { OptionalLengthInput } from '../ui/LengthInput';
import { useUnits } from '../../store/units';
import { formatDimensions, lengthUnit } from '../../utils/units';
// Abschnitt „Raum": Decke, Boden, Publikumsflaechen, Videowaende.
//
// Alles optional. Ein Projekt ohne Eintrag hier plant Kameras wie immer,
// und die 3D-Ansicht fuellt den freien Boden selbst mit Publikum. Eine
// Flaeche anlegen heisst: sitzend oder stehend waehlen — Lage, Groesse und
// Drehung macht man im 2D-Plan mit der Maus, die Feinwerte stehen
// eingeklappt darunter.
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { useStore } from '../../store/useStore';
import { useTranslation, format } from '../../i18n';
import { RAUM_BOEDEN, RAUM_WAENDE, sitzblockNormal, sitzblockPlaetze, videowandNormal, type RaumBoden, type RaumWand, type VenueSeatingBlock } from '../../avplan/floorplan';

const zahl = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const feld = 'w-full bg-bc-panel border border-bc-border px-1 py-0.5 text-bc-text-bright text-xs tabular-nums';

function Zahl({ label, value, step, min, max, onChange, title, length = false }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void; title?: string; length?: boolean }) {
  return (
    <label title={title}>
      <span className="text-bc-dim">{label}</span>
      {length ? <LengthInput className={feld} value={value} min={min} max={max} onChange={onChange} /> : <input type="number" className={feld} value={value} step={step} min={min} max={max} onChange={(e) => onChange(Math.min(max, Math.max(min, zahl(e.target.value, value))))} />}
    </label>
  );
}

export default function RoomPanel() {
  const { t } = useTranslation();
  const units = useUnits((s) => s.units);
  const venue = useStore((s) => s.venue);
  const setVenue = useStore((s) => s.setVenue);
  const addSeatingBlock = useStore((s) => s.addSeatingBlock);
  const updateSeatingBlock = useStore((s) => s.updateSeatingBlock);
  const removeSeatingBlock = useStore((s) => s.removeSeatingBlock);
  const addVideoWall = useStore((s) => s.addVideoWall);
  const updateVideoWall = useStore((s) => s.updateVideoWall);
  const removeVideoWall = useStore((s) => s.removeVideoWall);
  const blocks = venue.seatingBlocks ?? [];
  const walls = venue.videoWalls ?? [];

  const bodenName: Record<RaumBoden, string> = {
    concrete: t('room.floor.concrete', 'Concrete'),
    wood: t('room.floor.wood', 'Wood'),
    carpet: t('room.floor.carpet', 'Carpet'),
    turf: t('room.floor.turf', 'Grass'),
    tiles: t('room.floor.tiles', 'Tiles'),
    stage: t('room.floor.stage', 'Black stage floor'),
  };

  const wandName: Record<RaumWand, string> = {
    plaster: t('room.walls.plaster', 'Painted plaster'),
    concrete: t('room.walls.concrete', 'Concrete'),
    brick: t('room.walls.brick', 'Brick'),
    wood: t('room.walls.wood', 'Wood panelling'),
    drape: t('room.walls.drape', 'Black drape'),
  };

  const art = (b: VenueSeatingBlock) => (
    <div className="bc-seg bc-seg-kompakt" role="group" aria-label={t('room.kind', 'Seated or standing')}>
      {([[false, t('room.seated', 'Seated')], [true, t('room.standing', 'Standing')]] as [boolean, string][]).map(([stehend, label]) => (
        <button
          key={label}
          type="button"
          aria-pressed={!!b.standing === stehend}
          onClick={() => updateSeatingBlock(b.id, { standing: stehend })}
          className="px-3 text-[11px] font-medium"
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-2 text-xs" style={{ padding: '0 14px 12px' }}>
      <p className="text-[11px] text-bc-muted">{t('room.hint', 'Optional — only for the 3D view. Without audience areas, the free floor fills with people on its own.')}</p>

      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="text-bc-muted">{format(t('room.ceiling', 'Ceiling ({unit})'), { unit: lengthUnit(units) })}</span>
          <OptionalLengthInput
            className="w-full border border-bc-border bg-bc-panel-raised px-2 py-1 text-bc-text-bright tabular-nums"
            value={venue.ceilingHeightM}
            placeholder={t('room.ceiling.open', 'open')}
            min={2}
            title={t('room.ceiling.title', 'Leave empty for an open-air venue or a hall whose ceiling should not be drawn')}
            onChange={(v) => {
              const { ceilingHeightM: _, ...rest } = venue;
              setVenue(v !== undefined ? { ...rest, ceilingHeightM: v } : rest);
            }}
          />
        </label>
        <label>
          <span className="text-bc-muted">{t('room.floor', 'Floor')}</span>
          <select
            className="w-full border border-bc-border bg-bc-panel-raised px-2 py-1 text-bc-text-bright"
            value={venue.floorMaterial ?? 'concrete'}
            onChange={(e) => setVenue({ ...venue, floorMaterial: e.target.value as RaumBoden })}
          >
            {RAUM_BOEDEN.map((b) => <option key={b} value={b}>{bodenName[b]}</option>)}
          </select>
        </label>
        <label className="col-span-2">
          <span className="text-bc-muted">{t('room.walls', 'Walls')}</span>
          <select
            className="w-full bg-bc-dark border border-bc-border px-2 py-1 text-bc-text-bright"
            value={venue.wallMaterial ?? ''}
            title={t('room.walls.title', 'Surface of the hall walls and of every drawn wall in the 3D view. Painted plaster takes each wall\'s own colour.')}
            onChange={(e) => {
              const { wallMaterial: _, ...rest } = venue;
              setVenue(e.target.value ? { ...rest, wallMaterial: e.target.value as RaumWand } : rest);
            }}
          >
            <option value="">{t('room.walls.plain', 'Plain colour')}</option>
            {RAUM_WAENDE.map((w) => <option key={w} value={w}>{wandName[w]}</option>)}
          </select>
        </label>
      </div>

      <div className="pt-1 text-[13px] font-semibold text-bc-text-bright">{t('room.audience', 'Audience')}</div>
      {blocks.map((roh) => {
        const b = sitzblockNormal(roh);
        return (
          <div key={b.id} className="bg-bc-dark p-2 border border-bc-border space-y-1">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 min-w-0 bg-transparent text-bc-text-bright text-xs font-semibold outline-none"
                value={roh.label ?? ''}
                placeholder={b.standing ? t('room.standing', 'Standing') : t('room.seated', 'Seated')}
                aria-label={t('room.name', 'Name')}
                onChange={(e) => updateSeatingBlock(b.id, { label: e.target.value })}
              />
              {art(roh)}
              <button onClick={() => removeSeatingBlock(b.id)} style={{ padding: '4px' }} className="hover:text-bc-red-text" title={t('room.remove', 'Remove')} aria-label={t('room.remove', 'Remove')}>
                <FiTrash2 size={12} />
              </button>
            </div>
            <div className="text-[11px] text-bc-muted tabular-nums">
              {format(t('room.summary', '{dims} · about {n} people'), { dims: formatDimensions(b.width, b.rows * b.rowSpacingM, units), n: Math.round(sitzblockPlaetze(b) * b.occupancy) })}
            </div>
            <details>
              <summary className="cursor-pointer text-[11px] text-bc-dim hover:text-bc-text">{t('room.details', 'Fine-tune')}</summary>
              <div className="grid grid-cols-3 gap-1 pt-1">
                <Zahl length label={format(t('room.x', 'X ({unit})'), { unit: lengthUnit(units) })} value={b.x} step={0.1} min={-10000} max={10000} title={t('room.x.title', 'Centre, from the left edge of the plan')} onChange={(v) => updateSeatingBlock(b.id, { x: v })} />
                <Zahl length label={format(t('room.y', 'Y ({unit})'), { unit: lengthUnit(units) })} value={b.y} step={0.1} min={-10000} max={10000} title={t('room.y.title', 'Centre, from the top edge of the plan')} onChange={(v) => updateSeatingBlock(b.id, { y: v })} />
                <Zahl label={t('room.rows', 'Rows')} value={b.rows} step={1} min={1} max={200} onChange={(v) => updateSeatingBlock(b.id, { rows: Math.round(v) })} />
                <Zahl length label={format(t('room.rowSpacing', 'Row gap ({unit})'), { unit: lengthUnit(units) })} value={b.rowSpacingM} step={0.05} min={0.4} max={3} onChange={(v) => updateSeatingBlock(b.id, { rowSpacingM: v })} />
                <Zahl length label={format(t('room.width', 'Width ({unit})'), { unit: lengthUnit(units) })} value={b.width} step={0.5} min={1} max={2000} onChange={(v) => updateSeatingBlock(b.id, { width: v })} />
                <Zahl length label={format(t('room.rise', 'Rise ({unit})'), { unit: lengthUnit(units) })} value={b.riseM} step={0.05} min={0} max={1.5} title={t('room.rise.title', 'Step per row — 0 is a flat floor, about 0.45 a stadium stand')} onChange={(v) => updateSeatingBlock(b.id, { riseM: v })} />
                <Zahl length label={format(t('room.base', 'Height ({unit})'), { unit: lengthUnit(units) })} value={b.baseHeightM} step={0.5} min={0} max={80} title={t('room.base.title', 'Height of the first row above the floor (upper tier)')} onChange={(v) => updateSeatingBlock(b.id, { baseHeightM: v })} />
                <Zahl label={t('room.occupancy', 'Full %')} value={Math.round(b.occupancy * 100)} step={5} min={0} max={100} onChange={(v) => updateSeatingBlock(b.id, { occupancy: v / 100 })} />
                <Zahl label={t('room.rotation', 'Turn °')} value={b.rotationDeg} step={0.1} min={-1000000000} max={1000000000} onChange={(v) => updateSeatingBlock(b.id, { rotationDeg: v })} />
              </div>
            </details>
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-1">
        <button onClick={() => addSeatingBlock(false)} className="flex items-center justify-center gap-1 px-2 py-1 bg-bc-accent/20 text-bc-accent text-xs hover:bg-bc-accent/30">
          <FiPlus size={12} /> {t('room.addSeated', 'Seated area')}
        </button>
        <button onClick={() => addSeatingBlock(true)} className="flex items-center justify-center gap-1 px-2 py-1 bg-bc-accent/20 text-bc-accent text-xs hover:bg-bc-accent/30">
          <FiPlus size={12} /> {t('room.addStanding', 'Standing area')}
        </button>
      </div>

      <div className="pt-1 text-[13px] font-semibold text-bc-text-bright">{t('room.videoWalls', 'Video walls')}</div>
      {walls.map((roh) => {
        const w = videowandNormal(roh);
        return (
          <div key={w.id} className="bg-bc-dark p-2 border border-bc-border space-y-1">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 min-w-0 bg-transparent text-bc-text-bright text-xs font-semibold outline-none"
                value={roh.label ?? ''}
                placeholder={t('room.videoWall', 'Video wall')}
                aria-label={t('room.name', 'Name')}
                onChange={(e) => updateVideoWall(w.id, { label: e.target.value })}
              />
              <button onClick={() => removeVideoWall(w.id)} style={{ padding: '4px' }} className="hover:text-bc-red-text" title={t('room.remove', 'Remove')} aria-label={t('room.remove', 'Remove')}>
                <FiTrash2 size={12} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <label>Display type<select value={w.displayType} onChange={(e) => updateVideoWall(w.id, { displayType: e.target.value as 'monitor' | 'led-wall' })}><option value="led-wall">LED wall</option><option value="monitor">Monitor</option></select></label>
              {w.displayType === 'monitor' && <><label>Diagonal inches<select defaultValue="" onChange={(e) => { const diagonal = Number(e.target.value) * 0.0254; const ratio = w.widthM / w.heightM; const heightM = diagonal / Math.sqrt(ratio * ratio + 1); updateVideoWall(w.id, { heightM, widthM: heightM * ratio }); }}><option value="" disabled>Custom</option>{[24,32,43,55,65,75,85,98].map(n => <option key={n} value={n}>{n}″</option>)}</select></label><label>Aspect ratio<select defaultValue="" onChange={(e) => updateVideoWall(w.id, { heightM: w.widthM / Number(e.target.value) })}><option value="" disabled>Custom</option><option value={16/9}>16:9</option><option value={4/3}>4:3</option><option value={21/9}>21:9</option><option value={9/16}>9:16</option></select></label></>}
              <Zahl length label={format(t('room.x', 'X ({unit})'), { unit: lengthUnit(units) })} value={w.x} step={0.1} min={-10000} max={10000} title={t('room.wallX.title', 'Centre of the lower edge, from the left edge of the plan')} onChange={(v) => updateVideoWall(w.id, { x: v })} />
              <Zahl length label={format(t('room.y', 'Y ({unit})'), { unit: lengthUnit(units) })} value={w.y} step={0.1} min={-10000} max={10000} title={t('room.wallY.title', 'Centre of the lower edge, from the top edge of the plan')} onChange={(v) => updateVideoWall(w.id, { y: v })} />
              <Zahl length label={format(t('room.z', 'Z ({unit})'), { unit: lengthUnit(units) })} value={w.bottomM} step={0.25} min={0} max={200} title={t('room.bottom.title', 'Lower edge above the floor')} onChange={(v) => updateVideoWall(w.id, { bottomM: v })} />
              <Zahl label={t('room.rotation', 'Turn °')} value={w.rotationDeg} step={0.1} min={-1000000000} max={1000000000} onChange={(v) => updateVideoWall(w.id, { rotationDeg: v })} />
              <Zahl length label={format(t('room.width', 'Width ({unit})'), { unit: lengthUnit(units) })} value={w.widthM} step={0.5} min={0.5} max={400} onChange={(v) => updateVideoWall(w.id, { widthM: v })} />
              <Zahl length label={format(t('room.height', 'Height ({unit})'), { unit: lengthUnit(units) })} value={w.heightM} step={0.25} min={0.25} max={200} onChange={(v) => updateVideoWall(w.id, { heightM: v })} />
            </div>
          </div>
        );
      })}
      <button onClick={() => addVideoWall('monitor')} className="text-bc-accent">+ Monitor</button>
      <button onClick={() => addVideoWall()} className="flex items-center gap-1 px-2 py-1 bg-bc-accent/20 text-bc-accent text-xs hover:bg-bc-accent/30 w-full justify-center">
        <FiPlus size={12} /> {t('room.addVideoWall', 'Video wall')}
      </button>
    </div>
  );
}
