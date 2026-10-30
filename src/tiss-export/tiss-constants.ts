export const TISS_NAMESPACE = 'http://www.ans.gov.br/padroes/tiss/schemas';
export const TISS_MAX_GUIDES_PER_FILE = 100;
export const TISS_TABLE_PROCEDIMENTOS = '22';
export const TISS_ATENDIMENTO_RN = 'N';
export const TISS_INDICACAO_ACIDENTE = '9';
export const TISS_REGIME_ATENDIMENTO = '01';
export const TISS_TIPO_CONSULTA = '1';
export const TISS_CARATER_ATENDIMENTO = '1';
export const TISS_TIPO_ATENDIMENTO = '23';
export const TISS_REDUCAO_ACRESCIMO = '1.00';
export const TISS_TIPO_TRANSACAO = 'ENVIO_LOTE_GUIAS';

/** Tabela 35 da ANS (dm_grauPart). */
export const TISS_PARTICIPATION_DEGREES = [
  '00',
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
] as const;

export type TissParticipationDegree = (typeof TISS_PARTICIPATION_DEGREES)[number];

export const TISS_PARTICIPATION_DEGREE_DEFAULT: TissParticipationDegree = '12';

export function isTissParticipationDegree(
  value: string,
): value is TissParticipationDegree {
  return (TISS_PARTICIPATION_DEGREES as readonly string[]).includes(value);
}

export { COUNCIL_TYPE_TO_TISS } from '../common/tiss-councils';
