import { buildHigiaSystemPrompt } from './higia.tools';

describe('buildHigiaSystemPrompt', () => {
  it('injects the current America/Sao_Paulo date', () => {
    const prompt = buildHigiaSystemPrompt(new Date('2026-09-21T18:00:00.000Z'));
    expect(prompt).toContain('Hoje e 2026-09-21 (America/Sao_Paulo)');
  });
});
