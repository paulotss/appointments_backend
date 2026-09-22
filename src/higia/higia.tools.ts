import { AgentDataService } from '../agent-data/agent-data.service';
import { AgentCatalogType } from '../agent-data/dto/agent-data-query.dto';
import { todayYmdSaoPaulo } from '../common/datetime/sao-paulo-day-bounds';

export function buildHigiaSystemPrompt(now = new Date()): string {
  const today = todayYmdSaoPaulo(now);
  return `Voce e a Higia, assistente da clinica. Responda em portugues do Brasil.

Hoje e ${today} (America/Sao_Paulo). Use essa data para "hoje", "amanha" e "esta semana". Nao invente outra data atual.
Use as tools para consultar dados reais. Nao invente pacientes, agendamentos, valores ou status.
Prefira get_clinic_overview para perguntas gerais sobre o dia ou totais.
Nas listagens o limite padrao e 10 (maximo 25). Se precisar de mais, peca outra pagina.
Para agenda clinica e call center, from e to sao obrigatorios (YYYY-MM-DD, America/Sao_Paulo).
Se faltar um identificador, busque primeiro e so depois peca o detalhe.
Nao execute acoes de escrita. Se nao houver dados, diga isso com clareza.`;
}

export const DEFAULT_HIGIA_MODEL = 'deepseek/deepseek-v4.1-flash';

type JsonSchema = Record<string, unknown>;

export type HigiaToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
};

const paginationProperties = {
  page: {
    type: 'integer',
    minimum: 1,
    description: 'Pagina (padrao 1)',
  },
  limit: {
    type: 'integer',
    minimum: 1,
    maximum: 25,
    description: 'Itens por pagina (padrao 10, maximo 25)',
  },
} as const;

const dateFromTo = {
  from: {
    type: 'string',
    description: 'Data inicial inclusiva YYYY-MM-DD (America/Sao_Paulo)',
  },
  to: {
    type: 'string',
    description: 'Data final inclusiva YYYY-MM-DD (America/Sao_Paulo)',
  },
} as const;

function tool(
  name: string,
  description: string,
  parameters: JsonSchema,
): HigiaToolDefinition {
  return {
    type: 'function',
    function: { name, description, parameters },
  };
}

