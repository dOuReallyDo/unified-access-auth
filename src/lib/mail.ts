import { Resend } from 'resend';

export async function sendOtpEmail(to: string, code: string, appName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  
  // Fallback: log OTP to console if Resend is not configured
  if (!apiKey || apiKey === 'PLACEHOLDER' || apiKey.startsWith('placeholder')) {
    console.log(`\n🔑 OTP CODE for ${to} (${appName}): ${code}\n`);
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM ?? 'Unified Access <onboarding@resend.dev>',
    to,
    subject: `Your access code for ${appName}`,
    text: `Your ${appName} access code is ${code}. It is 6 characters (letters and digits) and expires in 10 minutes.`,
    html: `<p>Your <strong>${appName}</strong> access code is:</p><p style="font-size:28px;letter-spacing:4px"><strong>${code}</strong></p><p>It expires in 10 minutes.</p>`
  });
}