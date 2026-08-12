import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { extname, posix } from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.bat',
  '.cjs',
  '.css',
  '.csv',
  '.cts',
  '.go',
  '.html',
  '.js',
  '.json',
  '.jsonl',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.ndjson',
  '.proto',
  '.ps1',
  '.py',
  '.rs',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsv',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const TEXT_FILENAMES = new Set([
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  '.nojekyll',
  'LICENSE',
]);

const BINARY_EXTENSIONS = new Set([
  '.7z',
  '.avif',
  '.bmp',
  '.dll',
  '.eot',
  '.exe',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.nupkg',
  '.otf',
  '.pdf',
  '.png',
  '.ttf',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);

const LOCKFILE_NAMES = new Set([
  'bun.lock',
  'bun.lockb',
  'Cargo.lock',
  'Gemfile.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

const MARKUP_EXTENSIONS = new Set(['.css', '.html', '.svg', '.xml']);

const GENERATED_TEXT_PATHS = new Set([
  'docs/captures/foundation/manifest.json',
  'docs/captures/site/manifest.json',
]);

const AGENT_IDENTITIES = new Set([
  'chatgpt',
  'claude',
  'claude code',
  'claude fable 5',
  'codex',
  'copilot',
  'github copilot',
  'openai codex',
]);

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout;
}

function normalizePath(file) {
  return file.replaceAll('\\', '/');
}

function textCategory(file) {
  const extension = extname(file).toLowerCase();
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) return 'Tests';
  if (file.startsWith('.github/')) return 'Automation';
  if (
    file.startsWith('docs/') ||
    /^(README|ROADMAP|HANDOFF|AGENTS|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|THIRD_PARTY_NOTICES)\.md$/i.test(file)
  ) {
    return 'Documentation';
  }
  if (file.startsWith('scripts/') || extension === '.bat' || extension === '.ps1') return 'Build and tooling';
  if (MARKUP_EXTENSIONS.has(extension)) return 'Styles and markup';
  if (file.startsWith('src/') || file.startsWith('site/src/')) return 'Source';
  return 'Project metadata';
}

export function classifyTrackedFile(input) {
  const file = normalizePath(input);
  const filename = posix.basename(file);
  const extension = extname(filename).toLowerCase();

  if (GENERATED_TEXT_PATHS.has(file)) {
    return { file, category: 'Excluded: Generated evidence', textual: true, excluded: true };
  }
  if (LOCKFILE_NAMES.has(filename)) {
    return { file, category: 'Excluded: Lockfiles', textual: true, excluded: true };
  }
  if (BINARY_EXTENSIONS.has(extension)) {
    return { file, category: 'Excluded: Binary assets', textual: false, excluded: true };
  }
  if (!TEXT_FILENAMES.has(filename) && !TEXT_EXTENSIONS.has(extension)) {
    throw new Error(`Tracked file has no reviewed text/binary classification: ${file}`);
  }
  return { file, category: textCategory(file), textual: true, excluded: false };
}

export function lineStatsForContent(content) {
  if (content.length === 0) return { total: 0, nonblank: 0 };
  const lines = content.split(/\r\n|\n|\r/);
  if (lines.at(-1) === '') lines.pop();
  return { total: lines.length, nonblank: lines.filter((line) => line.trim().length > 0).length };
}

function isAgentIdentity(identity) {
  const normalized = identity.trim().toLowerCase();
  if (AGENT_IDENTITIES.has(normalized) || normalized.endsWith('[bot]')) return true;
  return /^(?:automation|bot)(?:[-_]|$)|(?:^|[-_])automation(?:[-_]|$)/.test(normalized);
}

export function parseGitTrailers(message) {
  const lines = message.replace(/\r\n|\r/g, '\n').split('\n');
  while (lines.at(-1)?.trim() === '') lines.pop();

  const trailers = [];
  let index = lines.length - 1;
  for (; index >= 0; index -= 1) {
    const match = /^([A-Za-z0-9-]+):\s*(.+)$/.exec(lines[index]);
    if (!match) break;
    trailers.unshift({ token: match[1].toLowerCase(), value: match[2].trim() });
  }
  if (trailers.length === 0) return [];
  if (index >= 0 && lines[index].trim() !== '') return [];
  return trailers;
}

export function isAgentAuthoredCommit(author, message) {
  if (isAgentIdentity(author)) return true;
  return parseGitTrailers(message)
    .filter((trailer) => trailer.token === 'co-authored-by')
    .some((trailer) => isAgentIdentity(trailer.value.replace(/\s*<[^>]+>\s*$/, '')));
}

export function summarizeRows(rows, trackedFileCount) {
  const sortedRows = [...rows.entries()].sort(([left], [right]) => left.localeCompare(right));
  const projectRows = sortedRows.filter(([name]) => !name.startsWith('Excluded:'));
  return {
    sortedRows,
    projectRows,
    projectFiles: projectRows.reduce((sum, [, value]) => sum + value.files, 0),
    projectTotal: projectRows.reduce((sum, [, value]) => sum + value.total, 0),
    projectNonblank: projectRows.reduce((sum, [, value]) => sum + value.nonblank, 0),
    grandFiles: trackedFileCount,
    grandTotal: sortedRows.reduce((sum, [, value]) => sum + value.total, 0),
    grandNonblank: sortedRows.reduce((sum, [, value]) => sum + value.nonblank, 0),
  };
}

export function formatReport(summary, attribution) {
  const lines = [
    '| Category | Files | Total lines | Non-blank lines |',
    '|---|---:|---:|---:|',
    ...summary.sortedRows.map(
      ([name, value]) => `| ${name} | ${value.files} | ${value.total} | ${value.nonblank} |`,
    ),
    `| **Project total** | **${summary.projectFiles}** | **${summary.projectTotal}** | **${summary.projectNonblank}** |`,
    `| **Grand total including excluded rows** | **${summary.grandFiles}** | **${summary.grandTotal}** | **${summary.grandNonblank}** |`,
    '',
    '| Surviving-line attribution | Lines |',
    '|---|---:|',
    `| Agent-authored | ${attribution.agentLines} |`,
    `| People-authored | ${attribution.peopleLines} |`,
    `| **Attribution total** | **${attribution.agentLines + attribution.peopleLines}** |`,
    '',
    'Excluded rows contain tracked lockfiles, generated capture manifests, and binary assets; binary assets contribute file counts but no textual lines. Installed dependencies, build output, and untracked generated or vendored trees are outside the tracked-file inventory. Attribution uses surviving `git blame` lines. A commit counts as agent-authored when its author is an exact agent or automation identity, or when its final Git trailer block carries a `Co-Authored-By` trailer naming one.',
  ];
  return lines.join('\n');
}

function countAttribution(classifications) {
  const survivingLinesByCommit = new Map();
  for (const { file, textual, excluded } of classifications) {
    if (!textual || excluded) continue;
    const blame = spawnSync('git', ['blame', '--line-porcelain', '--root', 'HEAD', '--', file], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (blame.status !== 0) {
      throw new Error(blame.stderr.trim() || `git blame failed for ${file}`);
    }
    let commit = '';
    for (const line of blame.stdout.split(/\r?\n/)) {
      const header = /^\^?([0-9a-f]{40,64}) \d+ \d+(?: \d+)?$/.exec(line);
      if (header) commit = header[1];
      if (!line.startsWith('\t')) continue;
      if (!commit) throw new Error(`git blame did not identify the commit for a surviving line in ${file}`);
      survivingLinesByCommit.set(commit, (survivingLinesByCommit.get(commit) ?? 0) + 1);
    }
  }

  let agentLines = 0;
  let peopleLines = 0;
  for (const [commit, lines] of survivingLinesByCommit) {
    const metadata = git(['show', '-s', '--format=%an%x00%B', commit]);
    const separator = metadata.indexOf('\0');
    if (separator < 0) throw new Error(`git show did not return reviewed attribution metadata for ${commit}`);
    const author = metadata.slice(0, separator).trim();
    const message = metadata.slice(separator + 1);
    if (isAgentAuthoredCommit(author, message)) agentLines += lines;
    else peopleLines += lines;
  }
  return { agentLines, peopleLines };
}

export function buildReport() {
  const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean).sort();
  const classifications = tracked.map(classifyTrackedFile);
  const rows = new Map();

  for (const classification of classifications) {
    const stats = classification.textual
      ? lineStatsForContent(git(['show', `HEAD:${classification.file}`]))
      : { total: 0, nonblank: 0 };
    const current = rows.get(classification.category) ?? { files: 0, total: 0, nonblank: 0 };
    current.files += 1;
    current.total += stats.total;
    current.nonblank += stats.nonblank;
    rows.set(classification.category, current);
  }

  const summary = summarizeRows(rows, tracked.length);
  const attribution = countAttribution(classifications);
  if (attribution.agentLines + attribution.peopleLines !== summary.projectTotal) {
    throw new Error(
      `Surviving-line attribution ${attribution.agentLines + attribution.peopleLines} does not equal project total ${summary.projectTotal}.`,
    );
  }
  return formatReport(summary, attribution);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) console.log(buildReport());
