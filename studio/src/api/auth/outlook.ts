import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { XOAuth2ProvisionCallback } from 'nodemailer/lib/xoauth2';
import type { StudioConfig } from '../config.ts';

export const OUTLOOK_AUTHORITY = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
export const OUTLOOK_SCOPE = 'https://outlook.office.com/SMTP.Send offline_access';

export function readOutlookToken(file: string): string {
  try {
    const token: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof token === 'object' && token !== null && 'refreshToken' in token
      && typeof token.refreshToken === 'string' && token.refreshToken.trim()) return token.refreshToken;
  } catch { /* A parser or filesystem error must not disclose credentials. */ }
  throw new Error('Outlook SMTP authorization token is missing or invalid.');
}

/** Replace only this token, never the env file containing the site's other secrets. */
export function saveOutlookToken(file: string, refreshToken: string): void {
  if (!refreshToken.trim()) throw new Error('Outlook SMTP refresh token is missing.');
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify({ refreshToken }) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(temporary, file);
  } finally { rmSync(temporary, { force: true }); }
}

/** Nodemailer owns access-token caching and refresh serialization; we preserve Microsoft's rotated refresh token. */
export function outlookTokenProvider(config: Pick<StudioConfig['email'], 'oauthClientId' | 'oauthTokenFile'>): XOAuth2ProvisionCallback {
  return (_user, _renew, callback) => {
    void (async () => {
      try {
        const response = await fetch(`${OUTLOOK_AUTHORITY}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: config.oauthClientId!,
            refresh_token: readOutlookToken(config.oauthTokenFile!),
            grant_type: 'refresh_token',
            scope: OUTLOOK_SCOPE,
          }),
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error('Token refresh failed');
        const token: unknown = await response.json();
        if (typeof token !== 'object' || token === null
          || !('access_token' in token) || typeof token.access_token !== 'string' || !token.access_token
          || !('refresh_token' in token) || typeof token.refresh_token !== 'string' || !token.refresh_token.trim()
          || !('expires_in' in token) || typeof token.expires_in !== 'number' || !Number.isSafeInteger(token.expires_in) || token.expires_in <= 0) {
          throw new Error('Invalid token response');
        }
        saveOutlookToken(config.oauthTokenFile!, token.refresh_token);
        callback(null, token.access_token, Date.now() + Math.max(0, token.expires_in - 60) * 1000);
      } catch {
        callback(new Error('Outlook SMTP authorization failed; reconnect the sending mailbox.'));
      }
    })();
  };
}
