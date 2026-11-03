import { CampaignSourceKey } from '@prisma/client';

/**
 * Ponto de troca da origem dos agendamentos.
 * A campanha só vê este contrato. Saúde Vianet entra por uma API interna
 * que já consultou e revalidou a agenda. Higia continua desconectada.
 */
export interface AppointmentSourceItem {
  appointmentRef: string;
  patientRef?: string | null;
  recipientRef?: string | null;
  informedPhoneRef?: string | null;
  recipientState: 'ELIGIBLE' | 'PENDING' | 'UNAVAILABLE';
  reasonCode?: string | null;
  professionalRef?: string | null;
  appointmentTime?: string | null;
  agendaRef?: string | null;
  sourceResolution?: string | null;
  isMinor?: boolean | null;
}

export type AppointmentSourceAvailability =
  | 'ready'
  | 'empty'
  | 'partial'
  | 'failed';

export type AppointmentSourceLoad =
  | { connected: false }
  | {
      connected: true;
      availability: AppointmentSourceAvailability;
      reason: string | null;
      items: AppointmentSourceItem[];
    };

export interface AppointmentSource {
  readonly key: CampaignSourceKey;
  readonly label: string;
  load(campaignDate: string): Promise<AppointmentSourceLoad>;
}

export interface CampaignContactDraft {
  appointmentRef: string;
  patientRef: string | null;
  recipientRef: string | null;
  phoneRef: string | null;
  isMinor: boolean | null;
  resolution: string | null;
}

export interface ClassifiedContact {
  appointmentRef: string;
  contactState: 'eligible' | 'pending' | 'unavailable';
  reasonCode: string;
}

export abstract class CampaignContactClassifier {
  abstract classify(
    items: CampaignContactDraft[],
  ): Promise<ClassifiedContact[]>;
}

const FORBIDDEN_KEYS = new Set([
  'phone',
  'telefones',
  'telefone',
  'name',
  'nome',
  'cpf',
  'birth_date',
  'nascimento',
  'patient',
  'paciente',
  'patient_id',
  'title',
  'notes',
  'procedures',
  'candidate_e164',
  'contact',
  'recipient',
  'prontuario',
]);

export class SaudeVianetAppointmentSource implements AppointmentSource {
  readonly key = CampaignSourceKey.SAUDEVIANET;
  readonly label = 'Saúde Vianet';

  constructor(
    private readonly client: CampaignSourceClient = httpCampaignSourceClient(),
  ) {}

  async load(campaignDate: string): Promise<AppointmentSourceLoad> {
    try {
      return mapCampaignSource(await this.client.load(campaignDate));
    } catch (error) {
      const reason =
        error instanceof Error && error.message === 'source_not_configured'
          ? 'source_not_configured'
          : 'query_failed';
      return {
        connected: true,
        availability: 'failed',
        reason,
        items: [],
      };
    }
  }
}

export class HigiaAppointmentSource implements AppointmentSource {
  readonly key = CampaignSourceKey.HIGIA;
  readonly label = 'Higia';

  load(): Promise<AppointmentSourceLoad> {
    return Promise.resolve({ connected: false });
  }
}

export class HttpCampaignContactClassifier extends CampaignContactClassifier {
  constructor(
    private readonly client: CampaignSourceClient = httpCampaignSourceClient(),
  ) {
    super();
  }

  async classify(items: CampaignContactDraft[]): Promise<ClassifiedContact[]> {
    return mapClassifiedContacts(await this.client.classify(items));
  }
}

export interface CampaignSourceClient {
  load(campaignDate: string): Promise<unknown>;
  classify(items: CampaignContactDraft[]): Promise<unknown>;
}

