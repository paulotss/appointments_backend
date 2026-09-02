import { Module } from '@nestjs/common';
import { InsuranceGuidesModule } from '../insurance-guides/insurance-guides.module';
import { GeminiGuideVisionProvider } from './gemini-guide-vision.provider';
import { GuideImportMatcher } from './guide-import.matcher';
import { GuideImportsController } from './guide-imports.controller';
import { GuideImportsService } from './guide-imports.service';
import { createGuideVisionProvider } from './guide-vision.factory';
import { GUIDE_VISION_PROVIDER } from './guide-vision.provider';
import { OllamaGuideVisionProvider } from './ollama-guide-vision.provider';

@Module({
  imports: [InsuranceGuidesModule],
  controllers: [GuideImportsController],
  providers: [
    GuideImportsService,
    GuideImportMatcher,
    GeminiGuideVisionProvider,
    OllamaGuideVisionProvider,
    {
      provide: GUIDE_VISION_PROVIDER,
      useFactory: createGuideVisionProvider,
    },
  ],
})
export class GuideImportsModule {}
