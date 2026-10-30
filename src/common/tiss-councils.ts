/** Tabela 26 TISS 4.03.00 — conselho profissional. */
export const TISS_COUNCILS = [
  { value: 'CRESS', tissCode: '01', name: 'Conselho Regional de Serviço Social' },
  { value: 'COREN', tissCode: '02', name: 'Conselho Regional de Enfermagem' },
  { value: 'CRF', tissCode: '03', name: 'Conselho Regional de Farmácia' },
  { value: 'CREFONO', tissCode: '04', name: 'Conselho Regional de Fonoaudiologia' },
  { value: 'CREFITO', tissCode: '05', name: 'Conselho Regional de Fisioterapia e Terapia Ocupacional' },
  { value: 'CRM', tissCode: '06', name: 'Conselho Regional de Medicina' },
  { value: 'CRN', tissCode: '07', name: 'Conselho Regional de Nutrição' },
  { value: 'CRO', tissCode: '08', name: 'Conselho Regional de Odontologia' },
  { value: 'CRP', tissCode: '09', name: 'Conselho Regional de Psicologia' },
  { value: 'OTHER', tissCode: '10', name: 'Outros Conselhos' },
  { value: 'CRBIO', tissCode: '11', name: 'Conselho Regional de Biologia' },
  { value: 'CRBM', tissCode: '12', name: 'Conselho Regional de Biomedicina' },
  { value: 'CREF', tissCode: '13', name: 'Conselho Regional de Educação Física' },
  { value: 'CRMV', tissCode: '14', name: 'Conselho Regional de Medicina Veterinária' },
  { value: 'CRTR', tissCode: '15', name: 'Conselho Regional de Técnicos em Radiologia' },
] as const;

export type TissCouncilValue = (typeof TISS_COUNCILS)[number]['value'];

export const COUNCIL_TYPE_TO_TISS: Record<string, string> = Object.fromEntries(
  TISS_COUNCILS.map((item) => [item.value, item.tissCode]),
);

export function councilOptionLabel(value: string): string {
  const council = TISS_COUNCILS.find((item) => item.value === value);
  if (!council) return value;
  const sigla = council.value === 'OTHER' ? 'Outros' : council.value;
  return `${sigla} — ${council.name}`;
}
