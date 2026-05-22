import 'dotenv/config';

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

export function requiredIntEnv(name: string): number {
  const value = requiredEnv(name);
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer env: ${name}`);
  }

  return parsed;
}

export function optionalBoolEnv(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() === 'true';
}
