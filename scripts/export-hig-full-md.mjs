import fs from 'node:fs/promises';

const tocUrl = 'https://developer.apple.com/tutorials/data/index/design--human-interface-guidelines';
const basePageUrl = 'https://sosumi.ai/design/human-interface-guidelines';

function collectPaths(items, out = []) {
  for (const item of items || []) {
    if (item?.path) {
      const normalized = item.path.replace(/^\/design\/human-interface-guidelines\/?/, '').replace(/^\/+|\/+$/g, '');
      if (normalized) out.push(normalized);
    }
    if (item?.children?.length) collectPaths(item.children, out);
  }
  return out;
}

const tocRes = await fetch(tocUrl, { headers: { Accept: 'application/json' } });
if (!tocRes.ok) throw new Error(`Failed to fetch ToC: ${tocRes.status}`);
const toc = await tocRes.json();

const uniquePaths = [...new Set(collectPaths(toc?.interfaceLanguages?.swift || []))];

let output = '';
output += '# Human Interface Guidelines (Complete Export)\n\n';
output += `Source index: https://developer.apple.com/design/human-interface-guidelines/\n`;
output += `Generated: ${new Date().toISOString()}\n\n`;
output += `Total pages: ${uniquePaths.length}\n\n`;
output += '---\n\n';

for (let i = 0; i < uniquePaths.length; i += 1) {
  const p = uniquePaths[i];
  const url = `${basePageUrl}/${p}`;
  const res = await fetch(url, { headers: { Accept: 'text/markdown' } });
  if (!res.ok) {
    output += `## ${p}\n\n`;
    output += `Failed to fetch: ${url} (${res.status})\n\n---\n\n`;
    continue;
  }
  const md = (await res.text()).trim();
  output += `<!-- PAGE ${i + 1}/${uniquePaths.length}: ${p} -->\n\n`;
  output += md;
  output += '\n\n---\n\n';
  process.stderr.write(`Fetched ${i + 1}/${uniquePaths.length}: ${p}\n`);
}

const outPath = 'out/human-interface-guidelines-full.md';
await fs.mkdir('out', { recursive: true });
await fs.writeFile(outPath, output, 'utf8');
console.log(outPath);
