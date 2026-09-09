import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AskPortalRagDto } from './dto/ask-portal-rag.dto';
import { PortalRagService } from './portal-rag.service';

@ApiTags('portal-rag')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('portal-rag')
export class PortalRagController {
  constructor(private readonly portalRagService: PortalRagService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Verificar disponibilidade do modelo local (Ollama)',
  })
  status() {
    return this.portalRagService.getStatus();
  }

  @Post('ask')
  @ApiOperation({
    summary: 'Perguntar ao assistente interno (RAG do portal)',
  })
  ask(@Body() dto: AskPortalRagDto) {
    return this.portalRagService.ask(dto.question);
  }
}
