import { describe, expect, it } from 'vitest';
import { CAPABILITY_READINESS_LABELS, PLANNED_CAPABILITY_CARDS } from './capability-workspace';

describe('planned capability workspace content', () => {
  it('gives every unavailable lane four action-specific, bilingual readiness cards', () => {
    expect(Object.keys(PLANNED_CAPABILITY_CARDS)).toEqual(['tweaks', 'config', 'updates', 'microwin']);
    for (const [lane, cards] of Object.entries(PLANNED_CAPABILITY_CARDS)) {
      expect(cards, lane).toHaveLength(4);
      expect(new Set(cards.map((card) => card.id)).size, lane).toBe(cards.length);
      for (const card of cards) {
        expect(card.title.length).toBeGreaterThan(3);
        expect(card.titleYue.length).toBeGreaterThan(2);
        expect(card.description.length).toBeGreaterThan(30);
        expect(card.descriptionYue.length).toBeGreaterThan(15);
        expect(CAPABILITY_READINESS_LABELS[card.readiness]).toBeDefined();
      }
    }
  });

  it('keeps every readiness label bilingual and explicit about what is missing', () => {
    for (const label of Object.values(CAPABILITY_READINESS_LABELS)) {
      expect(label.en).toMatch(/required$/);
      expect(label.yue).toContain('需要');
    }
  });
});
