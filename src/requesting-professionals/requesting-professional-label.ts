export function requestingProfessionalLabel(row: {
  name: string;
  councilType: string;
  councilNumber: string;
  councilUf: string;
  cbosCode: string;
}): string {
  const sigla = row.councilType === 'OTHER' ? 'Outros' : row.councilType;
  return `${row.name} - ${sigla}: ${row.councilNumber}/${row.councilUf} - CBO: ${row.cbosCode}`;
}
