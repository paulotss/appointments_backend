import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CLINICAL_STAFF_ROLES } from '../auth/roles';
import type { UploadedFile as UploadedFilePayload } from '../uploads/uploaded-file';
import { CreateGeneratedPatientFileDto } from './dto/create-generated-patient-file.dto';
import { UpdateGeneratedPatientFileDto } from './dto/update-generated-patient-file.dto';
import { PatientFilesService } from './patient-files.service';

@ApiTags('patient-files')
@Roles(...CLINICAL_STAFF_ROLES)
@Controller('patients/:patientId/files')
export class PatientFilesController {
  constructor(private readonly patientFilesService: PatientFilesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar arquivos do paciente' })
  @ApiParam({ name: 'patientId', example: 1 })
  list(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.patientFilesService.list(patientId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: {
          type: 'string',
          enum: ['MEDICAL_ORDER', 'PRESCRIPTION', 'OTHER'],
        },
      },
    },
  })
  @ApiOperation({ summary: 'Enviar arquivo do paciente' })
  @ApiParam({ name: 'patientId', example: 1 })
  upload(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body('kind') kind: string,
    @UploadedFile() file: UploadedFilePayload,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.patientFilesService.upload(patientId, kind, file, user);
  }

  @Post('generated')
  @ApiOperation({ summary: 'Criar receituário ou pedido médico' })
  @ApiParam({ name: 'patientId', example: 1 })
  createGenerated(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: CreateGeneratedPatientFileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.patientFilesService.createGenerated(patientId, dto, user);
  }

  @Patch(':fileId')
  @ApiOperation({ summary: 'Alterar documento gerado do paciente' })
  @ApiParam({ name: 'patientId', example: 1 })
  @ApiParam({ name: 'fileId', example: 1 })
  updateGenerated(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Body() dto: UpdateGeneratedPatientFileDto,
  ) {
    return this.patientFilesService.updateGenerated(patientId, fileId, dto);
  }

  @Get(':fileId/download')
  @ApiOperation({ summary: 'Baixar arquivo enviado do paciente' })
  @ApiParam({ name: 'patientId', example: 1 })
  @ApiParam({ name: 'fileId', example: 1 })
  async download(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    const { file, stream } = await this.patientFilesService.open(
      patientId,
      fileId,
    );
    return new StreamableFile(stream, {
      type: file.mimeType ?? 'application/octet-stream',
      disposition: `attachment; filename="${encodeURIComponent(file.originalName ?? 'arquivo')}"`,
    });
  }

  @Delete(':fileId')
  @ApiOperation({ summary: 'Remover arquivo do paciente' })
  @ApiParam({ name: 'patientId', example: 1 })
  @ApiParam({ name: 'fileId', example: 1 })
  remove(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    return this.patientFilesService.remove(patientId, fileId);
  }
}
