import { CouncilType, TissGuideType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import {
  assertExecutorCbos,
  requesterColumns,
} from './guide-tiss-professionals';

const requester = {
  name: 'Ana Paula Lara Barcelos',
  councilType: CouncilType.CRM,
  councilNumber: '16906',
  councilUf: 'df',
  cbosCode: '225125',
};

describe('guide tiss professionals', () => {
  it('requires the requesting professional only for SP/SADT', () => {
    expect(requesterColumns(undefined, TissGuideType.consulta)).toEqual({
      requesterName: null,
      requesterCouncilType: null,
      requesterCouncilNumber: null,
      requesterCouncilUf: null,
      requesterCbosCode: null,
    });
    expect(requesterColumns(requester, TissGuideType.sp_sadt)).toMatchObject({
      requesterName: 'Ana Paula Lara Barcelos',
      requesterCouncilUf: 'DF',
      requesterCbosCode: '225125',
    });
    expect(() => requesterColumns(undefined, TissGuideType.sp_sadt)).toThrow(
      BadRequestException,
    );
  });

  it('rejects a CBOS outside table 24 and outside the professional specialties', () => {
    expect(() => assertExecutorCbos('225125', ['225125', '225120'])).not.toThrow();
    expect(() => assertExecutorCbos('225120', ['225125'])).toThrow(BadRequestException);
    expect(() => assertExecutorCbos('000000', ['000000'])).toThrow(BadRequestException);
  });

  it('rejects a requesting CBOS outside table 24', () => {
    expect(() =>
      requesterColumns(
        { ...requester, cbosCode: '000000' },
        TissGuideType.sp_sadt,
      ),
    ).toThrow(BadRequestException);
  });
});
