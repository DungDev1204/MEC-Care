import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { parse } from 'dotenv';

export function readConfig(envFile = process.env.CLIENTE_ENV_FILE || '.env', overrides: Record<string, string | undefined> = process.env) {
  const file = fs.existsSync(envFile) ? parse(fs.readFileSync(envFile)) : {};
  const get = (key: string, fallback = '') => overrides[key] ?? file[key] ?? fallback;
  const boolean = (key: string, fallback: boolean) => {
    const value = get(key, String(fallback)).toLowerCase();
    if (!['true', 'false'].includes(value)) throw new Error(`${key} must be true or false.`);
    return value === 'true';
  };
  const integer = (key: string, fallback: number) => {
    const text = get(key, String(fallback)); const value = Number(text);
    if (!/^\d+$/.test(text) || !Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${key} must be between 1 and 65535.`);
    return value;
  };
  const environment = get('APP_ENV', 'Production');
  if (!['Production', 'Development', 'Testing'].includes(environment)) throw new Error('APP_ENV must be Production, Development or Testing.');
  const review = boolean('REVIEW_ENABLED', false);
  if (review && environment !== 'Development') throw new Error('Review is available only in Development.');
  const bindAddress = get('BIND_ADDRESS', '127.0.0.1');
  if (!net.isIP(bindAddress)) throw new Error('BIND_ADDRESS must be an IP address.');
  const appOrigin = (key: string) => {
    const value = get(key).trim(); if (!value) return '';
    const url = new URL(value);
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['http:', 'https:'].includes(url.protocol) || environment === 'Production' && url.protocol !== 'https:') throw new Error(`${key} must be an HTTPS origin without a path.`);
    return url.origin;
  };
  const apps = { adminUrl: appOrigin('ADMIN_APP_URL'), userUrl: appOrigin('USER_APP_URL') };
  if (!!apps.adminUrl !== !!apps.userUrl || apps.adminUrl && new URL(apps.adminUrl).hostname === new URL(apps.userUrl).hostname) throw new Error('Set ADMIN_APP_URL and USER_APP_URL with separate hostnames.');
  const db = { server: get('DB_SERVER'), port: integer('DB_PORT', 1433), database: get('DB_NAME'), user: get('DB_USER'), password: get('DB_PASSWORD'),
    options: { encrypt: boolean('DB_ENCRYPT', true), trustServerCertificate: boolean('DB_TRUST_SERVER_CERTIFICATE', false), useUTC: true, ...(get('DB_CERTIFICATE_HOST') ? { serverName: get('DB_CERTIFICATE_HOST') } : {}) },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }, connectionTimeout: 15000, requestTimeout: 30000 };
  if (!review && (!db.server || !db.database || !db.user || !db.password)) throw new Error('Set DB_SERVER, DB_NAME, DB_USER and DB_PASSWORD in .env.');
  return { envFile: path.resolve(envFile), environment, review, db, port: integer('PORT', 5180), bindAddress,
    apps, allowedHosts: [...get('ALLOWED_HOSTS', 'localhost;127.0.0.1').split(';').filter(Boolean), ...Object.values(apps).filter(Boolean).map(url => new URL(url).hostname)], trustLocalProxy: boolean('TRUST_LOCAL_PROXY', false),
    storage: path.resolve(review ? 'review-data/photos' : get('STORAGE_PATH', 'storage')),
    reviewDatabase: path.resolve('review-data/review.db'), webRoot: path.resolve('wwwroot'),
    smtp: { host: get('SMTP_HOST', 'smtp.gmail.com'), port: integer('SMTP_PORT', 465), secure: boolean('SMTP_SECURE', true), user: get('SMTP_USER'), pass: get('SMTP_PASS').replace(/\s/g, ''), from: get('SMTP_FROM', get('SMTP_USER')) },
    push: { enabled: !review && boolean('PUSH_ENABLED', false), subject: get('PUSH_SUBJECT'), publicKey: get('PUSH_PUBLIC_KEY'), privateKey: get('PUSH_PRIVATE_KEY') } };
}
export type Config = ReturnType<typeof readConfig>;
export function updateEnv(file: string, values: Record<string, string>) {
  let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n]/.test(value)) throw new Error('Invalid .env assignment.');
    lines = lines.filter(line => !new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line));
    const quoted = value.includes("'") ? JSON.stringify(value) : `'${value}'`;
    lines.push(`${key}=${quoted}`);
  }
  fs.writeFileSync(file, lines.filter((line, index) => line || index < lines.length - 1).join('\n') + '\n', { mode: 0o640 });
}
