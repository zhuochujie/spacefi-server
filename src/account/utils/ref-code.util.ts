import { randomInt } from 'crypto';

const REF_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DEFAULT_REF_CODE_LENGTH = 8;

export function generateRefCode(length = DEFAULT_REF_CODE_LENGTH): string {
  let refCode = '';

  for (let index = 0; index < length; index += 1) {
    refCode += REF_CODE_CHARS[randomInt(REF_CODE_CHARS.length)];
  }

  return refCode;
}
