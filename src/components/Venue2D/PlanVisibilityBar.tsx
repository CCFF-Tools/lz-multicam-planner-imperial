import type { ReactNode } from 'react';
import { FiCamera, FiEye, FiEyeOff, FiGrid, FiMap, FiSquare, FiUser } from 'react-icons/fi';
import { useTranslation } from '../../i18n';
import type { PlanVisibility, PlanVisibilityKey } from './planVisibility';

export default function PlanVisibilityBar({ value, onToggle }: { value: PlanVisibility; onToggle: (key: PlanVisibilityKey) => void }) {
  const { t } = useTranslation();
  const items: { key: PlanVisibilityKey; icon: ReactNode; label: string; title: string }[] = [
    { key: 'floorplan', icon: <FiMap size={12} />, label: t('venue.groups.floorplan', 'Floor plan'), title: t('venue.visibility.floorplan', 'Floor plan and walls') },
    { key: 'stage', icon: <FiSquare size={12} />, label: t('venue.groups.stage', 'Stage'), title: t('venue.visibility.stage', 'Stages') },
    { key: 'room', icon: <FiGrid size={12} />, label: t('venue.groups.room', 'Room'), title: t('venue.visibility.room', 'Audience areas and displays') },
    { key: 'objects', icon: <FiUser size={12} />, label: t('venue.groups.objects', 'Objects'), title: t('venue.visibility.objects', 'People and objects') },
    { key: 'cameras', icon: <FiCamera size={12} />, label: t('venue.groups.cameras', 'Cameras'), title: t('venue.visibility.cameras', 'Cameras, rigs, FOV and depth of field') },
  ];

  return (
    <div
      role="group"
      aria-label={t('venue.visibility', 'Visible in the plan')}
      className="absolute left-2 top-14 z-10 flex max-w-[calc(100%-80px)] items-center gap-0.5 rounded-bc-m border border-bc-border bg-bc-panel/85 p-1 shadow-bc-1 backdrop-blur"
    >
      <FiEye size={13} className="mx-1 shrink-0 text-bc-muted" aria-hidden />
      {items.map((item) => {
        const visible = value[item.key];
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={visible}
            onClick={() => onToggle(item.key)}
            title={`${item.title} — ${visible ? t('venue.visibility.hide', 'click to hide') : t('venue.visibility.show', 'click to show')}`}
            className={`flex min-h-7 items-center gap-1 rounded-bc-s px-1.5 text-[11px] font-medium transition-colors [@media(pointer:coarse)]:min-h-10 ${
              visible ? 'bg-bc-accent/15 text-bc-accent hover:bg-bc-accent/25' : 'text-bc-dim hover:bg-bc-panel-raised hover:text-bc-text'
            }`}
          >
            {visible ? item.icon : <FiEyeOff size={12} />}
            <span className="hidden md:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
