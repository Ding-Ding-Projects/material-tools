import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const workflowUrl = new URL('../.github/workflows/release.yml', import.meta.url);

const requiredContracts = [
  {
    description: 'a release on every pushed branch and manual dispatch',
    fragment: 'push:\n    branches:\n      - "**"\n  workflow_dispatch:',
  },
  {
    description: 'read access to Actions timing evidence',
    fragment: 'permissions:\n  actions: read\n  contents: write',
  },
  {
    description: 'the unique release publication and verification step',
    fragment: '- name: Publish and verify one unique release',
  },
  {
    description: 'the post-publication release-note finalization step',
    fragment: '- name: Finalize release notes with completed timing',
  },
  {
    description: 'the Actions jobs endpoint used for completed step timing',
    fragment: 'actions/runs/$env:GITHUB_RUN_ID/jobs?filter=latest&per_page=100',
  },
  {
    description: 'selection of the completed release publication step',
    fragment: "Where-Object { $_.name -eq 'Publish and verify one unique release' }",
  },
  {
    description: 'selection of the earliest job start',
    fragment: 'Sort-Object { [DateTimeOffset]::Parse($_.started_at) } | Select-Object -First 1',
  },
  {
    description: 'timing from the first job startedAt value',
    fragment: '[DateTimeOffset]::Parse($firstJob.started_at).ToUniversalTime()',
  },
  {
    description: 'timing through the completed publication and verification step',
    fragment: '[DateTimeOffset]::Parse($publicationStep.completed_at).ToUniversalTime()',
  },
  {
    description: 'a required completed publication-step timestamp',
    fragment: "if (-not $publicationStep) { throw 'The completed release publication step was not available from the Actions jobs API.' }",
  },
  {
    description: 'a required first-job start timestamp',
    fragment: "if (-not $firstJob) { throw 'The first job start was not available from the Actions jobs API.' }",
  },
  {
    description: 'duration arithmetic over the reviewed timing boundaries',
    fragment: '$duration = $completedAt - $startedAt',
  },
  {
    description: 'a nonnegative duration assertion',
    fragment: "if ($duration.TotalSeconds -lt 0) { throw 'Release workflow timing completed before it started.' }",
  },
  {
    description: 'duration formatting that preserves total hours beyond one day',
    fragment:
      "'{0:00}:{1:00}:{2:00}' -f [math]::Floor($duration.TotalHours), $duration.Minutes, $duration.Seconds",
  },
  {
    description: 'commit-pinned raw capture URLs',
    fragment: 'https://raw.githubusercontent.com/$env:GITHUB_REPOSITORY/$env:GITHUB_SHA',
  },
  {
    description: 'a clickable exact release commit',
    fragment: '[`__COMMIT__`](__COMMIT_URL__)',
  },
  {
    description: 'the public interface summary',
    fragment: '## Interface summary',
  },
  {
    description: 'the concise Material Design 3 feature summary',
    fragment: 'The Windows desktop app and documentation site use Material Design 3 throughout',
  },
  {
    description: 'final release-note publication',
    fragment: 'gh release edit $env:RELEASE_TAG --notes-file release-notes.md',
  },
  {
    description: 'final release-note body verification',
    fragment: 'gh release view $env:RELEASE_TAG --json body',
  },
  {
    description: 'unresolved template marker verification',
    fragment: 'if ($published.body.Contains($marker))',
  },
  {
    description: 'published evidence verification',
    fragment: 'if (-not $published.body.Contains($value))',
  },
  { description: 'installer SHA-256 evidence', fragment: '__SETUP_HASH__' },
  { description: 'update package SHA-256 evidence', fragment: '__PACKAGE_HASH__' },
  { description: 'line-count evidence', fragment: '__LINE_COUNT__' },
];

const releaseCaptures = [
  {
    path: 'docs/captures/foundation/overview-light-bilingual.png',
    manifest: 'docs/captures/foundation/manifest.json',
  },
  {
    path: 'docs/captures/foundation/regex-builder.png',
    manifest: 'docs/captures/foundation/manifest.json',
  },
  {
    path: 'docs/captures/site/overview-narrow.png',
    manifest: 'docs/captures/site/manifest.json',
  },
  {
    path: 'docs/captures/site/private-vocabulary-unloaded.png',
    manifest: 'docs/captures/site/manifest.json',
  },
];

const prohibitedTimingSources = [
  'run_started_at',
  '.publishedAt',
  'Record workflow start',
  'WORKFLOW_STARTED=',
];

const prohibitedFragments = [
  '`$env:',
  '`$setupHash',
  '`$packageHash',
  '`$completedText',
  '`$durationText',
  'Publish and verify one immutable release',
  'git cat-file -e $captureObject',
  'Release capture manifest is missing',
];

