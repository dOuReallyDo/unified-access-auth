'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/admin';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(from as any);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="login-container">
        <div className="login-card">
          <h1>🔐 Admin Login</h1>
          <p className="muted">Unified Access — Administration</p>
          <form onSubmit={handleLogin} className="login-form">
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
              />
            </label>
            <button type="submit" disabled={loading || !password}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            {error && <div className="login-error">{error}</div>}
          </form>
        </div>
      </div>
    </main>
  );
}