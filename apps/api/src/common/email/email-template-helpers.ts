export interface TemplateContent {
  details: string;
  action?: { label: string; url: string };
  showActionUrl?: boolean;
}

const MAX_VALUE_LENGTH = 4000;

export function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_VALUE_LENGTH) {
    throw new Error(`Invalid email template field: ${field}`);
  }
  return value.trim();
}

export function safeLink(value: unknown, field: string): string {
  const raw = requiredText(value, field);
  const url = new URL(raw);
  if (url.protocol !== 'https:' &&
    !(url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))) {
    throw new Error(`Email template requires a safe HTTPS link: ${field}`);
  }
  return url.toString();
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
