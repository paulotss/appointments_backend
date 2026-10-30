import {
  guideDocumentFileName,
  plannedGuideDocumentNames,
  renameGuideDocumentFiles,
} from './guide-document-name';

describe('guideDocumentFileName', () => {
  it('names the first image with the guide number and doc1', () => {
    expect(
      guideDocumentFileName({
        guideNumber: '1870872796',
        guideId: 42,
        originalName: 'scan.JPEG',
        mimeType: 'image/jpeg',
      }),
    ).toBe('1870872796_GUIA_doc1.jpg');
  });

  it('continues the sequence from names already stored', () => {
    expect(
      guideDocumentFileName({
        guideNumber: '1870872796',
        guideId: 42,
        originalName: 'outra.png',
        mimeType: 'image/png',
        existingNames: ['1870872796_GUIA_doc1.jpg'],
      }),
    ).toBe('1870872796_GUIA_doc2.png');
  });

  it('fills a gap instead of reusing an existing doc number', () => {
    expect(
      guideDocumentFileName({
        guideNumber: '1870872796',
        guideId: 42,
        originalName: 'guia.pdf',
        mimeType: 'application/pdf',
        existingNames: ['1870872796_GUIA_doc1.jpg', '1870872796_GUIA_doc3.pdf'],
      }),
    ).toBe('1870872796_GUIA_doc2.pdf');
  });

  it('falls back to the guide id when the number is missing', () => {
    expect(
      guideDocumentFileName({
        guideNumber: null,
        guideId: 8,
        originalName: 'arquivo.pdf',
        mimeType: 'application/pdf',
      }),
    ).toBe('8_GUIA_doc1.pdf');
  });
});

describe('plannedGuideDocumentNames', () => {
  it('assigns doc numbers by document id order', () => {
    expect(
      plannedGuideDocumentNames(
        [
          {
            id: 20,
            originalName: '1870872796_GUIA_9.jpg',
            mimeType: 'image/jpeg',
            storageKey: 'guides/9/1870872796_GUIA_9.jpg',
          },
          {
            id: 11,
            originalName: 'foto.png',
            mimeType: 'image/png',
            storageKey: 'guides/9/foto.png',
          },
        ],
        '1870872796',
        9,
      ).map((item) => ({ id: item.id, fileName: item.fileName })),
    ).toEqual([
      { id: 11, fileName: '1870872796_GUIA_doc1.png' },
      { id: 20, fileName: '1870872796_GUIA_doc2.jpg' },
    ]);
  });
});

describe('renameGuideDocumentFiles', () => {
  it('copies each object to the new key and removes the previous one', async () => {
    const stored = new Map<string, string>([
      ['guides/9/1870872796_GUIA_9.jpg', 'a'],
      ['guides/9/foto.png', 'b'],
    ]);
    const rows = [
      {
        id: 11,
        originalName: 'foto.png',
        mimeType: 'image/png',
        storageKey: 'guides/9/foto.png',
      },
      {
        id: 20,
        originalName: '1870872796_GUIA_9.jpg',
        mimeType: 'image/jpeg',
        storageKey: 'guides/9/1870872796_GUIA_9.jpg',
      },
    ];

    const renamed = await renameGuideDocumentFiles({
      guideId: 9,
      guideNumber: '1870872796',
      documents: rows,
      copy: async (source, destination) => {
        const body = stored.get(source);
        if (body == null) throw new Error(`missing ${source}`);
        stored.set(destination, body);
      },
      remove: async (key) => {
        stored.delete(key);
      },
      update: async (id, data) => {
        const row = rows.find((item) => item.id === id);
        if (!row) throw new Error(`missing row ${id}`);
        row.originalName = data.originalName;
        row.storageKey = data.storageKey;
      },
    });

    expect(renamed).toBe(2);
    expect(rows.map((row) => row.originalName)).toEqual([
      '1870872796_GUIA_doc1.png',
      '1870872796_GUIA_doc2.jpg',
    ]);
    expect(stored.get('guides/9/1870872796_GUIA_doc1.png')).toBe('b');
    expect(stored.get('guides/9/1870872796_GUIA_doc2.jpg')).toBe('a');
    expect(stored.has('guides/9/foto.png')).toBe(false);
    expect(stored.has('guides/9/1870872796_GUIA_9.jpg')).toBe(false);
  });

  it('leaves documents that already follow the pattern', async () => {
    const copy = jest.fn();
    const renamed = await renameGuideDocumentFiles({
      guideId: 9,
      guideNumber: '1870872796',
      documents: [
        {
          id: 1,
          originalName: '1870872796_GUIA_doc1.jpg',
          mimeType: 'image/jpeg',
          storageKey: 'guides/9/1870872796_GUIA_doc1.jpg',
        },
      ],
      copy,
      remove: jest.fn(),
      update: jest.fn(),
    });
    expect(renamed).toBe(0);
    expect(copy).not.toHaveBeenCalled();
  });
});
