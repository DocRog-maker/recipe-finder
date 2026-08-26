import { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');

  function submit(e) {
    e.preventDefault();
    const id = email.trim();
    if (id) onLogin(id);
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="logo login-logo">🍳 Recipe Finder</div>
        <h1 className="login-title">Sign in</h1>
        <p className="hint">
          Naive proof-of-concept sign-in — no password. Your annotations are saved
          against whichever address you enter and are only shown when you sign back
          in with the same one.
        </p>
        <label className="login-label">
          Email
          <input
            className="login-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={!email.trim()}>
          Sign in
        </button>
      </form>
    </div>
  );
}
