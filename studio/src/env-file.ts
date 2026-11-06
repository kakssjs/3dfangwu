import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Sets KEY=value lines in an env file such as `.env.local`, keeping every other line as it was,
 * and in `process.env`. A new file starts with `header`.
 */
export function writeEnvFile(file: string, values: Record<string, string>, header: string): void {
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Za-z0-9_\-.:/@+=~]*$/.test(value)) throw new Error(`unexpected characters in the value for ${key}`);
  }
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/) : [header];
  const pending = new Map(Object.entries(values));
  const out = lines.map((line) => {
    const key = /^\s*([A-Za-z0-9_]+)\s*=/.exec(line)?.[1];
    if (key === undefined || !pending.has(key)) return line;
    const value = pending.get(key)!;
    pending.delete(key);
    return `${key}=${value}`;
  });
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  for (const [key, value] of pending) out.push(`${key}=${value}`);
  writeFileSync(file, out.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  Object.assign(process.env, values);
}
