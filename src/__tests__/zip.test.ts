import { describe, expect, it } from 'vitest';
import { createZip } from '../utils/zip';

const text = new TextEncoder();

describe('batch export ZIP', () => {
  it('contains every file in one valid stored archive', async () => {
    const zip = new Uint8Array(await (await createZip([
      { name: 'CAM 1_wide.png', data: text.encode('wide') },
      { name: 'CAM 1_tele.png', data: text.encode('tele') },
    ], new Date(2026, 9, 27, 12, 0, 0))).arrayBuffer());
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 22 + 10, true)).toBe(2);
    const decoded = new TextDecoder().decode(zip);
    expect(decoded).toContain('CAM 1_wide.png');
    expect(decoded).toContain('CAM 1_tele.png');
  });

  it('keeps duplicate camera labels from overwriting archive entries', async () => {
    const zip = new TextDecoder().decode(new Uint8Array(await (await createZip([
      { name: 'CAM.png', data: text.encode('one') },
      { name: 'CAM.png', data: text.encode('two') },
    ])).arrayBuffer()));
    expect(zip).toContain('CAM.png');
    expect(zip).toContain('CAM_2.png');
  });
});
