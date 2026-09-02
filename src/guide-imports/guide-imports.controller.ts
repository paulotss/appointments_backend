import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UploadedFile as UploadedFilePayload } from '../uploads/uploaded-file';
import { CommitGuideImportDto } from './dto/commit-guide-import.dto';
import { MatchGuideImportDto } from './dto/extracted-guide.dto';
import { GuideImportsService } from './guide-imports.service';

@ApiTags('guide-imports')
@Controller('guide-imports')
export class GuideImportsController {
  constructor(private readonly guideImportsService: GuideImportsService) {}

  @Post('analyze')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Analisar imagem ou PDF de guia TISS',
    description:
      'Envia o documento a um modelo de visao, extrai os dados e cruza com cadastros existentes. Nao grava a guia.',
  })
  analyze(@UploadedFile() file: UploadedFilePayload) {
    return this.guideImportsService.analyze(file);
  }

  @Post('match')
  @ApiOperation({
    summary: 'Recruzar dados extraidos com cadastros',
    description:
      'Nao chama a IA. Use depois de cadastrar plano, profissional ou procedimento que faltava.',
  })
  match(@Body() dto: MatchGuideImportDto) {
    return this.guideImportsService.matchExtracted(dto.extracted);
  }

  @Post('commit')
  @ApiOperation({
    summary: 'Confirmar importacao da guia',
    description:
      'Cria o paciente e a carteirinha se necessario e cadastra a guia. Plano, profissional e procedimento precisam ja existir.',
  })
  commit(@Body() dto: CommitGuideImportDto) {
    return this.guideImportsService.commit(dto);
  }
}
