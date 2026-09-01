import {
  COUNCIL_TYPE_TO_TISS,
  TISS_ATENDIMENTO_RN,
  TISS_CARATER_ATENDIMENTO,
  TISS_INDICACAO_ACIDENTE,
  TISS_MAX_GUIDES_PER_FILE,
  TISS_REDUCAO_ACRESCIMO,
  TISS_REGIME_ATENDIMENTO,
  TISS_TABLE_PROCEDIMENTOS,
  TISS_TIPO_ATENDIMENTO,
  TISS_TIPO_CONSULTA,
  TISS_TIPO_TRANSACAO,
} from './tiss-constants';
import type {
  TissExportFile,
  TissGuideData,
  TissGuideKind,
  TissLotePayload,
  TissPlanData,
  TissProfessionalData,
} from './tiss-export.types';
import {
  formatHmsSaoPaulo,
  formatTissDecimal,
  formatYmdSaoPaulo,
  wrapMensagem,
  XmlBuilder,
} from './tiss-xml';

function prestadorId(xml: XmlBuilder, plan: TissPlanData, clinicCnpj: string): string {
  if (plan.providerCode) {
    return xml.leaf('codigoPrestadorNaOperadora', plan.providerCode);
  }
  return xml.leaf('CNPJ', clinicCnpj);
}

function profissionalTags(xml: XmlBuilder, professional: TissProfessionalData): string[] {
  return [
    xml.leaf('nomeProfissional', professional.name),
    xml.leaf(
      'conselhoProfissional',
      COUNCIL_TYPE_TO_TISS[professional.councilType] ?? '10',
    ),
    xml.leaf('numeroConselhoProfissional', professional.councilNumber),
    xml.leaf('UF', professional.councilUf),
    xml.leaf('CBOS', professional.cbosCode),
  ];
}

function cabecalho(xml: XmlBuilder, payload: TissLotePayload): string {
  return xml.branch('cabecalho', [
    xml.branch('identificacaoTransacao', [
      xml.leaf('tipoTransacao', TISS_TIPO_TRANSACAO),
      xml.leaf('sequencialTransacao', payload.sequencialTransacao),
      xml.leaf('dataRegistroTransacao', formatYmdSaoPaulo(payload.generatedAt)),
      xml.leaf('horaRegistroTransacao', formatHmsSaoPaulo(payload.generatedAt)),
    ]),
    xml.branch('origem', [
      xml.branch('identificacaoPrestador', [
        prestadorId(xml, payload.plan, payload.clinic.cnpj),
      ]),
    ]),
    xml.branch('destino', [xml.leaf('registroANS', payload.plan.registroAns)]),
    xml.leaf('Padrao', payload.plan.tissVersion),
  ]);
}

function guiaConsulta(xml: XmlBuilder, payload: TissLotePayload, guide: TissGuideData): string {
  const item = guide.procedures[0]!;
  const billed = item.unitValue * item.quantity;
  return xml.branch('guiaConsulta', [
    xml.branch('cabecalhoConsulta', [
      xml.leaf('registroANS', payload.plan.registroAns),
      xml.leaf('numeroGuiaPrestador', guide.guideNumber),
    ]),
    xml.branch('dadosBeneficiario', [
      xml.leaf('numeroCarteira', guide.cardNumber),
      xml.leaf('atendimentoRN', TISS_ATENDIMENTO_RN),
    ]),
    xml.branch('contratadoExecutante', [
      prestadorId(xml, payload.plan, payload.clinic.cnpj),
      xml.leaf('CNES', payload.clinic.cnes),
    ]),
    xml.branch('profissionalExecutante', profissionalTags(xml, guide.professional)),
    xml.leaf('indicacaoAcidente', TISS_INDICACAO_ACIDENTE),
    xml.leaf('dataAtendimento', guide.attendanceDate),
    xml.leaf('tipoConsulta', TISS_TIPO_CONSULTA),
    xml.branch('procedimento', [
      xml.leaf('codigoTabela', TISS_TABLE_PROCEDIMENTOS),
      xml.leaf('codigoProcedimento', item.tissCode),
      xml.leaf('valorProcedimento', formatTissDecimal(billed)),
    ]),
    xml.leaf('regimeAtendimento', TISS_REGIME_ATENDIMENTO),
  ]);
}

