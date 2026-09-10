import { guideDocumentFileName } from './guide-document-name';

describe('guideDocumentFileName', () => {
  it('uses guide number, GUIA and id with the original extension', () => {
    expect(
      guideDocumentFileName({
        guideNumber: '123456',
        guideId: 42,
        originalName: 'scan.PNG',
        mimeType: 'image/png',
      }),
    ).toBe('123456_GUIA_42.png');
  });

  it('falls back to the guide id when the number is missing', () => {
    expect(
      guideDocumentFileName({
        guideNumber: null,
        guideId: 8,
        originalName: 'arquivo.pdf',
        mimeType: 'application/pdf',
      }),
    ).toBe('8_GUIA_8.pdf');
  });

  it('avoids colliding with an existing file name', () => {
    expect(
      guideDocumentFileName({
        guideNumber: 'ABC-1',
        guideId: 3,
        originalName: 'guia.pdf',
        mimeType: 'application/pdf',
        existingNames: ['ABC-1_GUIA_3.pdf'],
      }),
    ).toBe('ABC-1_GUIA_3_2.pdf');
  });
});
