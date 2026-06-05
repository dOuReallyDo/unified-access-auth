'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

type Step = 'email' | 'otp' | 'pending' | 'passkey-offer' | 'done';


function HomeContent() {

  const [appSlug, setAppSlug] = useState('');
  const [returnTo, setReturnTo] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appName, setAppName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [passkeysSupported, setPasskeysSupported] = useState(false);
  const [approvalId, setApprovalId] = useState('');
  const [pollTimer, setPollTimer] = useState(0);

  const searchParams = useSearchParams();
  
  useEffect(() => {
    const ap = searchParams?.get('app') || new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('app') || '';
    const rt = searchParams?.get('returnTo') || new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('returnTo') || '';
    console.log('[DEBUG] AppSlug:', ap, 'ReturnTo:', rt);
    setAppSlug(ap);
    setReturnTo(rt);
    setPasskeysSupported(!!window.PublicKeyCredential);
  }, [searchParams]);

  // Poll for approval status when pending
  useEffect(() => {
    if (step !== 'pending' || !approvalId || !email) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/request-status?approvalId=${approvalId}&email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.status === 'approved') {
          setStep('otp');
          setError('');
          setApprovalId('');
          clearInterval(interval);
        } else if (data.status === 'rejected') {
          setStep('email');
          setError('Richiesta di accesso negata dall\'amministratore.');
          setApprovalId('');
          clearInterval(interval);
        } else {
          setPollTimer(t => t + 1);
        }
      } catch {
        // Network error — keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, approvalId, email]);

  const resolveDestination = useCallback((appRedirect?: string | null, token?: string) => {
    const registered = appRedirect || redirectUrl;
    let registeredOrigin: string | null = null;
    let registeredUrl: URL | null = null;
    try { if (registered) { registeredUrl = new URL(registered); registeredOrigin = registeredUrl.origin; } } catch { registeredOrigin = null; }
    // Extract ua_token from the registered redirect URL (set by verify-code)
    const uaToken = token || (registeredUrl?.searchParams.get('ua_token') || '');
    // returnTo is honored only as an override within the app's registered origin (no open redirect)
    if (returnTo && registeredOrigin) {
      try {
        if (new URL(returnTo).origin === registeredOrigin) {
          // Use the project root with ua_token (CF Pages middleware/ua-auth.js handles it)
          if (uaToken) {
            const destUrl = new URL(returnTo);
            destUrl.searchParams.set('ua_token', uaToken);
            return destUrl.toString();
          }
          return returnTo;
        }
      } catch { /* invalid returnTo */ }
    }
    return registered || '';
  }, [returnTo, redirectUrl]);

  const goToDestination = useCallback((appRedirect?: string | null, token?: string) => {
    const dest = resolveDestination(appRedirect, token);
    setRedirecting(!!dest);
    setStep('done');
    if (dest) window.location.href = dest;
  }, [resolveDestination]);

  const skipPasskey = useCallback(() => {
    goToDestination();
  }, [goToDestination]);

  const finishLogin = useCallback((data: { token?: string; app?: { redirect_url?: string | null }; session?: { app?: { redirect_url?: string | null } } }) => {
    goToDestination(data?.app?.redirect_url ?? data?.session?.app?.redirect_url, data?.token);
  }, [goToDestination]);

  const requestCode = useCallback(async () => {
    if (!email || !appSlug) { setError('Email e app sono obbligatorie'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, appSlug }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Errore'); return; }

      if (data.status === 'pending_approval') {
        setApprovalId(data.approvalId);
        setAppName(appSlug);
        setStep('pending');
        return;
      }

      setAppName(appSlug);
      setStep('otp');
    } finally { setLoading(false); }
  }, [email, appSlug]);

  const verifyCode = useCallback(async () => {
    if (!code) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, appSlug, code, deviceName: deviceName || navigator.userAgent.split(' ').slice(-1)[0] || 'Device' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Codice non valido'); return; }
      setUserEmail(data.user?.email || email);
      setRedirectUrl(data.app?.redirect_url || '');
      if (passkeysSupported) { setStep('passkey-offer'); }
      else { finishLogin(data); }
    } finally { setLoading(false); }
  }, [code, email, appSlug, deviceName, passkeysSupported, finishLogin]);

  const registerPasskey = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const optRes = await fetch('/api/passkeys/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const options = await optRes.json();
      if (!optRes.ok) { setError(options.error || 'Errore passkey'); skipPasskey(); return; }
      const credential = await startRegistration({ optionsJSON: options });
      const verRes = await fetch('/api/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credential, deviceName: deviceName || 'Passkey' }),
      });
      const verData = await verRes.json();
      if (!verRes.ok) { setError(verData.error || 'Errore verifica passkey'); }
      finishLogin(verData);
    } catch (e: unknown) {
      skipPasskey();
    } finally { setLoading(false); }
  }, [email, deviceName, skipPasskey, finishLogin]);

  const authenticateWithPasskey = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const optRes = await fetch('/api/passkeys/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || undefined }),
      });
      const options = await optRes.json();
      if (!optRes.ok) { setError(options.error || 'Errore passkey'); return; }
      const credential = await startAuthentication({ optionsJSON: options });
      const verRes = await fetch('/api/passkeys/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credential, appSlug, trustDays: 30 }),
      });
      const verData = await verRes.json();
      if (!verRes.ok) { setError(verData.error || 'Autenticazione fallita'); return; }
      finishLogin(verData);
    } catch {
      setError('Passkey non disponibile o annullata');
    } finally { setLoading(false); }
  }, [email, appSlug]);

  return (
    <main>
      <div className="login-container">
        <div className="login-card">
          <h1>🔐 Unified Access</h1>
          {appName && <p className="muted">Accesso a: <strong>{appName}</strong></p>}
          {!appName && <p className="muted">Common authentication gateway</p>}

          {error && <div className="login-error">{error}</div>}

          {/* STEP 1: Email */}
          {step === 'email' && (
            <div className="login-form">
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@esempio.com"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && requestCode()}
                />
              </label>
              <button onClick={requestCode} disabled={loading || !email}>
                {loading ? 'Invio...' : 'Richiedi codice'}
              </button>
              {passkeysSupported && (
                <button className="btn-secondary" onClick={authenticateWithPasskey} disabled={loading}>
                  Usa passkey
                </button>
              )}
              {!appSlug && (
                <label style={{ marginTop: 12 }}>
                  App slug
                  <input value={appSlug} onChange={(e) => setAppSlug(e.target.value)} placeholder="dealer-support" />
                </label>
              )}
            </div>
          )}

          {/* STEP 2: Pending approval */}
          {step === 'pending' && (
            <div className="login-form">
              <div className="pending-icon">⏳</div>
              <h2>In attesa di approvazione</h2>
              <p>La tua richiesta di accesso a <strong>{appName}</strong> è stata inviata.</p>
              <p className="muted">Un amministratore deve approvare il tuo accesso.</p>
              <p className="muted">Questa pagina si aggiornerà automaticamente...</p>
              <p className="poll-timer">{pollTimer > 0 ? `Controllo in corso... (${pollTimer})` : ''}</p>
              <button className="btn-link" onClick={() => { setStep('email'); setApprovalId(''); setError(''); }}>
                ← Indietro
              </button>
            </div>
          )}

          {/* STEP 3: OTP */}
          {step === 'otp' && (
            <div className="login-form">
              <p>Codice inviato a <strong>{email}</strong></p>
              <label>
                Codice di accesso
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC234"
                  maxLength={6}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
                  style={{ letterSpacing: 6, fontSize: 24, textAlign: 'center' }}
                />
              </label>
              <label>
                Nome dispositivo (opzionale)
                <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="iPhone, Chrome, ecc." />
              </label>
              <button onClick={verifyCode} disabled={loading || code.length < 6}>
                {loading ? 'Verifica...' : 'Verifica'}
              </button>
              <button className="btn-link" onClick={() => { setStep('email'); setCode(''); setError(''); }}>
                ← Indietro
              </button>
            </div>
          )}

          {/* STEP 4: Passkey offer */}
          {step === 'passkey-offer' && (
            <div className="login-form">
              <p>✅ Accesso riuscito come <strong>{userEmail}</strong></p>
              <p className="muted">Vuoi registrare una passkey per accessi futuri più veloci?</p>
              <button onClick={registerPasskey} disabled={loading}>
                {loading ? 'Registrazione...' : 'Registra passkey'}
              </button>
              <button className="btn-secondary" onClick={skipPasskey}>
                Salta per ora
              </button>
            </div>
          )}

          {/* STEP 5: Done */}
          {step === 'done' && (
            <div className="login-form">
              <p>✅ Accesso riuscito come <strong>{userEmail}</strong></p>
              {redirecting ? (
                <p className="muted">Reindirizzamento in corso...</p>
              ) : (
                <a href="/admin">Vai alla dashboard admin</a>
              )}
            </div>
          )}
        </div>

        <p className="login-footer"><a href="/admin">Admin</a></p>
      </div>
    </main>
  );

}

export default function Home() {
  return (
    <Suspense fallback={<main><div className="login-container"><p>Caricamento...</p></div></main>}>
      <HomeContent />
    </Suspense>
  );
}
