import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

describe('action illustration dialog layout', () => {
  it('keeps dialog illustrations and interactive content in one explicit grid column', () => {
    expect(stylesSource).toMatch(/\.command-palette\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/su);
  });
});
