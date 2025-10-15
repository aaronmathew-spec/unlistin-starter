// lib/email/types.ts
export type EmailAddress = string;

export type SendEmailInput = {
  to: EmailAddress | EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  cc?: EmailAddress | EmailAddress[];
  bcc?: EmailAddress | EmailAddress[];
  headers?: Record<string, string>;
  tags?: Record<string, string | number | boolean>;
};

export type SendEmailResult = {
  ok: true;
  id: string;
} | {
  ok: false;
  error: string;
  code?: string | number;
};
