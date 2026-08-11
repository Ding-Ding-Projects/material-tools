import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workflowUrl = new URL('../.github/workflows/release.yml', import.meta.url);
const workflow = readFileSync(workflowUrl, 'utf8').replaceAll('\r\n', '\n');

const requiredFragments = [
  'Publish and verify one unique release',
  "--notes 'Release evidence is being finalized by this workflow.'",
  "gh release edit $env:RELEASE_TAG --notes-file release-notes.md",
  "gh release view $env:RELEASE_TAG --json body",
  "if ($published.body.Contains($marker))",
  "if (-not $published.body.Contains($value))",
  "[DateTimeOffset]::Parse($run.run_started_at)",
  "[DateTimeOffset]::Parse($release.publishedAt)",
  "__SETUP_HASH__",
  "__PACKAGE_HASH__",
  "__LINE_COUNT__",
];

for (const fragment of requiredFragments) {
  if (!workflow.includes(fragment)) {
    throw new Error(`Release workflow contract is missing: ${fragment}`);
  }
}

const prohibitedFragments = [
  '`$env:',
  '`$setupHash',
  '`$packageHash',
  '`$completedText',
  '`$durationText',
  'Publish and verify one immutable release',
];

for (const fragment of prohibitedFragments) {
  if (workflow.includes(fragment)) {
    throw new Error(`Release workflow contains an unsafe literal interpolation: ${fragment}`);
  }
}

const workflowCommands = workflow
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const forbiddenQualityCommands = [
  /^npm\s+(?:test|run\s+(?:test|lint|typecheck|check))\b/i,
  /^(?:pnpm|yarn)\s+(?:test|lint|typecheck|check)\b/i,
];

for (const command of workflowCommands) {
  if (forbiddenQualityCommands.some((pattern) => pattern.test(command))) {
    throw new Error(`Quality command must remain local, not in GitHub Actions: ${command}`);
  }
}

console.log(`Release workflow contract verified: ${fileURLToPath(workflowUrl)}`);
