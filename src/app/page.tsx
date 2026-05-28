export default function Home() {
  return (
    <main>
      <h1>Unified Access Auth</h1>
      <p className="muted">Common OTP, session and passkey authentication for multiple apps.</p>
      <div className="grid grid-3">
        <section className="card"><h2>Email OTP</h2><p>Request and verify codes via Resend-backed API routes.</p></section>
        <section className="card"><h2>Sessions</h2><p>Validate and revoke sessions stored as hashed trusted-device tokens.</p></section>
        <section className="card"><h2>Passkeys</h2><p>WebAuthn registration and login routes powered by @simplewebauthn.</p></section>
      </div>
      <p><a href="/admin">Open admin dashboard</a></p>
    </main>
  );
}
