export type ProcedureExecutionLine = {
  quantity: number;
  executionDate: string;
};

/**
 * TISS `dataExecucao` is a single date and `quantidadeExecutada` counts only
 * that date. Serialized sessions (acupuncture, physiotherapy) are one
 * `procedimentoExecutado` per finished attendance. Quantity without session
 * dates stays on one line.
 */
export function splitProcedureExecutions(params: {
  quantity: number;
  sessionDates: string[];
  fallbackDate: string;
  splitBySession: boolean;
}): ProcedureExecutionLine[] {
  if (!params.splitBySession || params.sessionDates.length === 0) {
    return [{ quantity: params.quantity, executionDate: params.fallbackDate }];
  }

  const dates = [...params.sessionDates].sort();
  const covered = Math.min(dates.length, params.quantity);
  const lines: ProcedureExecutionLine[] = dates
    .slice(0, covered)
    .map((executionDate) => ({ quantity: 1, executionDate }));
  const remainder = params.quantity - covered;
  if (remainder > 0) {
    lines.push({ quantity: remainder, executionDate: params.fallbackDate });
  }
  return lines;
}
