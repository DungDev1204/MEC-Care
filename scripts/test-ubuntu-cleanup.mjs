// Run on Linux: CLIENTE_CLEANUP_SCRIPT=/path/to/cleanup-old-releases.sh node --test this-file.mjs
// All destructive operations use isolated fixture directories, never production paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const sourcePath = process.env.CLIENTE_CLEANUP_SCRIPT || fileURLToPath(new URL('../deploy/ubuntu/cleanup-old-releases.sh', import.meta.url));
function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cliente-cleanup-test-'));
  const root = path.join(base, 'opt/cliente/releases');
  const current = path.join(root, 'new');
  const old = [path.join(root, 'old-1'), path.join(root, 'old-2')];
  const config = path.join(base, 'etc/cliente/.env');
  const outside = path.join(base, 'other-service');
  const uploads = path.join(base, 'home/robotics/cliente-upload');
  const keepArchive = path.join(uploads, 'cliente-release-20261008T090000Z.tar.gz');
  const oldArchives = ['cliente-auth-20261008.tar.gz', 'cliente-node.tar.gz', 'cliente-linux-x64.tar.gz'].map(name => path.join(uploads, name));
  const keepFiles = ['smtp-deploy-auth.json', '.env', 'update.sh', 'cliente-backup-20261008.tar.gz', 'other-app.tar.gz'];
  for (const dir of [path.join(current, 'dist'), path.join(current, 'wwwroot'), uploads, ...old, path.dirname(config), outside, path.join(base, 'bin')]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(current, 'dist/server.js'), 'fixture');
  fs.writeFileSync(path.join(current, 'wwwroot/index.html'), 'current frontend');
  execFileSync('tar', ['-czf', keepArchive, '-C', current, './wwwroot/index.html']);
  oldArchives.forEach(file => fs.writeFileSync(file, 'old package'));
  keepFiles.forEach(file => fs.writeFileSync(path.join(uploads, file), 'must remain'));
  fs.symlinkSync(path.join(outside, 'keep.txt'), path.join(uploads, 'cliente-ui-20260101.tar.gz'));
  fs.writeFileSync(config, 'configuration must remain');
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'other service must remain');
  fs.symlinkSync(current, path.join(base, 'opt/cliente/current'));
  fs.symlinkSync(outside, path.join(old[0], 'external'));
  fs.symlinkSync(outside, path.join(root, 'external-release'));
  const source = fs.readFileSync(sourcePath, 'utf8')
    .replace('[[ $EUID -eq 0 ]]', `[[ $EUID -eq ${process.getuid()} ]]`)
    .replaceAll('/opt/cliente', path.join(base, 'opt/cliente'))
    .replaceAll('/etc/cliente', path.join(base, 'etc/cliente'))
    .replaceAll('/home/robotics/cliente-upload', uploads)
    .replaceAll(path.join(base, 'opt/cliente/node/bin/node'), process.execPath);
  const script = path.join(base, 'cleanup.sh'); fs.writeFileSync(script, source);
  fs.writeFileSync(path.join(base, 'bin/systemctl'), '#!/bin/bash\nif [[ "$1" == "is-active" ]]; then exit 0; fi\nif [[ "$1" == "show" ]]; then cat "$MOCK_PID_FILE"; exit 0; fi\nexit 1\n', { mode: 0o700 });
  fs.writeFileSync(path.join(base, 'bin/curl'), '#!/bin/bash\nif [[ "$MOCK_HEALTH" == "http-error" ]]; then exit 22; fi\nprintf "%s" "$MOCK_HEALTH"\n', { mode: 0o700 });
  const healthy = JSON.stringify({ runtime: 'node', mode: 'sqlServer', status: 'running' });
  const run = ({ health = healthy, cwd = current, expected = current, archive } = {}) => {
    try {
      const output = execFileSync('bash', ['-c', 'printf "%s" "$$" > "$MOCK_PID_FILE"; exec bash "$MOCK_CLEANUP" "$MOCK_CURRENT" ${MOCK_ARCHIVE:+"$MOCK_ARCHIVE"}'], {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PATH: path.join(base, 'bin') + ':' + process.env.PATH, MOCK_PID_FILE: path.join(base, 'pid'), MOCK_CLEANUP: script, MOCK_CURRENT: expected, MOCK_HEALTH: health, MOCK_ARCHIVE: archive || '' }
      }); return { status: 0, output };
    } catch (error) { return { status: error.status, output: String(error.stdout) + String(error.stderr) }; }
  };
  const preserved = () => {
    assert.equal(fs.readFileSync(config, 'utf8'), 'configuration must remain');
    assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'other service must remain');
    assert.ok(fs.existsSync(path.join(current, 'dist/server.js')));
    assert.ok(fs.existsSync(keepArchive));
    keepFiles.forEach(file => assert.equal(fs.readFileSync(path.join(uploads, file), 'utf8'), 'must remain'));
    assert.ok(fs.lstatSync(path.join(uploads, 'cliente-ui-20260101.tar.gz')).isSymbolicLink());
  };
  const dispose = () => {
    assert.equal(path.dirname(base), os.tmpdir());
    assert.ok(path.basename(base).startsWith('cliente-cleanup-test-'));
    fs.rmSync(base, { recursive: true, force: true });
  };
  return { base, root, current, old, uploads, keepArchive, oldArchives, run, preserved, dispose };
}

