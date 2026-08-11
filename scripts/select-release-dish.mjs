const runNumber = Number.parseInt(process.env.GITHUB_RUN_NUMBER ?? '1', 10);
if (!Number.isSafeInteger(runNumber) || runNumber < 1) throw new Error('GITHUB_RUN_NUMBER must be a positive integer.');

const catalogUrl = 'https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json';
const response = await fetch(catalogUrl, { signal: AbortSignal.timeout(20_000) });
if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}.`);
const catalog = await response.json();
if (!Array.isArray(catalog.dishes) || catalog.dishes.length === 0) throw new Error('Catalog has no dishes.');

// The first catalog-v1 volume publishes dishes 0001-0995. Keeping the rotating
// pool within its first 900 entries provides one verifiable public asset per run.
const pool = catalog.dishes.slice(0, 900);
const dish = pool[(runNumber - 1) % pool.length];
const filename = dish.image.path.split('/').at(-1);
const assetUrl = `https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/${filename}`;
const assetResponse = await fetch(assetUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20_000) });
if (!assetResponse.ok) throw new Error(`Published dish asset is unavailable: HTTP ${assetResponse.status} ${assetUrl}`);

process.stdout.write(JSON.stringify({
  id: dish.id,
  name: `${dish.name.en} · ${dish.name.zhHant}`,
  filename,
  assetUrl,
  catalogUrl,
}));
