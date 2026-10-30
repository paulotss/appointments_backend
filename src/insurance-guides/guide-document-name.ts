export function guideDocumentFileName(params: {
  guideNumber: string | null;
  guideId: number;
  originalName: string;
  mimeType: string;
  existingNames?: string[];
}): string {
  const ext = extensionOf(params.originalName, params.mimeType);
  const numberPart = guideNumberPart(params.guideNumber, params.guideId);
  const used = documentIndexes(params.existingNames ?? [], numberPart);
  let index = 1;
  while (used.has(index)) {
    index += 1;
  }
  return `${numberPart}_GUIA_doc${index}${ext}`;
}

export function plannedGuideDocumentNames<T extends GuideDocumentIdentity>(
  documents: T[],
  guideNumber: string | null,
  guideId: number,
): Array<T & { fileName: string; storageKeyTarget: string }> {
  const numberPart = guideNumberPart(guideNumber, guideId);
  return [...documents]
    .sort((left, right) => left.id - right.id)
    .map((document, index) => {
      const fileName = `${numberPart}_GUIA_doc${index + 1}${extensionOf(
        document.originalName,
        document.mimeType,
      )}`;
      return {
        ...document,
        fileName,
        storageKeyTarget: guideDocumentStorageKey(guideId, fileName),
      };
    });
}

export function guideDocumentStorageKey(guideId: number, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `guides/${guideId}/${safeName}`;
}

export interface GuideDocumentIdentity {
  id: number;
  originalName: string;
  mimeType: string;
  storageKey: string;
}

export async function renameGuideDocumentFiles(params: {
  guideId: number;
  guideNumber: string | null;
  documents: GuideDocumentIdentity[];
  copy: (sourceKey: string, destinationKey: string) => Promise<void>;
  remove: (storageKey: string) => Promise<void>;
  update: (
    id: number,
    data: { originalName: string; storageKey: string },
  ) => Promise<void>;
}): Promise<number> {
  const planned = plannedGuideDocumentNames(
    params.documents,
    params.guideNumber,
    params.guideId,
  );
  const pending = planned.filter(
    (document) =>
      document.originalName !== document.fileName ||
      document.storageKey !== document.storageKeyTarget,
  );
  if (pending.length === 0) {
    return 0;
  }

  const staged = pending.map((document) => ({
    ...document,
    tempKey: `guides/${params.guideId}/_rename_${document.id}${extensionOf(
      document.originalName,
      document.mimeType,
    )}`,
  }));

  for (const document of staged) {
    if (document.storageKey !== document.tempKey) {
      await params.copy(document.storageKey, document.tempKey);
    }
  }
  for (const document of staged) {
    await params.update(document.id, {
      originalName: document.fileName,
      storageKey: document.tempKey,
    });
  }
  for (const document of staged) {
    if (document.storageKey !== document.tempKey) {
      await params.remove(document.storageKey);
    }
  }
  for (const document of staged) {
    if (document.tempKey !== document.storageKeyTarget) {
      await params.copy(document.tempKey, document.storageKeyTarget);
    }
    await params.update(document.id, {
      originalName: document.fileName,
      storageKey: document.storageKeyTarget,
    });
    if (document.tempKey !== document.storageKeyTarget) {
      await params.remove(document.tempKey);
    }
  }
  return staged.length;
}

function guideNumberPart(guideNumber: string | null, guideId: number): string {
  return sanitizeGuideNumber(guideNumber) ?? String(guideId);
}

function documentIndexes(existingNames: string[], numberPart: string): Set<number> {
  const pattern = new RegExp(
    `^${escapeRegExp(numberPart)}_GUIA_doc(\\d+)\\.[a-z0-9]+$`,
    'i',
  );
  const used = new Set<number>();
  for (const name of existingNames) {
    const match = name.match(pattern);
    if (match) {
      used.add(Number(match[1]));
    }
  }
  return used;
}

function sanitizeGuideNumber(value: string | null): string | null {
  if (value == null) {
    return null;
  }
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.length === 0 ? null : sanitized;
}

function extensionOf(originalName: string, mimeType: string): string {
  const match = originalName.match(/(\.[a-zA-Z0-9]+)$/);
  if (match) {
    const ext = match[1].toLowerCase();
    return ext === '.jpeg' ? '.jpg' : ext;
  }
  if (mimeType === 'application/pdf') {
    return '.pdf';
  }
  if (mimeType === 'image/png') {
    return '.png';
  }
  return '.jpg';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
