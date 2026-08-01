import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const distDir = path.join(projectRoot, 'dist');
const budgetFile = path.join(projectRoot, 'config', 'performance-budgets.json');
const manifestFile = path.join(distDir, '.vite', 'manifest.json');
const imageExtensions = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);

const walkFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
    })
  );
  return nested.flat();
};

const formatBytes = (value) => {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
};

const loadBudgets = async () => JSON.parse(await readFile(budgetFile, 'utf8'));

const run = async () => {
  try {
    const distStats = await stat(distDir);
    if (!distStats.isDirectory()) {
      throw new Error('dist is not a directory');
    }
  } catch {
    throw new Error('No production build found. Run `npm run build` first.');
  }

  const [budgets, files] = await Promise.all([loadBudgets(), walkFiles(distDir)]);
  const summary = {
    distBytes: 0,
    javascriptBytes: 0,
    javascriptGzipBytes: 0,
    initialJavascriptGzipBytes: 0,
    cssGzipBytes: 0,
    largestImageBytes: 0,
    fileCount: files.length,
  };
  let largestImage = '';
  const gzipBytesByRelativePath = new Map();

  for (const file of files) {
    const fileStats = await stat(file);
    const extension = path.extname(file).toLowerCase();
    summary.distBytes += fileStats.size;

    if (extension === '.js' || extension === '.css') {
      const source = await readFile(file);
      const gzipBytes = gzipSync(source, { level: 9 }).byteLength;
      if (extension === '.js') {
        summary.javascriptBytes += fileStats.size;
        summary.javascriptGzipBytes += gzipBytes;
        gzipBytesByRelativePath.set(path.relative(distDir, file), gzipBytes);
      } else {
        summary.cssGzipBytes += gzipBytes;
      }
    }

    if (imageExtensions.has(extension) && fileStats.size > summary.largestImageBytes) {
      summary.largestImageBytes = fileStats.size;
      largestImage = path.relative(distDir, file);
    }
  }

  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const initialChunkKeys = new Set();
  const collectInitialChunks = (key) => {
    if (initialChunkKeys.has(key)) {
      return;
    }
    initialChunkKeys.add(key);
    const entry = manifest[key];
    entry?.imports?.forEach(collectInitialChunks);
  };
  Object.entries(manifest)
    .filter(([, entry]) => entry.isEntry)
    .forEach(([key]) => collectInitialChunks(key));

  summary.initialJavascriptGzipBytes = Array.from(initialChunkKeys).reduce((total, key) => {
    const outputFile = manifest[key]?.file;
    return total + (gzipBytesByRelativePath.get(outputFile) ?? 0);
  }, 0);

  const checks = Object.entries(budgets).map(([metric, limit]) => ({
    metric,
    actual: summary[metric],
    limit,
    passed: summary[metric] <= limit,
  }));

  console.table(
    checks.map(({ metric, actual, limit, passed }) => ({
      metric,
      actual: metric === 'fileCount' ? actual : formatBytes(actual),
      budget: metric === 'fileCount' ? limit : formatBytes(limit),
      status: passed ? 'PASS' : 'FAIL',
    }))
  );
  if (largestImage) {
    console.log(`Largest image: ${largestImage} (${formatBytes(summary.largestImageBytes)})`);
  }

  const failures = checks.filter((check) => !check.passed);
  if (failures.length > 0) {
    throw new Error(`Performance budget exceeded: ${failures.map(({ metric }) => metric).join(', ')}`);
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
