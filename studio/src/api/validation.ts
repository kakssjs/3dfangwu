import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ValidateBy, buildMessage, type ValidationOptions } from 'class-validator';
import { ISO_DATE, findContactDetails, isRealDate, normalizePhone } from './domain.ts';

/** A real calendar date written YYYY-MM-DD, such as 2026-12-01. */
export const IsDateOnly = (options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isDateOnly',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && ISO_DATE.test(value) && isRealDate(value),
        defaultMessage: buildMessage((each) => `${each}$property must be a real date written YYYY-MM-DD`, options),
      },
    },
    options,
  );

/** Removes spaces around a text field before it is checked. */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Removes spaces around each text in a list before it is checked. */
export const TrimEach = () =>
  Transform(({ value }) => (Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value));

/** Turns "+86 138-0013-8000" into "13800138000" before it is checked. */
export const NormalizePhone = () => Transform(({ value }) => normalizePhone(value));

/** Turns a licence number to capitals, without spaces, before it is checked. */
export const NormalizeLicence = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '').toUpperCase() : value));

/** Refuses free text that carries a phone number or email address (D7). */
export function refuseContactDetails(fields: Record<string, string | undefined>): void {
  for (const [field, text] of Object.entries(fields)) {
    const found = text ? findContactDetails(text) : undefined;
    if (found) {
      throw new BadRequestException(
        `${field} contains ${found}. Contact details are shared only once the homeowner picks a quote (D7), so please remove it.`,
      );
    }
  }
}

/** Today's date in China, as YYYY-MM-DD. */
export function todayInChina(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(now);
}