for (const health of ['http-error', '{invalid-json', '{"runtime":"node","mode":"review","status":"running"}']) {
  test(`failed production health preserves all releases: ${health}`, { skip: process.platform !== 'linux' }, () => {
    const f = fixture(); try {
      assert.notEqual(f.run({ health, archive:f.keepArchive }).status, 0);
      assert.ok(f.old.every(dir => fs.existsSync(dir))); assert.ok(f.oldArchives.every(file => fs.existsSync(file))); f.preserved();
    } finally { f.dispose(); }
  });
}
test('running older process prevents cleanup after current symlink changes', { skip: process.platform !== 'linux' }, () => {
  const f = fixture(); try {
    assert.notEqual(f.run({ cwd: f.old[0] }).status, 0);
    assert.ok(f.old.every(dir => fs.existsSync(dir))); f.preserved();
  } finally { f.dispose(); }
});
test('successful cleanup retains deployed upload and removes only old application packages', { skip: process.platform !== 'linux' }, () => {
  const f = fixture(); try {
    const result = f.run({ archive:f.keepArchive }); assert.equal(result.status, 0, result.output);
    assert.ok(f.old.every(dir => !fs.existsSync(dir)));
    assert.ok(f.oldArchives.every(file => !fs.existsSync(file))); f.preserved();
  } finally { f.dispose(); }
});
test('a mismatched upload archive prevents deleting any release or package', { skip: process.platform !== 'linux' }, () => {
  const f = fixture(); try {
    fs.writeFileSync(path.join(f.current, 'wwwroot/index.html'), 'different deployed frontend');
    assert.notEqual(f.run({ archive:f.keepArchive }).status, 0);
    assert.ok(f.old.every(dir => fs.existsSync(dir))); assert.ok(f.oldArchives.every(file => fs.existsSync(file))); f.preserved();
  } finally { f.dispose(); }
});
test('a symlink in the upload archive path prevents all deletion', { skip: process.platform !== 'linux' }, () => {
  const f = fixture(); try {
    const alias = path.join(f.uploads, 'cliente-scroll-20261008.tar.gz'); fs.symlinkSync(f.keepArchive, alias);
    assert.notEqual(f.run({ archive:alias }).status, 0);
    assert.ok(f.old.every(dir => fs.existsSync(dir))); assert.ok(f.oldArchives.every(file => fs.existsSync(file))); f.preserved();
  } finally { f.dispose(); }
});
test('unexpected current release prevents cleanup', { skip: process.platform !== 'linux' }, () => {
  const f = fixture(); try {
    assert.notEqual(f.run({ expected: f.old[0] }).status, 0);
    assert.ok(f.old.every(dir => fs.existsSync(dir))); f.preserved();
  } finally { f.dispose(); }
});
test('successful cleanup removes old releases and preserves current, config and external symlink targets', { skip: process.platform !== 'linux' }, () => {
  const f = fixture(); try {
    const result = f.run(); assert.equal(result.status, 0, result.output);
    assert.ok(f.old.every(dir => !fs.existsSync(dir))); f.preserved();
    assert.ok(fs.lstatSync(path.join(f.root, 'external-release')).isSymbolicLink());
  } finally { f.dispose(); }
});
