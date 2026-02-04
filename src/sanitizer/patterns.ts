export const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above|system)\s+(instructions?|prompts?)/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+(now|a)\s+(jailbreak|dan|assistant)/i,
  /new\s+instructions?:/i,
  /system\s+message:/i,
  /\[SYSTEM\]/i,
  /\{OVERRIDE\}/i,
  /<\|im_start\|>/i,
  /<\|system\|>/i,
];

export const BASE64_PATTERN = /[A-Za-z0-9+/]{100,}={0,2}/;
export const HEX_PATTERN = /(?:0x)?[0-9a-fA-F]{100,}/;

export function detectSuspiciousPatterns(text: string): string[] {
  const detected: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      detected.push(`Injection pattern: ${pattern.source}`);
    }
  }

  if (BASE64_PATTERN.test(text)) {
    detected.push('Suspicious base64 encoding detected');
  }

  if (HEX_PATTERN.test(text)) {
    detected.push('Suspicious hex encoding detected');
  }

  return detected;
}
