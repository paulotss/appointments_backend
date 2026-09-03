import { BRAZILIAN_UFS, toTissUfCode, UF_TO_IBGE } from './brazilian-uf';

describe('toTissUfCode', () => {
  it('maps every Brazilian UF to the TISS IBGE code', () => {
    expect(BRAZILIAN_UFS.every((uf) => uf in UF_TO_IBGE)).toBe(true);
    expect(toTissUfCode('DF')).toBe('53');
    expect(toTissUfCode('SP')).toBe('35');
  });

  it('returns the original value when the UF is unknown', () => {
    expect(toTissUfCode('XX')).toBe('XX');
  });
});
