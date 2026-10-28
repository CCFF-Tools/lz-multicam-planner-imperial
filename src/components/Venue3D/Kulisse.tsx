// Die Halle ohne Planungs-Beiwerk: Licht, Raum, Buehnen, Publikum,
// LED-Waende und gezeichnete Waende. Die 3D-Ansicht legt ihre Werkzeuge
// (Raster, Abdeckung, Kameras) darueber; die gerenderten Kamerabilder in
// Vorschau und Multiview zeigen genau diese Kulisse (#167, #168).
import { useEffect, useMemo, type ReactNode } from 'react';
import type { Stage } from '../../types';
import type { RaumWand } from '../../avplan/floorplan';
import type { StufenWerte } from '../../avplan/scene3d';
import { istSpielfeld } from '../../utils/showRig';
import { wandDicke, wandOeffnungStuecke, wandOeffnungsLaibungen, wandStuecke } from '../../utils/wallOpenings';
import { wallBoxGeometry } from '../../utils/wallGeometry';
import { wallIsCurved, wallPathLength } from '../../utils/wallPath';
import { Arena, CrowdAndSeating, FieldMesh, LedWalls, ShowRig, StageBodyReal, WallSurfaceMaterial } from './ShowScene';
import type { KulissenDaten } from './kulissenDaten';

