import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  validateReleaseCaptureEvidence,
  validateReleaseWorkflow,
} from './validate-release-workflow.mjs';

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

test('accepts the committed release evidence contract', () => {
  assert.equal(validateReleaseWorkflow(workflow), true);
});

test('accepts the local repository capture files and manifest dimensions', () => {
  assert.equal(validateReleaseCaptureEvidence(), true);
});

test('rejects run creation time in place of the first job startedAt boundary', () => {
  const broken = workflow.replace(
    '[DateTimeOffset]::Parse($firstJob.started_at).ToUniversalTime()',
    '[DateTimeOffset]::Parse($payload.run_started_at).ToUniversalTime()',
  );
  assert.notEqual(broken, workflow);
  assert.throws(() => validateReleaseWorkflow(broken), /first job startedAt/);
});

test('rejects initial release publishedAt in place of publication-step completion', () => {
  const broken = workflow.replace(
    '[DateTimeOffset]::Parse($publicationStep.completed_at).ToUniversalTime()',
    '[DateTimeOffset]::Parse($release.publishedAt).ToUniversalTime()',
  );
  assert.notEqual(broken, workflow);
  assert.throws(() => validateReleaseWorkflow(broken), /completed publication and verification step/);
});

test('rejects duration formatting that wraps after 24 hours', () => {
  const broken = workflow.replace('$duration.TotalHours', '$duration.Hours');
  assert.notEqual(broken, workflow);
  assert.throws(() => validateReleaseWorkflow(broken), /preserves total hours beyond one day/);
});

test('rejects a capture that is not both listed and embedded', () => {
  const capturePath = 'docs/captures/site/overview-narrow.png';
  const broken = workflow.replaceAll(capturePath, 'docs/captures/site/missing.png');
  assert.notEqual(broken, workflow);
  assert.throws(() => validateReleaseWorkflow(broken), /list and embed the repository capture/);
});

test('does not accept capture paths mentioned only in comments', () => {
  const capturePath = 'docs/captures/site/overview-narrow.png';
  const broken = `${workflow.replaceAll(capturePath, 'docs/captures/site/missing.png')}\n# ${capturePath}\n# ${capturePath}\n`;
  assert.throws(() => validateReleaseWorkflow(broken), /list and embed the repository capture/);
});

test('rejects a screenshot gate in GitHub Actions', () => {
  const broken = workflow.replace(
    '          $rawBase =',
    '          git cat-file -e $captureObject\n          $rawBase =',
  );
  assert.notEqual(broken, workflow);
  assert.throws(() => validateReleaseWorkflow(broken), /unsafe literal interpolation/);
});

test('rejects removal of the public UI feature summary', () => {
  const broken = workflow.replace('## Interface summary', '## Build summary');
  assert.notEqual(broken, workflow);
  assert.throws(() => validateReleaseWorkflow(broken), /public interface summary/);
});

test('rejects direct and wrapped quality commands in GitHub Actions', () => {
  for (const command of ['npx vitest run', 'node --test scripts/example.test.mjs', 'tsc --noEmit']) {
    const broken = `${workflow}\n      - run: ${command}\n`;
    assert.throws(
      () => validateReleaseWorkflow(broken),
      /Quality command must remain local, not in GitHub Actions/,
      command,
    );
  }
});
