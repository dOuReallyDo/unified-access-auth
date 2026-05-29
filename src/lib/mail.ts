import { Resend } from 'resend';
import { requiredEnv } from './env';

export async function sendOtpEmail(to: string, code: string, appName: string) {
  const resend = new Resend(requiredEnv('RESEND_API_KEY'));
  await resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM ?? 'Access <no-reply@example.com>',
    to,
    subject: `Your access code for ${appName}`,
    text: `Your ${appName} access code is ${code}. It is 6 characters (letters and digits) and expires in 10 minutes.`,
    html: `<p>Your <strong>${appName}</strong> access code is:</p><p style="font-size:28px;letter-spacing:4px"><strong>${code}</strong></p><p>It expires in 10 minutes.</p>`
  });
}