function guiaSpSadt(xml: XmlBuilder, payload: TissLotePayload, guide: TissGuideData): string {
  const procedimentosValor = guide.procedures.reduce(
    (sum, item) => sum + item.unitValue * item.quantity,
    0,
  );

  return xml.branch('guiaSP-SADT', [
    xml.branch('cabecalhoGuia', [
      xml.leaf('registroANS', payload.plan.registroAns),
      xml.leaf('numeroGuiaPrestador', guide.guideNumber),
    ]),
    xml.branch('dadosAutorizacao', [
      xml.leaf('dataAutorizacao', guide.authorizationDate),
    ]),
    xml.branch('dadosBeneficiario', [
      xml.leaf('numeroCarteira', guide.cardNumber),
      xml.leaf('atendimentoRN', TISS_ATENDIMENTO_RN),
    ]),
    xml.branch('dadosSolicitante', [
      xml.branch('contratadoSolicitante', [
        prestadorId(xml, payload.plan, payload.clinic.cnpj),
      ]),
      xml.leaf('nomeContratadoSolicitante', payload.clinic.legalName),
      xml.branch('profissionalSolicitante', profissionalTags(xml, guide.professional)),
    ]),
    xml.branch('dadosSolicitacao', [
      xml.leaf('dataSolicitacao', guide.authorizationDate),
      xml.leaf('caraterAtendimento', TISS_CARATER_ATENDIMENTO),
    ]),
    xml.branch('dadosExecutante', [
      xml.branch('contratadoExecutante', [
        prestadorId(xml, payload.plan, payload.clinic.cnpj),
      ]),
      xml.leaf('CNES', payload.clinic.cnes),
    ]),
    xml.branch('dadosAtendimento', [
      xml.leaf('tipoAtendimento', TISS_TIPO_ATENDIMENTO),
      xml.leaf('indicacaoAcidente', TISS_INDICACAO_ACIDENTE),
      xml.leaf('regimeAtendimento', TISS_REGIME_ATENDIMENTO),
    ]),
    xml.branch(
      'procedimentosExecutados',
      guide.procedures.map((item, index) =>
        xml.branch('procedimentoExecutado', [
          xml.leaf('sequencialItem', String(index + 1)),
          xml.leaf('dataExecucao', item.executionDate),
          xml.branch('procedimento', [
            xml.leaf('codigoTabela', TISS_TABLE_PROCEDIMENTOS),
            xml.leaf('codigoProcedimento', item.tissCode),
            xml.leaf('descricaoProcedimento', item.description),
          ]),
          xml.leaf('quantidadeExecutada', String(item.quantity)),
          xml.leaf('reducaoAcrescimo', TISS_REDUCAO_ACRESCIMO),
          xml.leaf('valorUnitario', formatTissDecimal(item.unitValue)),
          xml.leaf('valorTotal', formatTissDecimal(item.unitValue * item.quantity)),
        ]),
      ),
    ),
    xml.branch('valorTotal', [
      xml.leaf('valorProcedimentos', formatTissDecimal(procedimentosValor)),
      xml.leaf('valorTotalGeral', formatTissDecimal(procedimentosValor)),
    ]),
  ]);
}

export function buildLoteXml(payload: TissLotePayload): string {
  const xml = new XmlBuilder();
  const header = cabecalho(xml, payload);
  const kind = payload.guides[0]?.kind;
  const guiaTag = kind === 'consulta' ? guiaConsulta : guiaSpSadt;
  const numeroLote =
    payload.batchNumber.length <= 12 ? payload.batchNumber : payload.sequencialTransacao;
  const loteNumero = xml.leaf('numeroLote', numeroLote);
  const guias = payload.guides.map((guide) => guiaTag(xml, payload, guide));
  const corpo = xml.branch('prestadorParaOperadora', [
    xml.branch('loteGuias', [loteNumero, xml.branch('guiasTISS', guias)]),
  ]);
  return wrapMensagem(header, corpo, xml.hashHex());
}

export function chunkGuides<T>(guides: T[], size = TISS_MAX_GUIDES_PER_FILE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < guides.length; i += size) {
    chunks.push(guides.slice(i, i + size));
  }
  return chunks;
}

export function fileNameForChunk(
  batchNumber: string,
  kind: TissGuideKind,
  index: number,
  total: number,
): string {
  const safe = batchNumber.replaceAll(/[^a-zA-Z0-9._-]/g, '_');
  const suffix = kind === 'consulta' ? 'consulta' : 'sadt';
  const part = total > 1 ? `-${index + 1}` : '';
  return `lote-${safe}-${suffix}${part}.xml`;
}

export function buildExportFiles(base: Omit<TissLotePayload, 'guides'> & {
  guides: TissGuideData[];
}): TissExportFile[] {
  const files: TissExportFile[] = [];
  const byKind = {
    consulta: base.guides.filter((guide) => guide.kind === 'consulta'),
    sp_sadt: base.guides.filter((guide) => guide.kind === 'sp_sadt'),
  } as const;

  for (const kind of ['consulta', 'sp_sadt'] as const) {
    const groups = chunkGuides(byKind[kind]);
    groups.forEach((guides, index) => {
      files.push({
        filename: fileNameForChunk(base.batchNumber, kind, index, groups.length),
        xml: buildLoteXml({ ...base, guides }),
      });
    });
  }

  return files;
}
