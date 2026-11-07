import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import nodemailer from 'nodemailer';
import { smtpSender } from '../src/api/auth/email.ts';

test('SMTP requires encrypted delivery, sends the code as text, and checks acceptance of the intended recipient', async () => {
  let options: Record<string, unknown> = {};
  let mail: Record<string, unknown> = {};
  let accepted: unknown[] = ['person@example.com'];
  let rejected: unknown[] = [];
  const createTransport = mock.method(nodemailer, 'createTransport', ((config: Record<string, unknown>) => {
    options = config;
    return { sendMail: async (message: Record<string, unknown>) => { mail = message; return { accepted, rejected }; } };
  }) as unknown as typeof nodemailer.createTransport);
  try {
    const config = { enabled: true, host: 'smtp.example.com', port: 587, secure: false, user: 'sender', password: 'private', from: 'sender@example.com' };
    const send = smtpSender(config);
    assert.equal(options.requireTLS, true);
    assert.equal(options.logger, false);
    assert.equal(options.debug, false);
    await send('person@example.com', '123456', 'register');
    assert.equal(mail.to, 'person@example.com');
    assert.match(String(mail.text), /123456/);
    assert.equal(mail.disableFileAccess, true);
    assert.equal(mail.disableUrlAccess, true);
    for (const recipients of [[], ['other@example.com']]) {
      accepted = recipients;
      await assert.rejects(send('person@example.com', '123456', 'login'), /not accepted/);
    }
    accepted = ['person@example.com'];
    rejected = ['person@example.com'];
    await assert.rejects(send('person@example.com', '123456', 'login'), /not accepted/);
    smtpSender({ ...config, secure: true, port: 465 });
    assert.equal(options.secure, true);
    smtpSender({ ...config, authType: 'outlook', oauthClientId: 'client-id', oauthTokenFile: 'not-read-until-send.json' });
    const auth = options.auth as Record<string, unknown>;
    assert.equal(auth.type, 'OAuth2');
    assert.equal(auth.user, config.user);
    assert.equal(auth.pass, undefined);
    assert.equal(typeof auth.provisionCallback, 'function');
  } finally { createTransport.mock.restore(); }
});
