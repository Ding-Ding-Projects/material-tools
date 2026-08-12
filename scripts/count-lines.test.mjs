import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  classifyTrackedFile,
  formatReport,
  isAgentAuthoredCommit,
  lineStatsForContent,
  parseGitTrailers,
  summarizeRows,
} from './count-lines.mjs';

test('classifies every tracked repository file through the reviewed inventory', () => {
  const result = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const tracked = result.stdout.split('\0').filter(Boolean);
  assert.ok(tracked.length > 0);
  for (const file of tracked) assert.doesNotThrow(() => classifyTrackedFile(file), file);
});

test('excludes reviewed binary image formats without inventing textual lines', () => {
  for (const file of [
    'docs/captures/foundation/overview-light.png',
    'site/src/assets/action-illustrations/settings.webp',
    'assets/app-icon.ico',
  ]) {
    assert.deepEqual(classifyTrackedFile(file), {
      file,
      category: 'Excluded: Binary assets',
      textual: false,
      excluded: true,
    });
  }
});

test('excludes root and nested lockfiles while retaining their textual line totals', () => {
  for (const file of ['package-lock.json', 'site/package-lock.json', 'nested/pnpm-lock.yaml']) {
    assert.deepEqual(classifyTrackedFile(file), {
      file,
      category: 'Excluded: Lockfiles',
      textual: true,
      excluded: true,
    });
  }
});

test('maps reviewed text paths to stable reporting categories', () => {
  assert.equal(classifyTrackedFile('.github/workflows/release.yml').category, 'Automation');
  assert.equal(classifyTrackedFile('scripts/count-lines.mjs').category, 'Build and tooling');
  assert.equal(classifyTrackedFile('src/renderer/App.tsx').category, 'Source');
  assert.equal(classifyTrackedFile('site/src/App.test.tsx').category, 'Tests');
  assert.equal(classifyTrackedFile('site/src/styles.css').category, 'Styles and markup');
  assert.equal(classifyTrackedFile('docs/features/foundation-shell.md').category, 'Documentation');
  assert.deepEqual(classifyTrackedFile('docs/captures/foundation/manifest.json'), {
    file: 'docs/captures/foundation/manifest.json',
    category: 'Excluded: Generated evidence',
    textual: true,
    excluded: true,
  });
  assert.deepEqual(classifyTrackedFile('docs/captures/site/manifest.json'), {
    file: 'docs/captures/site/manifest.json',
    category: 'Excluded: Generated evidence',
    textual: true,
    excluded: true,
  });
  assert.equal(classifyTrackedFile('package.json').category, 'Project metadata');
});

test('fails closed when a newly tracked format has not been classified', () => {
  assert.throws(
    () => classifyTrackedFile('mystery/data.unreviewed'),
    /no reviewed text\/binary classification: mystery\/data\.unreviewed/,
  );
});

test('counts LF, CRLF, blank lines, and trailing newlines consistently', () => {
  assert.deepEqual(lineStatsForContent(''), { total: 0, nonblank: 0 });
  assert.deepEqual(lineStatsForContent('one\n\ntwo\n'), { total: 3, nonblank: 2 });
  assert.deepEqual(lineStatsForContent('one\r\n  \r\ntwo'), { total: 3, nonblank: 2 });
  assert.deepEqual(lineStatsForContent('one\r\rtwo\r'), { total: 3, nonblank: 2 });
});

test('attributes surviving lines from agent authors or agent co-author trailers', () => {
  assert.equal(isAgentAuthoredCommit('Claude Fable 5', 'Ship the release'), true);
  assert.equal(isAgentAuthoredCommit('release-automation[bot]', 'Ship the release'), true);
  assert.equal(
    isAgentAuthoredCommit(
      'A Human',
      'Ship the release\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>',
    ),
    true,
  );
  assert.equal(
    isAgentAuthoredCommit('A Human', 'Ship the release\n\nCo-Authored-By: Another Human <person@example.com>'),
    false,
  );
  assert.equal(isAgentAuthoredCommit('Anthropic Researcher', 'Ship the release'), false);
  assert.equal(
    isAgentAuthoredCommit(
      'A Human',
      'Document this literal example:\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>',
    ),
    false,
  );
});

test('parses only the final blank-line-delimited Git trailer block', () => {
  assert.deepEqual(
    parseGitTrailers(
      'Ship the release\n\nReviewed-By: Release Team <team@example.com>\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>\n',
    ),
    [
      { token: 'reviewed-by', value: 'Release Team <team@example.com>' },
      { token: 'co-authored-by', value: 'Claude Fable 5 <noreply@anthropic.com>' },
    ],
  );
  assert.deepEqual(
    parseGitTrailers('Document the syntax:\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>'),
    [],
  );
});

test('keeps project, grand, and attribution arithmetic exact', () => {
  const rows = new Map([
    ['Source', { files: 2, total: 10, nonblank: 8 }],
    ['Tests', { files: 1, total: 5, nonblank: 4 }],
    ['Excluded: Lockfiles', { files: 1, total: 7, nonblank: 7 }],
    ['Excluded: Generated evidence', { files: 2, total: 4, nonblank: 4 }],
    ['Excluded: Binary assets', { files: 3, total: 0, nonblank: 0 }],
  ]);
  const summary = summarizeRows(rows, 9);
  assert.equal(summary.projectFiles, 3);
  assert.equal(summary.projectTotal, 15);
  assert.equal(summary.projectNonblank, 12);
  assert.equal(summary.grandFiles, 9);
  assert.equal(summary.grandTotal, 26);
  assert.equal(summary.grandNonblank, 23);

  const report = formatReport(summary, { agentLines: 13, peopleLines: 2 });
  assert.match(report, /\*\*Project total\*\* \| \*\*3\*\* \| \*\*15\*\* \| \*\*12\*\*/);
  assert.match(report, /\*\*Grand total including excluded rows\*\* \| \*\*9\*\* \| \*\*26\*\* \| \*\*23\*\*/);
  assert.match(report, /\*\*Attribution total\*\* \| \*\*15\*\*/);
});
