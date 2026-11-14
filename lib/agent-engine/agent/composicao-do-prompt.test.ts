import { describe, expect, it } from 'vitest';

import { medirComposicaoDoPrompt } from './composicao-do-prompt';

describe('medirComposicaoDoPrompt', () => {
  it('separa sistema, mensagens e ferramentas e aponta as mais pesadas', () => {
    const r = medirComposicaoDoPrompt({
      system: 'a'.repeat(3300),
      messages: [{ role: 'user', content: 'oi' }],
      tools: {
        pequena: { description: 'curta', inputSchema: { type: 'object' } },
        grande: { description: 'd'.repeat(1000), inputSchema: { type: 'object', properties: { x: { type: 'string', description: 'e'.repeat(2000) } } } },
      },
    });
    expect(r.sistema_tokens).toBe(1000);
    expect(r.ferramentas).toBe(2);
    expect(r.maiores_ferramentas[0]?.nome).toBe('grande');
    expect(r.total_tokens).toBe(r.sistema_tokens + r.mensagens_tokens + r.ferramentas_tokens);
  });
  it('nunca lança, mesmo com estrutura circular', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => medirComposicaoDoPrompt({ system: '', messages: [circular], tools: { t: { description: 'x', inputSchema: circular } } })).not.toThrow();
  });
});
