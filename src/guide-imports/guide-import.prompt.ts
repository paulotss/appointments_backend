const JSON_SHAPE = `{
  "tissGuideType": "consulta" | "sp_sadt" | null,
  "healthPlan": { "name": string | null, "registroAns": string | null },
  "patient": { "name": string | null, "cardNumber": string | null, "cardExpirationDate": string | null },
  "professional": {
    "name": string | null,
    "councilType": "CRM" | "CRO" | "CRP" | "COREN" | "OTHER" | null,
    "councilNumber": string | null,
    "councilUf": string | null,
    "cbosCode": string | null,
    "source": "executante" | "solicitante" | null
  },
  "procedures": [
    {
      "tissCode": string | null,
      "description": string | null,
      "requestedQuantity": number | null,
      "authorizedQuantity": number | null
    }
  ],
  "guide": {
    "operatorGuideNumber": string | null,
    "providerGuideNumber": string | null,
    "authorizationDate": string | null,
    "passwordExpirationDate": string | null,
    "attendanceDate": string | null
  }
}`;

const FIELD_RULES = `Regras (obrigatórias):
- Extraia pelo significado dos rótulos, não pela posição das caixas. Números TISS (1, 2, 3...) são só dica.
- Se o dado não estiver visível, use null. Nunca invente nome, telefone, CPF, data, código ou operadora.
- NÃO copie títulos do formulário. "Guia de Consulta", "Guia de SP/SADT", "Padrão TISS", "TISS", "Consulta" e "SP/SADT" NÃO são plano de saúde, paciente, profissional nem procedimento.
- Plano de saúde = OPERADORA (logo ou nome: Unimed, CASSI, Amil, Bradesco, Geap, SulAmérica, etc.) e/ou registro ANS (exatamente 6 dígitos). Se só houver o título da guia, healthPlan.name = null.
- Paciente = nome do BENEFICIÁRIO e número da CARTEIRA. Validade só se estiver preenchida. Datas em YYYY-MM-DD (também aceite DD/MM/AAAA).
- Profissional = NOME DE PESSOA no campo 12 (Nome do Profissional Executante), conselho no 13, número no 14, UF no 15, CBO no 16. Na SP/SADT prefira o EXECUTANTE; se vazio, use o SOLICITANTE e source="solicitante". "Profissional executante" / "Nome do profissional" são rótulos, não nomes. councilType: CRM, CRO, CRP, COREN ou OTHER.
- Procedimentos: na guia de consulta o código TUSS está no campo 21 (Código do Procedimento, 8 dígitos, ex. 10101012). A descrição costuma estar no campo 23 (Observação/Justificativa), NÃO ao lado do código. Na SP/SADT, leia as linhas da tabela de procedimentos. Ignore grade de execução vazia. authorizedQuantity = quantidade autorizada; se só houver solicitada, copie para authorizedQuantity.
- operatorGuideNumber = campo 3 (Número da Guia atribuído pela operadora). providerGuideNumber = campo 2 (Nº Guia no Prestador), se distinto.
- attendanceDate = campo 18 (Data do Atendimento), formato YYYY-MM-DD.
- authorizationDate = data de autorização se estiver preenchida; se não houver, use a data do atendimento.
- passwordExpirationDate = validade da senha/autorização. NÃO use a validade da carteira e não invente data.
- tissGuideType: "consulta" ou "sp_sadt" conforme o TIPO do documento, nunca como nome de plano.`;

export const GUIDE_TRANSCRIPTION_PROMPT = `Esta imagem é uma guia TISS (formulário de convênio médico).

Transcreva TODO o texto impresso, linha a linha, na ordem em que aparece.
Copie nomes, números, códigos, datas e siglas exatamente.
Em cada campo, escreva o rótulo e o valor (exemplo: Registro ANS: 346659).
Não resuma. Não invente. Não explique. Só o texto da guia.`;

export const GUIDE_EXTRACTION_PROMPT = `Leia a IMAGEM de uma guia TISS brasileira. Os valores vêm só da imagem, nunca deste enunciado.

${FIELD_RULES}

Responda APENAS um JSON neste formato:
${JSON_SHAPE}`;

export function extractionPromptFromTranscript(transcript: string): string {
  const clipped = transcript.trim().slice(0, 8000);
  return `O texto abaixo foi lido de uma guia TISS brasileira. Extraia um JSON. Use null se o dado não aparecer no texto. Não invente.

${FIELD_RULES}

Texto da guia:
"""
${clipped}
"""

Responda APENAS um JSON neste formato:
${JSON_SHAPE}`;
}
