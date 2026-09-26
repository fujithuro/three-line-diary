import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

// Read the checkout being built, rather than the current remote branch tip.
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', '--short=7', 'HEAD');
if (!/^[0-9a-f]{7,40}$/.test(commit)) throw new Error('Invalid build commit');
const dirty = git('status', '--porcelain', '--untracked-files=normal') !== '';
const local = process.env.DIARY_LOCAL_BUILD === '1';
const label = `${local ? 'local' : 'build'} ${commit}${dirty ? ' +変更あり' : ''}`;
const source = await readFile('public/index.html', 'utf8');
if (!source.includes('__BUILD_LABEL__')) throw new Error('Missing build placeholder');

await mkdir('dist', { recursive: true });
await rm('dist/public', { recursive: true, force: true });
await cp('public', 'dist/public', { recursive: true });
await writeFile('dist/public/index.html', source.replaceAll('__BUILD_LABEL__', label));
console.log(`Generated assets: ${label}`);