const forbiddenQualityCommands = [
  /^npm\s+(?:test|run\s+(?:test|lint|typecheck|check))\b/i,
  /^(?:pnpm|yarn)\s+(?:test|lint|typecheck|check)\b/i,
  /^(?:npx|npm\s+exec(?:\s+--)?)\s+(?:vitest|jest|eslint|tsc|biome|prettier)\b/i,
  /^(?:pnpm|yarn)\s+(?:exec|dlx)\s+(?:vitest|jest|eslint|tsc|biome|prettier)\b/i,
  /^(?:vitest|jest|eslint|tsc|biome|prettier)\b/i,
  /^node\s+--test\b/i,
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractRequiredBlock(source, startMarker, endMarker, description) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Release workflow is missing ${description}.`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Release workflow has an unterminated ${description}.`);
  return source.slice(start + startMarker.length, end);
}

export function validateReleaseWorkflow(input) {
  const workflow = input.replace(/\r\n|\r/g, '\n');

  for (const contract of requiredContracts) {
    if (!workflow.includes(contract.fragment)) {
      throw new Error(`Release workflow contract is missing ${contract.description}: ${contract.fragment}`);
    }
  }

  const captureArray = extractRequiredBlock(
    workflow,
    '          $capturePaths = @(\n',
    '\n          )',
    'release capture list',
  );
  const releaseTemplate = extractRequiredBlock(
    workflow,
    "          $template = @'\n",
    "\n          '@",
    'release-note template',
  );
  for (const capture of releaseCaptures) {
    const escapedPath = escapeRegExp(capture.path);
    const listEntry = new RegExp(`^\\s*'${escapedPath}',?\\s*$`, 'm');
    const imageEntry = new RegExp(`^\\s*!\\[[^\\]]+\\]\\(__RAW_BASE__/${escapedPath}\\)\\s*$`, 'm');
    if (!listEntry.test(captureArray) || !imageEntry.test(releaseTemplate)) {
      throw new Error(
        `Release workflow must list and embed the repository capture: ${capture.path}`,
      );
    }
  }

  for (const fragment of prohibitedTimingSources) {
    if (workflow.includes(fragment)) {
      throw new Error(`Release workflow uses a prohibited timing source: ${fragment}`);
    }
  }

  for (const fragment of prohibitedFragments) {
    if (workflow.includes(fragment)) {
      throw new Error(`Release workflow contains an unsafe literal interpolation: ${fragment}`);
    }
  }

  const publicationIndex = workflow.indexOf('- name: Publish and verify one unique release');
  const finalizationIndex = workflow.indexOf('- name: Finalize release notes with completed timing');
  if (publicationIndex < 0 || finalizationIndex <= publicationIndex) {
    throw new Error('Release-note finalization must follow the completed release publication step.');
  }

  const workflowCommands = workflow
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .flatMap((line) => {
      const withoutListMarker = line.replace(/^-\s+/, '');
      const runCommand = withoutListMarker.replace(/^run:\s*/i, '');
      return runCommand === line ? [line] : [line, runCommand];
    });
  for (const command of workflowCommands) {
    if (forbiddenQualityCommands.some((pattern) => pattern.test(command))) {
      throw new Error(`Quality command must remain local, not in GitHub Actions: ${command}`);
    }
  }

  return true;
}

export function validateReleaseCaptureEvidence() {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const manifestCache = new Map();

  for (const capture of releaseCaptures) {
    const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '--', capture.path], {
      encoding: 'utf8',
    });
    if (tracked.status !== 0) {
      throw new Error(`Release capture is not tracked in the repository: ${capture.path}`);
    }
    const bytes = readFileSync(new URL(`../${capture.path}`, import.meta.url));
    if (!bytes.subarray(0, pngSignature.length).equals(pngSignature)) {
      throw new Error(`Release capture is not a PNG asset: ${capture.path}`);
    }
    if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
      throw new Error(`Release capture has no PNG IHDR dimensions: ${capture.path}`);
    }
    const imageWidth = bytes.readUInt32BE(16);
    const imageHeight = bytes.readUInt32BE(20);

    let manifest = manifestCache.get(capture.manifest);
    if (!manifest) {
      manifest = JSON.parse(readFileSync(new URL(`../${capture.manifest}`, import.meta.url), 'utf8'));
      manifestCache.set(capture.manifest, manifest);
    }
    const filename = capture.path.split('/').at(-1);
    const entries = manifest.captures.filter((entry) => entry.file === filename);
    if (entries.length !== 1) {
      throw new Error(`Release capture manifest must contain exactly one entry for ${capture.path}`);
    }
    const [entry] = entries;
    for (const field of ['width', 'height', 'bytes']) {
      if (!Number.isSafeInteger(entry[field]) || entry[field] <= 0) {
        throw new Error(`Release capture manifest has an invalid ${field} for ${capture.path}`);
      }
    }
    if (entry.bytes !== bytes.length) {
      throw new Error(`Release capture byte size does not match its manifest entry: ${capture.path}`);
    }
    if (entry.width !== imageWidth || entry.height !== imageHeight) {
      throw new Error(`Release capture dimensions do not match its PNG IHDR: ${capture.path}`);
    }
  }

  return true;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  validateReleaseWorkflow(readFileSync(workflowUrl, 'utf8'));
  validateReleaseCaptureEvidence();
  console.log(`Release workflow contract verified: ${workflowUrl.pathname}`);
}
