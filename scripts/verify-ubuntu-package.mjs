import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const archive = process.argv[2];
if (!archive || !fs.existsSync(archive)) throw new Error('Supply an existing Ubuntu application archive.');
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/);
const scripts = entries.filter(entry => entry.endsWith('.sh'));
if (!scripts.length) throw new Error('No Ubuntu shell scripts found in the archive.');
if (entries.some(entry => !entry.endsWith('/.env.example') && /(^|\/)(\.env(?:\..*)?|smtp-deploy.*\.json)$/.test(entry))) throw new Error('Private configuration found in the archive.');
const gitBash = path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git/bin/bash.exe');
const bash = process.env.CLIENTE_BASH_PATH || (process.platform === 'win32' ? fs.existsSync(gitBash) ? gitBash : null : 'bash');
for (const entry of scripts) {
  const bytes = execFileSync('tar', ['-xOf', archive, entry]);
  if (bytes.includes(13) || bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) throw new Error(`Ubuntu shell script must use LF without BOM: ${entry}`);
  if (bash) execFileSync(bash, ['--noprofile', '--norc', '-n'], { input: bytes, stdio: ['pipe', 'pipe', 'pipe'] });
}
console.log(`Ubuntu archive verified: ${scripts.length} shell scripts use LF without BOM${bash ? '; Bash syntax passed' : ''}; no private configuration files.`);
