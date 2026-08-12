import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_SOURCE = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');

describe('private vocabulary App persistence boundary', () => {
  it('never clears a preserved legacy cache merely because the App mounted', () => {
    expect(APP_SOURCE).toContain('const [vocabulary, setVocabularyState] = useState(loadPrivateVocabulary);');
    expect(APP_SOURCE).toContain('persistPrivateVocabulary(next);');
    expect(APP_SOURCE).toContain('setVocabulary={updateVocabulary}');
    expect(APP_SOURCE).not.toMatch(/useEffect\(\(\) => \{[\s\S]{0,300}PRIVATE_VOCABULARY_STORAGE_KEY/);
  });
});
