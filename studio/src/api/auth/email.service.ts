import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, eq, gt, lt, lte, or, sql } from 'drizzle-orm';
import type { StudioConfig } from '../config.ts';
import type { Db } from '../db/database.ts';
import { emailChallenges, emailQuotas } from '../db/schema.ts';
import { CONFIG, DB } from '../tokens.ts';
import { EMAIL_SEND, type EmailPurpose, type EmailSender } from './email.ts';

type VerificationDb = Pick<Db, 'select' | 'update' | 'delete'>;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

@Injectable()
export class EmailService {
  private readonly db: Db;
  private readonly config: StudioConfig;
  private readonly sendEmail: EmailSender;

  constructor(
    @Inject(DB) db: Db,
    @Inject(CONFIG) config: StudioConfig,
    @Inject(EMAIL_SEND) sendEmail: EmailSender,
  ) {
    this.db = db;
    this.config = config;
    this.sendEmail = sendEmail;
  }

  get enabled(): boolean { return this.config.email.enabled; }

  requireEnabled(): void {
    if (!this.enabled) throw new ServiceUnavailableException('Email verification is not configured');
  }

  private hash(value: string): string {
    return createHmac('sha256', this.config.jwtSecret).update(value).digest('hex');
  }

  private codeHash(email: string, code: string, purpose: EmailPurpose): string {
    return this.hash(`${purpose}\0${email}\0${code}`);
  }

  async send(email: string, purpose: EmailPurpose, ip: string): Promise<{ resendAfterSeconds: number }> {
    this.requireEnabled();
    const now = new Date();
    const key = `${purpose}:${email}`;
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = this.codeHash(email, code, purpose);
    const emailKey = this.hash(`email:${email}`);
    const quotas = [
      { key: 'site:day', period: DAY, limit: 100 },
      { key: `email:${emailKey}:minute`, period: MINUTE, limit: 1 },
      { key: `email:${emailKey}:day`, period: DAY, limit: 5 },
      { key: `ip:${this.hash(`ip:${ip}`)}:hour`, period: 60 * MINUTE, limit: 5 },
    ];
    await this.db.delete(emailChallenges).where(lte(emailChallenges.expiresAt, now));
    await this.db.delete(emailQuotas).where(lte(emailQuotas.expiresAt, now));
    await this.db.transaction(async (tx) => {
      // Reserve before contacting SMTP: concurrent sends and ambiguous timeouts still spend the budget.
      for (const quota of quotas) {
        const expiresAt = new Date(now.getTime() + quota.period);
        const [reserved] = await tx.insert(emailQuotas).values({ key: quota.key, count: 1, expiresAt })
          .onConflictDoUpdate({
            target: emailQuotas.key,
            set: {
              count: sql`case when ${emailQuotas.expiresAt} <= ${now.toISOString()}::timestamptz then 1 else ${emailQuotas.count} + 1 end`,
              expiresAt: sql`case when ${emailQuotas.expiresAt} <= ${now.toISOString()}::timestamptz then ${expiresAt.toISOString()}::timestamptz else ${emailQuotas.expiresAt} end`,
            },
            setWhere: or(lte(emailQuotas.expiresAt, now), lt(emailQuotas.count, quota.limit)),
          }).returning({ key: emailQuotas.key });
        if (!reserved) throw new HttpException('Too many verification emails. Try again later.', 429);
      }
      await tx.insert(emailChallenges).values({ key, codeHash, expiresAt: new Date(now.getTime() + 5 * MINUTE) })
        .onConflictDoUpdate({ target: emailChallenges.key, set: {
          codeHash, expiresAt: new Date(now.getTime() + 5 * MINUTE), attempts: 0, ready: false,
        } });
    });
    try {
      await this.sendEmail(email, code, purpose);
      await this.db.update(emailChallenges).set({ ready: true })
        .where(and(eq(emailChallenges.key, key), eq(emailChallenges.codeHash, codeHash)));
    } catch {
      await this.db.delete(emailChallenges).where(and(eq(emailChallenges.key, key), eq(emailChallenges.codeHash, codeHash)));
      throw new ServiceUnavailableException('Cannot send verification email. Try again later.');
    }
    return { resendAfterSeconds: 60 };
  }

  /** Called inside the account transaction. Return false so wrong attempts commit before the caller throws. */
  async consume(db: VerificationDb, email: string, code: string, purpose: EmailPurpose): Promise<boolean> {
    const key = `${purpose}:${email}`;
    const [challenge] = await db.select().from(emailChallenges).where(and(
      eq(emailChallenges.key, key), eq(emailChallenges.ready, true), gt(emailChallenges.expiresAt, new Date()),
    )).limit(1).for('update');
    if (!challenge || challenge.attempts >= 5) return false;
    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(this.codeHash(email, code, purpose), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await db.update(emailChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(emailChallenges.key, key));
      return false;
    }
    await db.delete(emailChallenges).where(eq(emailChallenges.key, key));
    return true;
  }
}
