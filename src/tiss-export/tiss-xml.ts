import { createHash } from 'crypto';
import { TISS_NAMESPACE } from './tiss-constants';

export class XmlBuilder {
  private readonly leaves: string[] = [];

  leaf(name: string, value: string): string {
    this.leaves.push(value);
    return `<ans:${name}>${escapeXml(value)}</ans:${name}>`;
  }

  branch(name: string, children: string[]): string {
    return `<ans:${name}>${children.join('')}</ans:${name}>`;
  }

  hashHex(): string {
    return createHash('md5').update(this.leaves.join(''), 'utf8').digest('hex');
  }
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function wrapMensagem(cabecalho: string, corpo: string, hash: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<ans:mensagemTISS xmlns:ans="${TISS_NAMESPACE}">` +
    cabecalho +
    corpo +
    `<ans:epilogo><ans:hash>${escapeXml(hash)}</ans:hash></ans:epilogo>` +
    `</ans:mensagemTISS>`
  );
}

export function formatTissDecimal(value: number): string {
  return value.toFixed(2);
}

export function formatYmdSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatHmsSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.hour}:${byType.minute}:${byType.second}`;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
