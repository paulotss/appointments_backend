import { crc32 } from 'node:zlib';

function u16(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

function u32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

export function zipStore(files: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const localSig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const centralSig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const endSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const crc = crc32(data);
    const local = Buffer.concat([
      localSig,
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    const central = Buffer.concat([
      centralSig,
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    endSig,
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...localParts, central, end]);
}
