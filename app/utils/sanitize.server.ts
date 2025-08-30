// Server-side input sanitization utilities

export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, 255); // Limit length and trim whitespace
}

export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().toLowerCase();
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : '';
}

export function sanitizeNumber(input: unknown): number {
  if (typeof input === 'number') return input;
  if (typeof input === 'string') {
    const parsed = parseFloat(input);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function sanitizeBoolean(input: unknown): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    return input.toLowerCase() === 'true' || input === '1';
  }
  return false;
}