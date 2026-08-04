import { Resend } from "resend";
import type { ReactElement } from "react";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        "[Event Atlas] Missing required environment variable: RESEND_API_KEY"
      );
    }
    _resend = new Resend(key);
  }
  return _resend;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
}

export async function sendEmail({ to, subject, react }: SendEmailOptions): Promise<void> {
  const resend = getResend();

  const { error } = await resend.emails.send({
    from: "Event Atlas <onboarding@resend.dev>",
    to,
    subject,
    react,
  });

  if (error) {
    throw new Error(`[Event Atlas] Failed to send email: ${error.message}`);
  }
}
