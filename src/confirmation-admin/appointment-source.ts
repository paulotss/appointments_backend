import { CampaignSourceKey } from '@prisma/client';

/**
 * Ponto de troca da origem dos agendamentos.
 * Saúde Vianet e Higia implementam o mesmo contrato. Nesta versão nenhuma
 * das duas consulta um sistema externo: a campanha guarda o que a recepção
 * registrou. Uma origem futura devolve `connected: true` e a mesma lógica
 * de campanha passa a usar esses itens.
 */
export interface AppointmentSourceItem {
  appointmentRef: string;
  patientRef?: string;
  recipientRef?: string;
  informedPhoneRef?: string;
  recipientState: 'ELIGIBLE' | 'PENDING' | 'UNAVAILABLE';
  reasonCode?: string;
}

export type AppointmentSourceLoad =
  | { connected: false }
  | { connected: true; items: AppointmentSourceItem[] };

export interface AppointmentSource {
  readonly key: CampaignSourceKey;
  readonly label: string;
  load(campaignDate: string): Promise<AppointmentSourceLoad>;
}

export class SaudeVianetAppointmentSource implements AppointmentSource {
  readonly key = CampaignSourceKey.SAUDEVIANET;
  readonly label = 'Saúde Vianet';

  load(campaignDate: string): Promise<AppointmentSourceLoad> {
    return Promise.resolve(disconnected(campaignDate));
  }
}

export class HigiaAppointmentSource implements AppointmentSource {
  readonly key = CampaignSourceKey.HIGIA;
  readonly label = 'Higia';

  load(campaignDate: string): Promise<AppointmentSourceLoad> {
    return Promise.resolve(disconnected(campaignDate));
  }
}

function disconnected(
  // A data entra no contrato para a origem futura. Nesta versão não há consulta.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  campaignDate: string,
): AppointmentSourceLoad {
  return { connected: false };
}

export class AppointmentSourceRegistry {
  constructor(private readonly sources: readonly AppointmentSource[]) {}

  get(key: CampaignSourceKey): AppointmentSource {
    const found = this.sources.find((source) => source.key === key);
    if (!found) {
      throw new Error('Origem de agendamentos desconhecida.');
    }
    return found;
  }
}

export function defaultAppointmentSources(): AppointmentSourceRegistry {
  return new AppointmentSourceRegistry([
    new SaudeVianetAppointmentSource(),
    new HigiaAppointmentSource(),
  ]);
}
