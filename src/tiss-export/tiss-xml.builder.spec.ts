import { createHash } from 'crypto';
import { TissGuideType } from '@prisma/client';
import { buildExportFiles, buildLoteXml, chunkGuides } from './tiss-xml.builder';
import type { TissLotePayload } from './tiss-export.types';

function hashFromXml(xml: string): string {
  const withoutHash = xml.replace(
    /<ans:hash>[^<]*<\/ans:hash>/,
    '<ans:hash></ans:hash>',
  );
  const leaves = [...withoutHash.matchAll(/<ans:[^/>]+>([^<]*)<\/ans:[^>]+>/g)]
    .map((match) => match[1] ?? '')
    .join('');
  return createHash('md5').update(leaves, 'utf8').digest('hex');
}

const basePayload: TissLotePayload = {
  batchNumber: '15-20260901',
  sequencialTransacao: '15',
  generatedAt: new Date('2026-09-01T19:30:00.000Z'),
  clinic: {
    legalName: 'Clinica Exemplo Ltda',
    cnpj: '12345678000199',
    cnes: '1234567',
  },
  plan: {
    registroAns: '351033',
    providerCode: '99999',
    tissVersion: '4.03.00',
  },
  guides: [
    {
      id: 1,
      kind: TissGuideType.consulta,
      guideNumber: 'G-1',
      cardNumber: '000111',
      authorizationDate: '2026-08-01',
      attendanceDate: '2026-08-10',
      professional: {
        name: 'DR CARLOS',
        councilType: 'CRM',
        councilNumber: '123456',
        councilUf: 'SP',
        cbosCode: '225142',
      },
      procedures: [
        {
          tissCode: '10101012',
          description: 'CONSULTA',
          quantity: 1,
          unitValue: 80,
          executionDate: '2026-08-10',
        },
      ],
    },
  ],
};

describe('buildLoteXml', () => {
  it('emits TISS namespace, consulta tags and a matching MD5 hash', () => {
    const xml = buildLoteXml(basePayload);
    expect(xml).toContain('xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas"');
    expect(xml).toContain('<ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>');
    expect(xml).toContain('<ans:Padrao>4.03.00</ans:Padrao>');
    expect(xml).toContain('<ans:guiaConsulta>');
    expect(xml).toContain('<ans:UF>35</ans:UF>');
    expect(xml).toContain(
      '<ans:dadosAtendimento>' +
        '<ans:regimeAtendimento>01</ans:regimeAtendimento>' +
        '<ans:dataAtendimento>2026-08-10</ans:dataAtendimento>' +
        '<ans:tipoConsulta>1</ans:tipoConsulta>' +
        '<ans:procedimento>' +
        '<ans:codigoTabela>22</ans:codigoTabela>' +
        '<ans:codigoProcedimento>10101012</ans:codigoProcedimento>' +
        '<ans:valorProcedimento>80.00</ans:valorProcedimento>' +
        '</ans:procedimento>' +
        '</ans:dadosAtendimento>',
    );
    expect(xml).toContain('</ans:indicacaoAcidente><ans:dadosAtendimento>');
    expect(xml).not.toContain('</ans:indicacaoAcidente><ans:dataAtendimento>');
    expect(xml).toContain('<ans:codigoProcedimento>10101012</ans:codigoProcedimento>');
    expect(xml).toContain(
      '<ans:codigoPrestadorNaOperadora>12345678000199</ans:codigoPrestadorNaOperadora>',
    );
    expect(xml).not.toContain('<ans:codigoPrestadorNaOperadora>99999</ans:codigoPrestadorNaOperadora>');
    expect(xml).not.toContain('<ans:CNPJ>');

    const hash = xml.match(/<ans:hash>([a-f0-9]{32})<\/ans:hash>/)?.[1];
    expect(hash).toBe(hashFromXml(xml));
  });

  it('emits clinic CNPJ as codigoPrestadorNaOperadora when the plan has no provider code', () => {
    const xml = buildLoteXml({
      ...basePayload,
      plan: { ...basePayload.plan, providerCode: null },
    });
    expect(xml).toContain(
      '<ans:codigoPrestadorNaOperadora>12345678000199</ans:codigoPrestadorNaOperadora>',
    );
    expect(xml).not.toContain('<ans:CNPJ>');
  });

  it('emits IBGE UF code for Distrito Federal', () => {
    const xml = buildLoteXml({
      ...basePayload,
      guides: [
        {
          ...basePayload.guides[0]!,
          professional: {
            ...basePayload.guides[0]!.professional,
            councilUf: 'DF',
          },
        },
      ],
    });
    expect(xml).toContain('<ans:UF>53</ans:UF>');
    expect(xml).not.toContain('<ans:UF>DF</ans:UF>');
  });

  it('emits SP-SADT items with quantities', () => {
    const xml = buildLoteXml({
      ...basePayload,
      guides: [
        {
          ...basePayload.guides[0]!,
          kind: TissGuideType.sp_sadt,
          procedures: [
            {
              tissCode: '40304361',
              description: 'ECG',
              quantity: 2,
              unitValue: 40.5,
              executionDate: '2026-08-10',
            },
          ],
        },
      ],
    });
    expect(xml).toContain('<ans:guiaSP-SADT>');
    expect(xml).toContain(
      '<ans:codigoPrestadorNaOperadora>12345678000199</ans:codigoPrestadorNaOperadora>',
    );
    expect(xml).toContain('<ans:quantidadeExecutada>2</ans:quantidadeExecutada>');
    expect(xml).toContain('<ans:valorTotal>81.00</ans:valorTotal>');
    expect(xml).toContain('<ans:valorTotalGeral>81.00</ans:valorTotalGeral>');
  });
});

describe('chunkGuides', () => {
  it('splits groups of 100', () => {
    const items = Array.from({ length: 101 }, (_, index) => index);
    expect(chunkGuides(items, 100)).toEqual([items.slice(0, 100), [100]]);
  });
});

describe('buildExportFiles', () => {
  it('emits one xml per guide type', () => {
    const files = buildExportFiles({
      ...basePayload,
      guides: [
        basePayload.guides[0]!,
        {
          ...basePayload.guides[0]!,
          id: 2,
          kind: TissGuideType.sp_sadt,
          guideNumber: 'G-2',
          procedures: [
            {
              tissCode: '40304361',
              description: 'ECG',
              quantity: 1,
              unitValue: 40,
              executionDate: '2026-08-10',
            },
          ],
        },
      ],
    });
    expect(files.map((file) => file.filename)).toEqual([
      'lote-15-20260901-consulta.xml',
      'lote-15-20260901-sadt.xml',
    ]);
    expect(files[0]?.xml).toContain('<ans:guiaConsulta>');
    expect(files[1]?.xml).toContain('<ans:guiaSP-SADT>');
  });
});
