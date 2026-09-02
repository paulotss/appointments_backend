import type { ExtractedGuide } from './extracted-guide';

export const GUIDE_VISION_PROVIDER = 'GUIDE_VISION_PROVIDER';

export type VisionDocument = {
  mimeType: string;
  buffer: Buffer;
};

export interface GuideVisionProvider {
  extract(document: VisionDocument): Promise<ExtractedGuide>;
}
