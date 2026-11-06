import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Passwords are kept only as scrypt hashes (built into Node.js), each with its own random salt.
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/** Returns "scrypt$N$r$p$salt$hash", safe to store. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, KEY_LENGTH, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}
