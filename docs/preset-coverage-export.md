# Selected camera preset coverage reports

File → Export → Selected camera presets produces a ZIP containing one independent
2560 × 1440 PNG per checked preset. Camera order and preset-number order determine
the queue; all reports use the same panel positions, typography, and batch timestamp.
Filenames include the camera's project-order number to distinguish identical labels.

## Layout

The actual rendered camera frame occupies the larger left panel (approximately
65% of the visual width). Its entire 16:9 frame is contained without cropping or
stretching, including foreground obstructions. The header reports the captured
viewport's real pixel dimensions and the preset's focus distance.

The right panel contains the existing architectural drawing, room geometry,
camera markers, labels, scale, and the selected preset's FOV. Other cameras retain
their markers but contribute no translucent FOV cones. Wide/tele comparison cones
are also omitted. Bounds include the physical drawing and its edge labels; coverage
outside those bounds does not shrink the room. Orientation and aspect ratio are
preserved. The plan uses its existing paper/theme colors for readable edge labels.

Four aligned technical panels follow, in this order:

1. **Camera & Optics:** camera model, lens model, effective sensor size, focal
   length (with extender when present), aperture.
2. **Camera Position:** lens elevation, pan, tilt, camera X/Y, mount.
3. **Field of View:** horizontal/vertical viewport FOV, width/height at focus.
4. **Depth of Field:** near focus, far focus, hyperfocal distance.

Report headings/field names are English, with the user's Metric/Imperial preference
applied to lengths. User-authored names and the embedded drawing are retained.
Numbers are right-aligned in a tabular monospace face. Long names wrap to two lines;
exceptionally long text is reduced and then ellipsized to keep it inside its panel.

## Data and coordinates

- The existing preset export queue recalls pan, tilt, focal length, focus distance,
  and saved X/Y/Z when available. Fields not stored by the existing preset format
  (for example aperture or track offset) continue to use the camera's current data.
  This change does not migrate or expand the project schema.
- Position uses `effectiveCameraPos`, including track movement. With plan Y
  increasing downward, report X = effective X and report Y = room depth − effective
  Y. The origin is the room's bottom-left corner, independent of bitmap offsets,
  wall extents, or interactive pan/zoom. Positions outside the room remain signed.
- Lens elevation is the existing camera Z relative to the project floor datum.
- Fixed mounts use the renderer's existing Wall/Ceiling resolver, including
  explicit overrides and the automatic legacy rules. Other mounts retain their
  English names.
- `kameraBildwinkel` supplies horizontal and 16:9 vertical FOV; image height at
  focus is the existing image width × 9/16. Thus a 4:3 sensor's full-sensor vertical
  FOV is not mistakenly reported as the 16:9 camera viewport's FOV.
- `computeDof` and existing unit formatting supply focus limits and hyperfocal
  distance. Infinity is shown as ∞. Camera/lens names come from the real catalog,
  including custom library entries.

## Rendering and isolation

The exporter mounts offscreen instances of the existing `Venue2D` and
`KameraBildHost` components. The plan receives a camera override as a prop; the
camera host receives it as a render argument and scene input, including automatic
facing derived from camera positions. The renderer waits for the matching preset
scene to commit before capturing it. These values never replace live
project cameras or selection. The export host uses the existing high-quality
pipeline and current lighting/look preferences. Its renderer registration is
separate from the preview's registration. No optical formula, physical scene,
interactive camera framing, layout, or view preference is changed to export.

The embedded plan and camera scene must finish loading. A missing catalog entry,
failed capture, loading timeout, or PNG encoding failure is reported per preset;
successful reports still enter the ZIP. Detached roots are disposed on success and
failure. No simple-view fallback or placeholder PNG silently replaces a failure.

The report is 2560 × 1440, but camera capture retains the renderer's current
1280 × 720 ceiling. That source is proportionally scaled and honestly labeled;
the export does not claim a native 1920 × 1080 frame.

The 3D overview is omitted only from this selected-preset report. The application's
3D view and the existing other export modes retain their functionality.

## Validation

Focused tests cover fixed geometry, non-overlap, portrait/wide/square containment,
complete plan bounds, bottom-left coordinates and track offsets, units, fixed mount
resolution, custom optics metadata, 16:9 framing on a 4:3 sensor, DOF/infinity,
long-name wrapping, recalled batch values, partial failures, and input immutability.

Browser checks using an uploaded real project verify two distinct presets, actual
PNG dimensions, ZIP download through the menu/picker, one FOV wedge and all six
camera markers per capture, and unchanged live selection/project data, view
preferences, plan export registration, and interactive plan pan/zoom. A store
subscription records zero writes during the batch. The uploaded project and its
images are not included in this repository.

For manual review: open a project with a calibrated background and multiple presets,
zoom/pan the working plan, select a camera unrelated to the presets, and enable all
FOVs. Export two different presets. Check the PNGs' framing, coverage, coordinates,
mounts, and section values; confirm the working view and selection remain as before.
