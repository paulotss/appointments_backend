import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AskHigiaDto } from './dto/ask-higia.dto';
import { HigiaService, type HigiaStreamEvent } from './higia.service';

function streamErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  }
  return 'Higia model request failed';
}

@ApiTags('higia')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('higia')
export class HigiaController {
  constructor(private readonly higiaService: HigiaService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Verificar se a Higia (OpenRouter) esta configurada',
  })
  status() {
    return this.higiaService.getStatus();
  }

  @Post('ask')
  @ApiOperation({ summary: 'Perguntar a Higia (agente da clinica)' })
  ask(@Body() dto: AskHigiaDto) {
    return this.higiaService.ask(dto.question, dto.history ?? []);
  }

  @Post('ask/stream')
  @ApiOperation({ summary: 'Perguntar a Higia em streaming' })
  @ApiProduces('text/event-stream')
  async askStream(@Body() dto: AskHigiaDto, @Res() res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abort = new AbortController();
    const onClose = () => abort.abort();
    res.on('close', onClose);

    const write = (
      event: HigiaStreamEvent | { type: 'error'; message: string },
    ) => {
      if (res.writableEnded) {
        return;
      }
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const event of this.higiaService.askStream(
        dto.question,
        dto.history ?? [],
        abort.signal,
      )) {
        write(event);
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        write({ type: 'error', message: streamErrorMessage(error) });
      }
    } finally {
      res.off('close', onClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
}
