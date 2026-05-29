import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING';
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonLen = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length;
  const svcLen = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length;
  
  // Try to connect
  let dbStatus = 'unknown';
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { count, error } = await supabase.from('apps').select('*', { count: 'exact', head: true });
    if (error) dbStatus = `error: ${error.message}`;
    else dbStatus = `ok (${count} apps)`;
  } catch (e: any) {
    dbStatus = `exception: ${e.message}`;
  }

  const hasTgToken = !!process.env.TELEGRAM_BOT_TOKEN;
  const tgTokenLen = (process.env.TELEGRAM_BOT_TOKEN || '').length;
  const tgTokenPrefix = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.substring(0, 10) : 'MISSING';
  const hasTgChat = !!process.env.TELEGRAM_ADMIN_CHAT_ID;
  const hasResend = !!process.env.RESEND_API_KEY;
  const resendLen = (process.env.RESEND_API_KEY || '').length;

  // Test Telegram API connectivity
  let tgTest = 'not_tested';
  let tgSendTest = 'not_tested';
  if (hasTgToken) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
      const tgData = await tgRes.json();
      tgTest = tgData.ok ? `ok: @${tgData.result.username}` : `error: ${tgData.description}`;
    } catch (e: any) {
      tgTest = `exception: ${e.message}`;
    }
    // Try sending a test message
    try {
      const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '395229436';
      const sendRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: '🧪 Test messaggio da debug endpoint' }),
      });
      const sendData = await sendRes.json();
      tgSendTest = sendData.ok ? `ok: msg_id=${sendData.result.message_id}` : `error: ${sendData.description} (code=${sendData.error_code})`;
    } catch (e: any) {
      tgSendTest = `exception: ${e.message}`;
    }
  }

  return NextResponse.json({
    supabaseUrl: url,
    hasAnonKey: hasAnon,
    hasServiceKey: hasService,
    anonKeyLength: anonLen,
    serviceKeyLength: svcLen,
    dbStatus,
    hasTelegramToken: hasTgToken,
    telegramTokenLength: tgTokenLen,
    telegramTokenPrefix: tgTokenPrefix,
    telegramChatId: hasTgChat,
    telegramBotTest: tgTest,
    telegramSendTest: tgSendTest,
    hasResendKey: hasResend,
    resendKeyLength: resendLen,
  });
}