export function httpCampaignSourceClient(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): CampaignSourceClient {
  const base = env.SAUDEVIANET_INTERNAL_API_BASE?.replace(/\/$/, '');
  const token = env.SAUDEVIANET_INTERNAL_API_TOKEN;
  return {
    async load(campaignDate: string) {
      if (!base || !token) {
        throw new Error('source_not_configured');
      }
      const response = await fetchImpl(
        `${base}/internal/confirmations/campaign-source?date=${encodeURIComponent(campaignDate)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) {
        throw new Error('query_failed');
      }
      return (await response.json()) as unknown;
    },
    async classify(items: CampaignContactDraft[]) {
      if (!base || !token) {
        throw new Error('source_not_configured');
      }
      const response = await fetchImpl(
        `${base}/internal/confirmations/classify`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: items.map((item) => ({
              appointmentRef: item.appointmentRef,
              patientRef: item.patientRef,
              recipientRef: item.recipientRef,
              phoneRef: item.phoneRef,
              isMinor: item.isMinor,
              resolution: item.resolution,
            })),
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok) {
        throw new Error('query_failed');
      }
      return (await response.json()) as unknown;
    },
  };
}

export function mapCampaignSource(payload: unknown): AppointmentSourceLoad {
  if (!closed(payload) || !isRecord(payload)) {
    return failed('unexpected_response');
  }
  const state = payload.state;
  const reason = typeof payload.reason === 'string' ? payload.reason : null;
  if (state === 'empty') {
    return { connected: true, availability: 'empty', reason, items: [] };
  }
  if (state === 'failed') {
    return {
      connected: true,
      availability: 'failed',
      reason: reason ?? 'query_failed',
      items: [],
    };
  }
  if (state !== 'ready' && state !== 'partial') {
    return failed('unexpected_response');
  }
  if (!Array.isArray(payload.items)) {
    return failed('unexpected_response');
  }
  const items: AppointmentSourceItem[] = [];
  for (const raw of payload.items) {
    const item = mapItem(raw);
    if (!item) {
      return failed('unexpected_response');
    }
    items.push(item);
  }
  return { connected: true, availability: state, reason, items };
}

export function mapClassifiedContacts(payload: unknown): ClassifiedContact[] {
  if (!closed(payload) || !isRecord(payload) || !Array.isArray(payload.items)) {
    throw new Error('unexpected_response');
  }
  return payload.items.map((raw) => {
    if (!isRecord(raw) || typeof raw.appointmentRef !== 'string') {
      throw new Error('unexpected_response');
    }
    const contactState = raw.contactState;
    if (
      contactState !== 'eligible' &&
      contactState !== 'pending' &&
      contactState !== 'unavailable'
    ) {
      throw new Error('unexpected_response');
    }
    const reasonCode =
      typeof raw.reasonCode === 'string'
        ? raw.reasonCode
        : 'verification_missing';
    return {
      appointmentRef: raw.appointmentRef,
      contactState:
        contactState === 'eligible' && reasonCode !== 'contact_ready'
          ? 'pending'
          : contactState,
      reasonCode,
    };
  });
}

function mapItem(raw: unknown): AppointmentSourceItem | null {
  if (!isRecord(raw) || typeof raw.appointmentRef !== 'string') {
    return null;
  }
  const contactState = raw.contactState;
  if (
    contactState !== 'eligible' &&
    contactState !== 'pending' &&
    contactState !== 'unavailable'
  ) {
    return null;
  }
  const reasonCode =
    typeof raw.reasonCode === 'string'
      ? raw.reasonCode
      : 'verification_missing';
  const recipientState =
    contactState === 'eligible' && reasonCode === 'contact_ready'
      ? 'ELIGIBLE'
      : contactState === 'unavailable'
        ? 'UNAVAILABLE'
        : 'PENDING';
  return {
    appointmentRef: raw.appointmentRef,
    patientRef: optionalString(raw.patientRef),
    recipientRef: optionalString(raw.recipientRef),
    informedPhoneRef: optionalString(raw.phoneRef),
    recipientState,
    reasonCode,
    professionalRef: optionalString(raw.professionalRef),
    appointmentTime: optionalString(raw.appointmentTime),
    agendaRef: optionalString(raw.agendaRef),
    sourceResolution: optionalString(raw.resolution),
    isMinor: typeof raw.isMinor === 'boolean' ? raw.isMinor : null,
  };
}

function failed(reason: string): AppointmentSourceLoad {
  return { connected: true, availability: 'failed', reason, items: [] };
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function closed(value: unknown, depth = 0): boolean {
  if (depth > 8) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.every((item) => closed(item, depth + 1));
  }
  if (isRecord(value)) {
    return Object.entries(value).every(([key, item]) => {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        return false;
      }
      return closed(item, depth + 1);
    });
  }
  if (
    typeof value === 'string' &&
    (value.startsWith('+') || value.includes('@'))
  ) {
    return false;
  }
  return true;
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

export function defaultAppointmentSources(
  client: CampaignSourceClient = httpCampaignSourceClient(),
): AppointmentSourceRegistry {
  return new AppointmentSourceRegistry([
    new SaudeVianetAppointmentSource(client),
    new HigiaAppointmentSource(),
  ]);
}