export const HIGIA_TOOLS: HigiaToolDefinition[] = [
  tool(
    'get_clinic_overview',
    'Resumo da clinica: data de hoje (YYYY-MM-DD, America/Sao_Paulo), agenda do dia, guias, financeiro pendente e estoque critico. Use para visao geral sem listar registros.',
    { type: 'object', properties: {} },
  ),
  tool(
    'search_patients',
    'Busca pacientes por nome, CPF ou telefone. Retorna lista curta (id, nome, cpf, telefone).',
    {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Nome, CPF ou telefone' },
        ...paginationProperties,
      },
    },
  ),
  tool(
    'get_patient',
    'Detalhe de um paciente pelo id, incluindo cartoes de convenio.',
    {
      type: 'object',
      properties: { id: { type: 'integer', description: 'ID do paciente' } },
      required: ['id'],
    },
  ),
  tool(
    'search_professionals',
    'Busca profissionais de saude por nome, CPF ou numero de conselho.',
    {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Nome, CPF ou conselho' },
        ...paginationProperties,
      },
    },
  ),
  tool('get_professional', 'Detalhe de um profissional pelo id.', {
    type: 'object',
    properties: { id: { type: 'integer' } },
    required: ['id'],
  }),
  tool(
    'list_clinical_appointments',
    'Lista agendamentos da agenda clinica. from e to sao obrigatorios. Nao use para dump de calendario longo; limite o intervalo.',
    {
      type: 'object',
      properties: {
        ...dateFromTo,
        patientId: { type: 'integer' },
        healthProfessionalId: { type: 'integer' },
        status: {
          type: 'string',
          enum: [
            'marked',
            'confirmed',
            'waiting',
            'attended',
            'finished',
            'absent',
          ],
        },
        type: { type: 'string', enum: ['private', 'health_plan'] },
        insuranceGuideId: { type: 'integer' },
        ...paginationProperties,
      },
      required: ['from', 'to'],
    },
  ),
  tool(
    'get_clinical_appointment',
    'Detalhe compacto de um agendamento clinico (procedimentos e guias sem precos aninhados).',
    {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    },
  ),
  tool(
    'search_insurance_guides',
    'Busca guias de convenio por numero, paciente, status ou faturamento.',
    {
      type: 'object',
      properties: {
        q: {
          type: 'string',
          description: 'Numero da guia ou nome do paciente',
        },
        guideNumber: { type: 'string' },
        isBilled: { type: 'boolean' },
        status: {
          type: 'string',
          enum: ['pending', 'under_analysis', 'authorized'],
        },
        patientId: { type: 'integer' },
        healthProfessionalId: { type: 'integer' },
        healthPlanId: { type: 'integer' },
        availableForBilling: { type: 'boolean' },
        ...paginationProperties,
      },
    },
  ),
  tool(
    'get_insurance_guide',
    'Detalhe compacto de uma guia (procedimentos e quantidades, sem arquivos).',
    {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    },
  ),
  tool(
    'list_call_center_appointments',
    'Agendamentos do call center (ligacao/WhatsApp). from e to obrigatorios.',
    {
      type: 'object',
      properties: {
        ...dateFromTo,
        attendantId: { type: 'integer' },
        contactMethod: { type: 'string', enum: ['whatsapp', 'phone', 'other'] },
        firstTime: { type: 'boolean' },
        scheduled: { type: 'boolean' },
        specialtyId: { type: 'integer' },
        ...paginationProperties,
      },
      required: ['from', 'to'],
    },
  ),
  tool('list_calls', 'Ligacoes do call center. from e to obrigatorios.', {
    type: 'object',
    properties: {
      ...dateFromTo,
      recordStatus: {
        type: 'string',
        enum: ['pending', 'registered', 'cancelled'],
      },
      userId: { type: 'integer' },
      status: {
        type: 'string',
        enum: ['ATENDIDO', 'NAO_ATENDIDO', 'REALIZADO'],
      },
      ...paginationProperties,
    },
    required: ['from', 'to'],
  }),
  tool(
    'list_messages',
    'Mensagens do WhatsApp sem o conteudo completo. from e to obrigatorios.',
    {
      type: 'object',
      properties: {
        ...dateFromTo,
        recordStatus: {
          type: 'string',
          enum: ['pending', 'registered', 'cancelled'],
        },
        userId: { type: 'integer' },
        ...paginationProperties,
      },
      required: ['from', 'to'],
    },
  ),
  tool('get_message', 'Detalhe de uma mensagem, incluindo content.', {
    type: 'object',
    properties: { id: { type: 'integer' } },
    required: ['id'],
  }),
  tool(
    'list_financial_entries',
    'Entradas financeiras (receitas). Prefira filtrar por periodo ou status.',
    {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['private_procedure', 'health_plan'],
        },
        status: {
          type: 'string',
          enum: ['pending', 'paid', 'partially_paid', 'cancelled'],
        },
        ...dateFromTo,
        ...paginationProperties,
      },
    },
  ),
  tool(
    'list_payables',
    'Contas a pagar. Filtre por status, fornecedor ou vencimento.',
    {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'paid', 'cancelled'] },
        supplierId: { type: 'integer' },
        ...dateFromTo,
        ...paginationProperties,
      },
    },
  ),
  tool(
    'list_financial_exits',
    'Pagamentos (saidas financeiras) ja realizados.',
    {
      type: 'object',
      properties: {
        supplierId: { type: 'integer' },
        paymentMethod: {
          type: 'string',
          enum: ['pix', 'debit', 'credit', 'cash', 'transfer'],
        },
        ...dateFromTo,
        ...paginationProperties,
      },
    },
  ),
  tool(
    'list_billing_batches',
    'Lotes de faturamento TISS, sem guias aninhadas.',
    {
      type: 'object',
      properties: {
        healthPlanId: { type: 'integer' },
        status: {
          type: 'string',
          enum: ['open', 'billed', 'settled', 'cancelled'],
        },
        ...paginationProperties,
      },
    },
  ),
  tool(
    'search_products',
    'Busca produtos por nome ou SKU. Use belowMinimum para estoque baixo.',
    {
      type: 'object',
      properties: {
        q: { type: 'string' },
        belowMinimum: { type: 'boolean' },
        ...paginationProperties,
      },
    },
  ),
  tool(
    'get_stock_summary',
    'Consolidacao de estoque por produto, sem lista de lotes.',
    {
      type: 'object',
      properties: {
        q: { type: 'string' },
        ...paginationProperties,
      },
    },
  ),
  tool('list_stock_batches', 'Lotes de estoque (abertos por padrao).', {
    type: 'object',
    properties: {
      productId: { type: 'integer' },
      status: { type: 'string', enum: ['open', 'closed', 'all'] },
      ...paginationProperties,
    },
  }),
  tool('list_stock_exits', 'Saidas de estoque.', {
    type: 'object',
    properties: {
      productId: { type: 'integer' },
      ...dateFromTo,
      ...paginationProperties,
    },
  }),
  tool(
    'search_procedures',
    'Busca procedimentos por nome, especialidade ou plano (sem tabela de precos).',
    {
      type: 'object',
      properties: {
        q: { type: 'string' },
        specialtyId: { type: 'integer' },
        healthPlanId: { type: 'integer' },
        ...paginationProperties,
      },
    },
  ),
  tool(
    'list_catalog',
    'Listas curtas de cadastro: especialidades, planos, categorias, setores ou locais de estoque.',
    {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'specialties',
            'health_plans',
            'categories',
            'sectors',
            'storage_locations',
          ],
        },
      },
      required: ['type'],
    },
  ),
];

