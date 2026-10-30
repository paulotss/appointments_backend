import { CouncilType } from '@prisma/client';
import { requestingProfessionalLabel } from './requesting-professional-label';

describe('requestingProfessionalLabel', () => {
  it('formats the saved professional with council and CBOS', () => {
    expect(
      requestingProfessionalLabel({
        name: 'Ana Paula Lara Barcelos',
        councilType: CouncilType.CRM,
        councilNumber: '16906',
        councilUf: 'DF',
        cbosCode: '225125',
      }),
    ).toBe('Ana Paula Lara Barcelos - CRM: 16906/DF - CBO: 225125');
  });
});