function WallBoxGeometry({ lengthM, heightM, thicknessM, startCap, endCap }: {
  lengthM: number;
  heightM: number;
  thicknessM: number;
  startCap: boolean;
  endCap: boolean;
}) {
  const geometry = useMemo(
    () => wallBoxGeometry(lengthM, heightM, thicknessM, { start: startCap, end: endCap }),
    [lengthM, heightM, thicknessM, startCap, endCap],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

function WallMaterial({ art, lengthM, heightM, color, show }: {
  art?: RaumWand;
  lengthM: number;
  heightM: number;
  color?: string;
  show: boolean;
}) {
  if (art) return <WallSurfaceMaterial art={art} laengeM={lengthM} hoeheM={heightM} farbe={color} />;
  return show
    ? <meshStandardMaterial color={color ?? '#3a3d42'} roughness={0.9} />
    : <meshStandardMaterial color={color ?? '#6b7280'} opacity={0.6} transparent />;
}

export function Kulisse({ daten, show, tageslicht = false, simple, werte, audience, planungsBoden, einfacheBuehne, cameraView = false }: {
  daten: KulissenDaten;
  /** Showlicht an. */
  show: boolean;
  /** Unter freiem Himmel: Himmel und Sonne bringen ihr Licht selbst mit. */
  tageslicht?: boolean;
  /** Einfache Darstellung: weniger Publikum. */
  simple: boolean;
  werte: StufenWerte;
  audience: boolean;
  /** Boden ohne Showlicht, je Thema (planungsLook). */
  planungsBoden?: string;
  /** Buehne ohne Showlicht; fehlt sie, steht auch dann der echte Koerper da. */
  einfacheBuehne?: (stage: Stage) => ReactNode;
  cameraView?: boolean;
}) {
  const { venue, walls, diag, boardLook, draussen, ledWaende, audienceCams, audiencePersons } = daten;
  return (
    <>
      {show ? (
        <>
          {!tageslicht && (
            <>
              <hemisphereLight args={['#8ea2d8', '#0d0a08', draussen ? 0.18 : 0.08]} />
              {/* Streulicht von der Buehne ins Publikum: ohne es waere die Menge ein schwarzes Loch. */}
              <directionalLight position={[boardLook.x, 18, boardLook.y - diag]} intensity={0.22} color="#7f93ff" />
            </>
          )}
          <ShowRig venue={venue} look={boardLook} werte={werte} draussen={draussen || tageslicht} />
        </>
      ) : (
        <>
          <ambientLight intensity={0.7} color="#e8eaf0" />
          <directionalLight position={[10, 20, 10]} intensity={1.0} color="#ffffff" />
          <directionalLight position={[-10, 15, -5]} intensity={0.3} color="#94a3b8" />
          <hemisphereLight args={['#b0c4de', '#1e293b', 0.4]} />
        </>
      )}

      <Arena venue={venue} show={show} offen={tageslicht} planungsBoden={planungsBoden} showCeiling={cameraView || show} />

      {venue.stages.map((s) => (
        !show && einfacheBuehne
          ? <group key={s.id}>{einfacheBuehne(s)}</group>
          : (istSpielfeld(s) ? <FieldMesh key={s.id} stage={s} /> : <StageBodyReal key={s.id} stage={s} />)
      ))}

      {audience && (
        <CrowdAndSeating
          venue={venue}
          cameras={audienceCams}
          persons={audiencePersons}
          walls={walls}
          max={simple ? 4000 : werte.ao ? 40000 : 15000}
        />
      )}
      {ledWaende.length > 0 && <LedWalls walls={ledWaende} maxLichter={show && werte.ao ? 1 : 0} />}

      {walls.map((w) => {
        const dicke = wandDicke(w);
        const curved = wallIsCurved(w);
        const pathLength = wallPathLength(w);
        const direction = pathLength > 1e-6 ? { x: (w.x2 - w.x1) / pathLength, y: (w.y2 - w.y1) / pathLength } : { x: 1, y: 0 };
        return (
          <group key={w.id}>
            {wandStuecke(w, w.height).map((st, i) => {
              const along = (st.x - w.x1) * direction.x + (st.y - w.y1) * direction.y;
              const startCap = curved || along - st.laenge / 2 <= 1e-5;
              const endCap = curved || along + st.laenge / 2 >= pathLength - 1e-5;
              return (
                <mesh key={`wall-${i}`} position={[st.x, st.unten + st.hoehe / 2, st.y]} rotation={[0, -st.winkel, 0]}>
                  <WallBoxGeometry lengthM={st.laenge} heightM={st.hoehe} thicknessM={dicke} startCap={startCap} endCap={endCap} />
                  <WallMaterial art={venue.wallMaterial} lengthM={st.laenge} heightM={st.hoehe} color={w.color} show={show} />
                </mesh>
              );
            })}
            {!curved && wandOeffnungsLaibungen(w, w.height).map((cap, index) => (
              <mesh key={`reveal-${index}`} position={[cap.x, cap.unten + cap.hoehe / 2, cap.y]} rotation={[0, -cap.winkel, 0]}>
                <boxGeometry args={[0.004, cap.hoehe, dicke]} />
                <WallMaterial art={venue.wallMaterial} lengthM={dicke} heightM={cap.hoehe} color={w.color} show={show} />
              </mesh>
            ))}
            {(w.openings ?? []).flatMap((opening, openingIndex) => {
              // Legacy and plan-detected generic openings remain empty holes.
              if (opening.kind !== 'door' && opening.kind !== 'window') return [];
              const bounded = {
                ...opening,
                bottom: Math.max(0, Math.min(w.height, opening.bottom)),
                top: Math.max(0, Math.min(w.height, opening.top)),
              };
              const glass = opening.kind === 'window' || opening.material === 'glass';
              const material = opening.material ?? 'solid';
              const color = opening.color ?? (material === 'wood' ? '#8b5a2b' : material === 'metal' ? '#64748b' : '#6b4f3a');
              return wandOeffnungStuecke(w, bounded).map((piece, pieceIndex) => (
                <mesh key={`opening-${opening.id ?? openingIndex}-${pieceIndex}`} position={[piece.x, piece.unten + piece.hoehe / 2, piece.y]} rotation={[0, -piece.winkel, 0]}>
                  <boxGeometry args={[piece.laenge, piece.hoehe, Math.max(0.025, dicke * 0.35)]} />
                  {glass
                    ? <meshPhysicalMaterial color="#79cfe8" roughness={0.08} metalness={0.02} transmission={0.55} transparent opacity={0.38} depthWrite={false} />
                    : <meshStandardMaterial color={color} roughness={material === 'metal' ? 0.28 : material === 'wood' ? 0.82 : 0.65} metalness={material === 'metal' ? 0.72 : 0.03} />}
                </mesh>
              ));
            })}
          </group>
        );
      })}
    </>
  );
}
