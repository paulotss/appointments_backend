import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicProfileService } from './clinic-profile.service';
import { UpsertClinicProfileDto } from './dto/upsert-clinic-profile.dto';

@ApiTags('clinic-profile')
@Controller('clinic-profile')
export class ClinicProfileController {
  constructor(private readonly clinicProfileService: ClinicProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Obter cadastro da clinica (prestador TISS)' })
  find() {
    return this.clinicProfileService.find();
  }

  @Put()
  @ApiOperation({ summary: 'Atualizar cadastro da clinica (prestador TISS)' })
  upsert(@Body() dto: UpsertClinicProfileDto) {
    return this.clinicProfileService.upsert(dto);
  }
}
