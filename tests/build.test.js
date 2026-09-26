import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('build stamps the checkout into generated HTML, preserves source, and marks local changes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'diary-build-'));
  const run = (cmd, args, env = process.env) => execFileSync(cmd, args, { cwd: dir, env, encoding: 'utf8' }).trim();
  try {
    await mkdir(join(dir, 'public'));
    const template = '<small>__BUILD_LABEL__</small><small>__BUILD_LABEL__</small>';
    await writeFile(join(dir, 'public/index.html'), template);
    await writeFile(join(dir, '.gitignore'), 'dist/\n');
    run('git', ['init', '-q']);
    run('git', ['add', '.']);
    run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture']);
    const commit = run('git', ['rev-parse', '--short=7', 'HEAD']);
    const env = { ...process.env, DIARY_LOCAL_BUILD: '' };
    run(process.execPath, [resolve('scripts/build.js')], env);
    assert.equal(await readFile(join(dir, 'dist/public/index.html'), 'utf8'), template.replaceAll('__BUILD_LABEL__', `build ${commit}`));
    assert.equal(await readFile(join(dir, 'public/index.html'), 'utf8'), template);
    await writeFile(join(dir, 'public/style.css'), 'body{}');
    run(process.execPath, [resolve('scripts/build.js')], { ...env, DIARY_LOCAL_BUILD: '1' });
    assert.match(await readFile(join(dir, 'dist/public/index.html'), 'utf8'), new RegExp(`local ${commit} \\+変更あり`));
    assert.equal(await readFile(join(dir, 'dist/public/style.css'), 'utf8'), 'body{}');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
