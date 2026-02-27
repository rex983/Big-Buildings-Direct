import { randomInt } from "crypto";

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 12, message: "At least 12 characters" },
  { test: (p: string) => /[A-Z]/.test(p), message: "At least one uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), message: "At least one lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), message: "At least one number" },
  {
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
    message: "At least one special character",
  },
];

export function validatePasswordComplexity(
  password: string
): PasswordValidationResult {
  const errors: string[] = [];

  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      errors.push(rule.message);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getPasswordRules() {
  return PASSWORD_RULES.map((r) => r.message);
}

export function checkPasswordRule(password: string, ruleIndex: number): boolean {
  return PASSWORD_RULES[ruleIndex]?.test(password) ?? false;
}

const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

export function generateTempPassword(length = 16): string {
  const chars: string[] = [];
  // Ensure at least one of each required type
  chars.push(String.fromCharCode(randomInt(65, 91))); // uppercase A-Z
  chars.push(String.fromCharCode(randomInt(97, 123))); // lowercase a-z
  chars.push(String.fromCharCode(randomInt(48, 58))); // digit 0-9
  const symbols = "!@#$%^&*";
  chars.push(symbols[randomInt(0, symbols.length)]);

  // Fill remaining
  for (let i = chars.length; i < length; i++) {
    chars.push(CHARSET[randomInt(0, CHARSET.length)]);
  }

  // Shuffle using Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
