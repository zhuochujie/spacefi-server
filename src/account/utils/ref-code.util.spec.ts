import { generateRefCode } from './ref-code.util';

describe('generateRefCode', () => {
  it('generates an 8 character ref code by default', () => {
    const refCode = generateRefCode();

    expect(refCode).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('supports a custom code length', () => {
    const refCode = generateRefCode(12);

    expect(refCode).toMatch(/^[A-Z0-9]{12}$/);
  });
});
