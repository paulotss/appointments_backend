export function guideDocumentFileName(params: {
  guideNumber: string | null;
  guideId: number;
  originalName: string;
  mimeType: string;
  existingNames?: string[];
}): string {
  const ext = extensionOf(params.originalName, params.mimeType);
  const numberPart =
    sanitizeGuideNumber(params.guideNumber) ?? String(params.guideId);
  const base = `${numberPart}_GUIA_${params.guideId}`;
  const existing = new Set(params.existingNames ?? []);
  let name = `${base}${ext}`;
  let suffix = 2;
  while (existing.has(name)) {
    name = `${base}_${suffix}${ext}`;
    suffix += 1;
  }
  return name;
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
