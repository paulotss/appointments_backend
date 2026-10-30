import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CLINICAL_STAFF_ROLES } from '../auth/roles';
import { TISS_COUNCILS } from '../common/tiss-councils';
import { searchTissCbos, TISS_CBOS } from '../common/tiss-cbos';

@ApiTags('tiss-catalog')
@Roles(...CLINICAL_STAFF_ROLES)
@Controller('tiss-catalog')
export class TissCatalogController {
  @Get('cbos')
  @ApiOperation({ summary: 'Buscar CBO-S da tabela 24 do TISS' })
  searchCbos(@Query('q') q = '') {
    const term = q.trim();
    return searchTissCbos(term, term ? 40 : TISS_CBOS.length);
  }

  @Get('councils')
  @ApiOperation({ summary: 'Listar conselhos da tabela 26 do TISS' })
  councils() {
    return TISS_COUNCILS;
  }
}