export const HIGIA_TOOL_HTTP_PATH: Record<string, string> = {
  get_clinic_overview: '/agent-data/overview',
  search_patients: '/agent-data/patients',
  get_patient: '/agent-data/patients/:id',
  search_professionals: '/agent-data/health-professionals',
  get_professional: '/agent-data/health-professionals/:id',
  list_clinical_appointments: '/agent-data/clinical-appointments',
  get_clinical_appointment: '/agent-data/clinical-appointments/:id',
  search_insurance_guides: '/agent-data/insurance-guides',
  get_insurance_guide: '/agent-data/insurance-guides/:id',
  list_call_center_appointments: '/agent-data/appointments',
  list_calls: '/agent-data/calls',
  list_messages: '/agent-data/messages',
  get_message: '/agent-data/messages/:id',
  list_financial_entries: '/agent-data/financial-entries',
  list_payables: '/agent-data/payables',
  list_financial_exits: '/agent-data/financial-exits',
  list_billing_batches: '/agent-data/billing-batches',
  search_products: '/agent-data/products',
  get_stock_summary: '/agent-data/stock-summary',
  list_stock_batches: '/agent-data/stock-batches',
  list_stock_exits: '/agent-data/stock-exits',
  search_procedures: '/agent-data/procedures',
  list_catalog: '/agent-data/catalog',
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

function pagination(args: Record<string, unknown>) {
  return {
    page: asNumber(args.page),
    limit: asNumber(args.limit),
  };
}

export async function executeHigiaTool(
  agentData: AgentDataService,
  name: string,
  rawArgs: unknown,
): Promise<unknown> {
  const args =
    rawArgs && typeof rawArgs === 'object'
      ? (rawArgs as Record<string, unknown>)
      : {};

  switch (name) {
    case 'get_clinic_overview':
      return agentData.getOverview();
    case 'search_patients':
      return agentData.searchPatients({
        q: asString(args.q),
        ...pagination(args),
      });
    case 'get_patient':
      return agentData.getPatient(asNumber(args.id)!);
    case 'search_professionals':
      return agentData.searchProfessionals({
        q: asString(args.q),
        ...pagination(args),
      });
    case 'get_professional':
      return agentData.getProfessional(asNumber(args.id)!);
    case 'list_clinical_appointments':
      return agentData.listClinicalAppointments({
        from: asString(args.from)!,
        to: asString(args.to)!,
        patientId: asNumber(args.patientId),
        healthProfessionalId: asNumber(args.healthProfessionalId),
        status: asString(args.status) as never,
        type: asString(args.type) as never,
        insuranceGuideId: asNumber(args.insuranceGuideId),
        ...pagination(args),
      });
    case 'get_clinical_appointment':
      return agentData.getClinicalAppointment(asNumber(args.id)!);
    case 'search_insurance_guides':
      return agentData.searchInsuranceGuides({
        q: asString(args.q),
        guideNumber: asString(args.guideNumber),
        isBilled: asBoolean(args.isBilled),
        status: asString(args.status) as never,
        patientId: asNumber(args.patientId),
        healthProfessionalId: asNumber(args.healthProfessionalId),
        healthPlanId: asNumber(args.healthPlanId),
        availableForBilling: asBoolean(args.availableForBilling),
        ...pagination(args),
      });
    case 'get_insurance_guide':
      return agentData.getInsuranceGuide(asNumber(args.id)!);
    case 'list_call_center_appointments':
      return agentData.listCallCenterAppointments({
        from: asString(args.from)!,
        to: asString(args.to)!,
        attendantId: asNumber(args.attendantId),
        contactMethod: asString(args.contactMethod) as never,
        firstTime: asBoolean(args.firstTime),
        scheduled: asBoolean(args.scheduled),
        specialtyId: asNumber(args.specialtyId),
        ...pagination(args),
      });
    case 'list_calls':
      return agentData.listCalls({
        from: asString(args.from)!,
        to: asString(args.to)!,
        recordStatus: asString(args.recordStatus) as never,
        userId: asNumber(args.userId),
        status: asString(args.status) as never,
        ...pagination(args),
      });
    case 'list_messages':
      return agentData.listMessages({
        from: asString(args.from)!,
        to: asString(args.to)!,
        recordStatus: asString(args.recordStatus) as never,
        userId: asNumber(args.userId),
        ...pagination(args),
      });
    case 'get_message':
      return agentData.getMessage(asNumber(args.id)!);
    case 'list_financial_entries':
      return agentData.listFinancialEntries({
        type: asString(args.type) as never,
        status: asString(args.status) as never,
        from: asString(args.from),
        to: asString(args.to),
        ...pagination(args),
      });
    case 'list_payables':
      return agentData.listPayables({
        status: asString(args.status) as never,
        supplierId: asNumber(args.supplierId),
        from: asString(args.from),
        to: asString(args.to),
        ...pagination(args),
      });
    case 'list_financial_exits':
      return agentData.listFinancialExits({
        supplierId: asNumber(args.supplierId),
        paymentMethod: asString(args.paymentMethod) as never,
        from: asString(args.from),
        to: asString(args.to),
        ...pagination(args),
      });
    case 'list_billing_batches':
      return agentData.listBillingBatches({
        healthPlanId: asNumber(args.healthPlanId),
        status: asString(args.status) as never,
        ...pagination(args),
      });
    case 'search_products':
      return agentData.searchProducts({
        q: asString(args.q),
        belowMinimum: asBoolean(args.belowMinimum),
        ...pagination(args),
      });
    case 'get_stock_summary':
      return agentData.getStockSummary({
        q: asString(args.q),
        ...pagination(args),
      });
    case 'list_stock_batches':
      return agentData.listStockBatches({
        productId: asNumber(args.productId),
        status: asString(args.status) as 'open' | 'closed' | 'all' | undefined,
        ...pagination(args),
      });
    case 'list_stock_exits':
      return agentData.listStockExits({
        productId: asNumber(args.productId),
        from: asString(args.from),
        to: asString(args.to),
        ...pagination(args),
      });
    case 'search_procedures':
      return agentData.searchProcedures({
        q: asString(args.q),
        specialtyId: asNumber(args.specialtyId),
        healthPlanId: asNumber(args.healthPlanId),
        ...pagination(args),
      });
    case 'list_catalog':
      return agentData.listCatalog(asString(args.type) as AgentCatalogType);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
