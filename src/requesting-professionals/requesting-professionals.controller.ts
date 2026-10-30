import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { STAFF_ROLES } from '../auth/roles';
import { RequestingProfessionalsService } from './requesting-professionals.service';

@ApiTags('requesting-professionals')
@Roles(...STAFF_ROLES)
@Controller('requesting-professionals')
export class RequestingProfessionalsController {
  constructor(private readonly service: RequestingProfessionalsService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar profissionais solicitantes salvos' })
  search(@Query('q') q = '') {
    return this.service.search(q);
  }
}
