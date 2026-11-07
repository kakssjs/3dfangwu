// Sends one real email through the configured sender, so delivery can be checked before
// STUDIO_EMAIL_ENABLED=true. Uses the same settings and the same sending function as the site.
// Usage: npm run email:test -- you@example.com
import { existsSync } from 'node:fs';
import { envFile, loadConfig, type StudioConfig } from '../src/api/config.ts';
import { smtpSender } from '../src/api/auth/email.ts';

const to = process.argv[2]?.trim() ?? '';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Usage: npm run email:test -- you@example.com');
  process.exit(1);
}
if (existsSync(envFile)) process.loadEnvFile(envFile);

let config: StudioConfig;
try {
  // Validate as if email were switched on, so a missing setting is named now instead of at startup.
  config = loadConfig({ ...process.env, STUDIO_EMAIL_ENABLED: 'true' });
} catch (error) {
  console.error(`Email settings are incomplete: ${(error as Error).message}`);
  process.exit(1);
}

try {
  await smtpSender(config.email)(to, '000000', 'login');
  console.log(`Accepted by ${config.email.host} for ${to}. The message is a sample login code (000000).`);
  console.log('Check that inbox, including the spam folder, before setting STUDIO_EMAIL_ENABLED=true.');
} catch (error) {
  console.error(`Sending failed: ${(error as Error).message}`);
  process.exitCode = 1;
}
