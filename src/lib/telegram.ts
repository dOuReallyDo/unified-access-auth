/**
 * Send a notification via Telegram Bot API.
 * Used to notify admin of pending OTP approval requests.
 */
import { requiredEnv } from './env';

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: {
    inline_keyboard: Array<Array<{
      text: string;
      url: string;
    }>>;
  };
}

export async function sendTelegramNotification(message: TelegramMessage): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN not configured, skipping Telegram notification');
    return false;
  }

  console.log('[telegram] Sending notification to chat_id:', message.chat_id, 'bot token length:', botToken.length);

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      }
    );
    const data = await res.json();
    if (!data.ok) {
      console.error('[telegram] API error:', JSON.stringify(data));
      return false;
    }
    console.log('[telegram] Message sent successfully, msg_id:', data.result?.message_id);
    return true;
  } catch (err) {
    console.error('[telegram] Notification failed:', err);
    return false;
  }
}

export function formatApprovalMessage(params: {
  approvalId: string;
  userEmail: string;
  appName: string;
  appSlug: string;
  requestIp: string | null;
  userAgent: string | null;
  baseUrl: string;
}): TelegramMessage {
  const { approvalId, userEmail, appName, appSlug, requestIp, userAgent, baseUrl } = params;
  
  const approveUrl = `${baseUrl}/api/admin/approve/${approvalId}`;
  const rejectUrl = `${baseUrl}/api/admin/reject/${approvalId}`;
  
  const text = [
    `🔐 <b>Richiesta di accesso</b>`,
    ``,
    `👤 <b>Utente:</b> ${userEmail}`,
    `📱 <b>App:</b> ${appName} (${appSlug})`,
    requestIp ? `🌐 <b>IP:</b> ${requestIp}` : '',
    userAgent ? `💻 <b>Device:</b> ${userAgent.substring(0, 80)}` : '',
    `⏰ <b>Ora:</b> ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`,
    ``,
    `Seleziona un'azione:`,
  ].filter(Boolean).join('\n');

  return {
    chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID || '395229436',
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approva', url: approveUrl },
          { text: '❌ Rifiuta', url: rejectUrl },
        ],
      ],
    },
  };
}