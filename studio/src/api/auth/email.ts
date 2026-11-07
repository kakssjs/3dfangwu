import nodemailer from 'nodemailer';
import type { StudioConfig } from '../config.ts';
import { outlookTokenProvider } from './outlook.ts';

export type EmailPurpose = 'register' | 'login';
export type EmailSender = (email: string, code: string, purpose: EmailPurpose) => Promise<void>;
export const EMAIL_SEND = Symbol('EmailSender');

/** SMTP uses TLS on connect, or requires STARTTLS before sending credentials or mail. */
export function smtpSender(config: StudioConfig['email']): EmailSender {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: config.authType === 'outlook'
      ? { type: 'OAuth2', user: config.user, provisionCallback: outlookTokenProvider(config) }
      : { user: config.user, pass: config.password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 15_000,
    logger: false,
    debug: false,
  });
  return async (email, code, purpose) => {
    const result = await transport.sendMail({
      from: config.from,
      to: email,
      subject: purpose === 'register' ? '予舍 · 注册验证码' : '予舍 · 登录验证码',
      text: `您的${purpose === 'register' ? '注册' : '登录'}验证码为 ${code}，5 分钟内有效。如非本人操作，请忽略此邮件。\nYour verification code is ${code}. It expires in 5 minutes.`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const accepted = result.accepted.some((recipient) => recipient.toLowerCase() === email.toLowerCase());
    if (!accepted || result.rejected.length) throw new Error('The email was not accepted');
  };
}
