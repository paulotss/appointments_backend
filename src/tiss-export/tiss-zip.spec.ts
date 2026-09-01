import { zipStore } from './tiss-zip';

describe('zipStore', () => {
  it('builds a zip that starts with the PK signature', () => {
    const zip = zipStore([
      { name: 'a.xml', data: Buffer.from('<x/>', 'utf8') },
      { name: 'b.xml', data: Buffer.from('<y/>', 'utf8') },
    ]);
    expect(zip.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(zip.includes(Buffer.from('a.xml'))).toBe(true);
    expect(zip.includes(Buffer.from('b.xml'))).toBe(true);
  });
});
