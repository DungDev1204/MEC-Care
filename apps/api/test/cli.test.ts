import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { parse } from 'dotenv';

test('CLI commands run through a release directory symlink', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cliente-cli-'));
  const alias = path.join(directory, 'current');
  const envFile = path.join(directory, '.env');
  const apiRoot = fileURLToPath(new URL('../', import.meta.url));
  const env = { ...process.env, CLIENTE_ENV_FILE: envFile, APP_ENV: 'Testing',
    REVIEW_ENABLED: 'false', PUSH_ENABLED: 'false', PUSH_PUBLIC_KEY: '', PUSH_PRIVATE_KEY: '',
    DB_SERVER: 'unused', DB_USER: 'unused', DB_PASSWORD: 'test-only', DB_NAME: 'unused' };
  try {
    await fs.symlink(apiRoot, alias, process.platform === 'win32' ? 'junction' : 'dir');
    const run = (command: string) => spawnSync(process.execPath,
      ['--import', import.meta.resolve('tsx'), path.join(alias, 'src/server.ts'), command], {
        cwd: directory, encoding: 'utf8', timeout: 15000,
        env
      });
    const invalid = run('--invalid-command');
    assert.equal(invalid.status, 1, invalid.stderr);
    assert.match(invalid.stderr, /Unknown command/);
    const keys = run('--create-push-keys');
    assert.equal(keys.status, 0, keys.stderr);
    assert.match(keys.stdout, /Web Push keys saved/);
    const saved = parse(await fs.readFile(envFile));
    assert.ok(saved.PUSH_PUBLIC_KEY);
    assert.ok(saved.PUSH_PRIVATE_KEY);
    assert.ok(!keys.stdout.includes(saved.PUSH_PRIVATE_KEY));

    const reservation = net.createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = (reservation.address() as net.AddressInfo).port;
    await new Promise<void>(resolve => reservation.close(() => resolve()));
    const child = spawn(process.execPath,
      ['--import', import.meta.resolve('tsx'), path.join(alias, 'src/server.ts')], {
        cwd: directory, env: { ...env, PORT: String(port), BIND_ADDRESS: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe']
      });
    let output = '', errors = '';
    child.stderr.on('data', chunk => { errors += chunk; });
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`HTTP startup timed out: ${errors}`)), 10000);
        child.stdout.on('data', chunk => {
          output += chunk;
          if (output.includes(`listening on 127.0.0.1:${port}`)) { clearTimeout(timeout); resolve(); }
        });
        child.once('error', error => { clearTimeout(timeout); reject(error); });
        child.once('exit', code => { clearTimeout(timeout); reject(new Error(`HTTP process exited with ${code}: ${errors}`)); });
      });
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'running', mode: 'sqlServer', runtime: 'node' });
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const closed = once(child, 'close');
        child.kill('SIGTERM');
        await closed;
      }
    }
  } finally {
    await fs.unlink(alias).catch(() => {});
    await fs.rm(directory, { recursive: true, force: true });
  }
});
