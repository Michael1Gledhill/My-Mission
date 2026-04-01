import { useEffect, useMemo, useState } from 'react';
import type { AppUser, AuditLogEntry, MissionContent } from '../types';
import { generateSalt, hashPassword, normalizeEmail } from '../lib/auth';
import {
  loadAuditLog,
  loadContent,
  loadSession,
  loadUsers,
  saveAuditLog,
  saveContent,
  saveSession,
  saveUsers
} from '../lib/storage';

const DEFAULT_CONTENT: MissionContent = {
  site: {
    title: 'Mission Portal',
    subtitle: 'Secure updates for approved family and friends',
    missionName: 'Idaho Idaho Falls Mission'
  },
  profile: {
    firstName: 'Michael',
    lastName: 'Gledhill',
    bio: 'This profile is fully editable from admin.',
    testimony: 'This testimony is fully editable from admin.'
  },
  updates: [
    {
      id: 'u-1',
      title: 'Welcome',
      date: '2026-04-01',
      body: 'New secure platform is live.',
      visibility: 'public'
    }
  ],
  map: {
    boundary: [],
    currentArea: 'Not set'
  },
  photos: [],
  settings: {
    adminEmails: ['admin@example.com'],
    requireApproval: true
  }
};

type ViewMode = 'home' | 'login' | 'register' | 'admin' | 'changePassword';
type ToastKind = 'success' | 'info';
interface AppToast {
  id: string;
  message: string;
  kind: ToastKind;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
const INACTIVITY_WARNING_MS = 60 * 1000;

function generateTemporaryPassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}

function evaluatePasswordStrength(password: string): {
  score: number;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  feedback: string;
} {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: 'Very weak', feedback: 'Use at least 10+ chars with upper/lower, number, and symbol.' };
  if (score === 2) return { score, label: 'Weak', feedback: 'Add more variety (upper/lower, number, symbol).' };
  if (score === 3) return { score, label: 'Fair', feedback: 'Acceptable, but stronger is better.' };
  if (score === 4) return { score, label: 'Strong', feedback: 'Good password strength.' };
  return { score, label: 'Very strong', feedback: 'Excellent password strength.' };
}

export function App() {
  const [content, setContent] = useState<MissionContent>(DEFAULT_CONTENT);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(loadAuditLog());
  const [sessionEmail, setSessionEmail] = useState<string | null>(loadSession());
  const [mode, setMode] = useState<ViewMode>('home');
  const [message, setMessage] = useState('');
  const [inactivitySecondsLeft, setInactivitySecondsLeft] = useState<number | null>(null);
  const [toasts, setToasts] = useState<AppToast[]>([]);

  useEffect(() => {
    const boot = async () => {
      const localContent = loadContent();
      if (localContent) {
        setContent(localContent);
      } else {
        try {
          const res = await fetch('./data/content.json');
          if (res.ok) {
            const json = (await res.json()) as MissionContent;
            setContent(json);
          }
        } catch {
          // fallback to default
        }
      }
      setUsers(loadUsers());
    };

    void boot();
  }, []);

  useEffect(() => {
    saveContent(content);
  }, [content]);

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  useEffect(() => {
    saveAuditLog(auditLog);
  }, [auditLog]);

  const currentUser = useMemo(() => {
    if (!sessionEmail) return null;
    return users.find((u) => normalizeEmail(u.email) === normalizeEmail(sessionEmail)) ?? null;
  }, [sessionEmail, users]);

  const isApproved = currentUser?.status === 'approved';
  const isAdmin = !!currentUser && content.settings.adminEmails.map(normalizeEmail).includes(normalizeEmail(currentUser.email));
  const canViewMissionInfo = !content.settings.requireApproval || isApproved || isAdmin;

  const appendAudit = (action: string, details: string) => {
    setAuditLog((prev) => [
      {
        id: `audit-${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        actor: currentUser?.email ?? 'system',
        action,
        details
      },
      ...prev
    ].slice(0, 200));
  };

  const pushToast = (toastMessage: string, kind: ToastKind = 'success', ttlMs = 3500) => {
    const id = `toast-${crypto.randomUUID()}`;
    setToasts((prev) => [...prev, { id, message: toastMessage, kind }].slice(-4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, ttlMs);
  };

  const clearAuditLog = () => {
    setAuditLog([]);
  };

  const register = async (input: { firstName: string; lastName: string; email: string; password: string }) => {
    const email = normalizeEmail(input.email);
    if (users.some((u) => normalizeEmail(u.email) === email)) {
      setMessage('An account with that email already exists.');
      return;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(input.password, salt);

    const user: AppUser = {
      id: crypto.randomUUID(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      passwordHash,
      salt,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      failedLoginAttempts: 0
    };

    setUsers((prev) => [...prev, user]);
    setMessage('Registration submitted. Wait for admin approval before access.');
    pushToast('Registration submitted for approval.');
    setMode('login');
  };

  const login = async (email: string, password: string) => {
    const normalized = normalizeEmail(email);
    const user = users.find((u) => normalizeEmail(u.email) === normalized);

    if (!user) {
      setMessage('No account found for that email.');
      return;
    }

    const now = Date.now();
    const lockoutUntilMs = user.lockoutUntil ? Date.parse(user.lockoutUntil) : 0;
    if (lockoutUntilMs > now) {
      const secondsRemaining = Math.max(1, Math.ceil((lockoutUntilMs - now) / 1000));
      const minutes = Math.floor(secondsRemaining / 60);
      const seconds = secondsRemaining % 60;
      setMessage(`Too many failed attempts. Try again in ${minutes}:${String(seconds).padStart(2, '0')}.`);
      appendAudit('login_blocked_lockout', `Blocked login for ${user.email}`);
      return;
    }

    const attemptedHash = await hashPassword(password, user.salt);
    if (attemptedHash !== user.passwordHash) {
      const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = nextAttempts >= MAX_LOGIN_ATTEMPTS;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                failedLoginAttempts: shouldLock ? 0 : nextAttempts,
                lockoutUntil: shouldLock ? new Date(now + LOCKOUT_DURATION_MS).toISOString() : undefined
              }
            : u
        )
      );

      if (shouldLock) {
        setMessage('Too many failed attempts. Account locked for 15 minutes.');
        appendAudit('login_lockout_applied', `Lockout applied to ${user.email}`);
      } else {
        setMessage(`Incorrect password. Attempt ${nextAttempts}/${MAX_LOGIN_ATTEMPTS}.`);
        appendAudit('login_failed', `Failed login for ${user.email}; attempt ${nextAttempts}`);
      }
      return;
    }

    if (user.status !== 'approved') {
      setMessage(`Your account is currently ${user.status}. Admin approval is required.`);
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? {
              ...u,
              failedLoginAttempts: 0,
              lockoutUntil: undefined
            }
          : u
      )
    );

    saveSession(user.email);
    setSessionEmail(user.email);
    setMessage('Signed in successfully.');
    pushToast('Signed in successfully.');
    appendAudit('login_success', `Successful login for ${user.email}`);
    setMode('home');
  };

  const changePassword = async (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!currentUser) {
      setMessage('You must be signed in to change your password.');
      setMode('login');
      return;
    }

    if (input.newPassword !== input.confirmPassword) {
      setMessage('New password and confirmation do not match.');
      return;
    }

    const strength = evaluatePasswordStrength(input.newPassword);
    if (input.newPassword.length < 10 || strength.score < 3) {
      setMessage('New password is too weak. Use a stronger password.');
      return;
    }

    const currentHash = await hashPassword(input.currentPassword, currentUser.salt);
    if (currentHash !== currentUser.passwordHash) {
      setMessage('Current password is incorrect.');
      appendAudit('password_change_failed', `Incorrect current password for ${currentUser.email}`);
      return;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(input.newPassword, salt);

    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              salt,
              passwordHash,
              failedLoginAttempts: 0,
              lockoutUntil: undefined
            }
          : u
      )
    );

    appendAudit('password_changed', `Password changed for ${currentUser.email}`);
    setMessage('Password changed successfully.');
    pushToast('Password changed successfully.');
    setMode('home');
  };

  const logout = (reason = 'Signed out.') => {
    saveSession(null);
    setSessionEmail(null);
    setInactivitySecondsLeft(null);
    setMessage(reason);
  };

  useEffect(() => {
    if (!sessionEmail) {
      setInactivitySecondsLeft(null);
      return;
    }

    const warningStartMs = Math.max(0, INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS);
    let warningTimer: number | null = null;
    let logoutTimer: number | null = null;
    let countdownInterval: number | null = null;

    const clearTimers = () => {
      if (warningTimer !== null) {
        window.clearTimeout(warningTimer);
        warningTimer = null;
      }
      if (logoutTimer !== null) {
        window.clearTimeout(logoutTimer);
        logoutTimer = null;
      }
      if (countdownInterval !== null) {
        window.clearInterval(countdownInterval);
        countdownInterval = null;
      }
    };

    const scheduleTimeouts = () => {
      clearTimers();
      setInactivitySecondsLeft(null);

      warningTimer = window.setTimeout(() => {
        setInactivitySecondsLeft(Math.ceil(INACTIVITY_WARNING_MS / 1000));
        countdownInterval = window.setInterval(() => {
          setInactivitySecondsLeft((prev) => (prev === null ? null : Math.max(0, prev - 1)));
        }, 1000);
      }, warningStartMs);

      logoutTimer = window.setTimeout(() => {
        clearTimers();
        setInactivitySecondsLeft(null);
        appendAudit('session_timeout', `Auto logout for ${sessionEmail}`);
        logout('Signed out due to inactivity.');
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    const onActivity = () => scheduleTimeouts();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleTimeouts();
      }
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
    scheduleTimeouts();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimers();
    };
  }, [sessionEmail]);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      const main = document.getElementById('main-content');
      if (main instanceof HTMLElement) {
        main.focus();
      }
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [mode]);

  const approveUser = (id: string, status: 'approved' | 'rejected' | 'suspended') => {
    const target = users.find((u) => u.id === id);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              status,
              decidedAt: new Date().toISOString()
            }
          : u
      )
    );
    appendAudit(`user_${status}`, `Updated ${target?.email ?? id} to ${status}`);
  };

  const resetUserPassword = async (id: string): Promise<string> => {
    const target = users.find((u) => u.id === id);
    const temporaryPassword = generateTemporaryPassword();
    const salt = generateSalt();
    const passwordHash = await hashPassword(temporaryPassword, salt);

    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              salt,
              passwordHash,
              failedLoginAttempts: 0,
              lockoutUntil: undefined
            }
          : u
      )
    );

    appendAudit('user_password_reset', `Reset password for ${target?.email ?? id}`);

    return temporaryPassword;
  };

  const clearUserLockout = (id: string) => {
    const target = users.find((u) => u.id === id);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              failedLoginAttempts: 0,
              lockoutUntil: undefined
            }
          : u
      )
    );
    appendAudit('login_lockout_cleared', `Cleared lockout for ${target?.email ?? id}`);
  };

  const protectedUpdates = content.updates.filter((u) => u.visibility === 'approved');
  const publicUpdates = content.updates.filter((u) => u.visibility === 'public');
  const publicPhotos = content.photos.filter((p) => p.visibility === 'public');
  const approvedPhotos = content.photos.filter((p) => p.visibility === 'approved');

  return (
    <div className="page">
      <a className="skipLink" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <div>
          <h1>{content.site.title}</h1>
          <p>{content.site.subtitle}</p>
        </div>
        <nav className="nav" aria-label="Primary">
          <button aria-current={mode === 'home' ? 'page' : undefined} onClick={() => setMode('home')}>Home</button>
          <button aria-current={mode === 'register' ? 'page' : undefined} onClick={() => setMode('register')}>Register</button>
          <button aria-current={mode === 'login' ? 'page' : undefined} onClick={() => setMode('login')}>Login</button>
          {currentUser && <button aria-current={mode === 'changePassword' ? 'page' : undefined} onClick={() => setMode('changePassword')}>Change Password</button>}
          {isAdmin && <button aria-current={mode === 'admin' ? 'page' : undefined} onClick={() => setMode('admin')}>Admin</button>}
          {currentUser && <button onClick={() => logout()}>Logout</button>}
        </nav>
      </header>

      {message && <p className="message">{message}</p>}
      {inactivitySecondsLeft !== null && sessionEmail && (
        <p className="message">
          Session expires in {inactivitySecondsLeft}s due to inactivity.
        </p>
      )}
      <div className="toastStack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
            {toast.message}
          </div>
        ))}
      </div>

      {mode === 'home' && (
        <main id="main-content" tabIndex={-1} className="grid">
          {!canViewMissionInfo && (
            <section className="card">
              <h2>Approval Required</h2>
              <p>
                Your account must be approved before you can view mission information.
              </p>
              <p>Please register/login, then wait for admin approval.</p>
            </section>
          )}

          {canViewMissionInfo && (
            <>
              <section className="card">
                <h2>Mission</h2>
                <p><strong>{content.site.missionName}</strong></p>
                <p>{content.profile.firstName} {content.profile.lastName}</p>
                <p>{content.profile.bio}</p>
              </section>

              <section className="card">
                <h2>Testimony</h2>
                <blockquote className="testimonyQuote">
                  “{content.profile.testimony || 'No testimony added yet.'}”
                </blockquote>
                <p className="mutedLine">— {content.profile.firstName} {content.profile.lastName}</p>
              </section>

              <section className="card">
                <h2>Public Updates</h2>
                {publicUpdates.map((u) => (
                  <article key={u.id} className="item">
                    <h3>{u.title}</h3>
                    <small>{u.date}</small>
                    <p>{u.body}</p>
                  </article>
                ))}
              </section>

              <section className="card">
                <h2>Approved-Only Updates</h2>
                {protectedUpdates.map((u) => (
                  <article key={u.id} className="item">
                    <h3>{u.title}</h3>
                    <small>{u.date}</small>
                    <p>{u.body}</p>
                  </article>
                ))}
              </section>

              <section className="card">
                <h2>Current Area</h2>
                <p><strong>{content.map.currentArea || 'Not set'}</strong></p>
                <p>Boundary points: {content.map.boundary.length}</p>
                {content.map.boundary.length > 0 && (
                  <div className="item">
                    <small>
                      {content.map.boundary
                        .slice(0, 4)
                        .map((point) => `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`)
                        .join(' • ')}
                      {content.map.boundary.length > 4 ? ' • ...' : ''}
                    </small>
                  </div>
                )}
              </section>

              <section className="card">
                <h2>Public Photos</h2>
                {publicPhotos.length === 0 && <p>No public photos yet.</p>}
                <div className="photoGrid">
                  {publicPhotos.map((photo) => (
                    <article key={photo.id} className="item photoCard">
                      <img src={photo.url} alt={photo.title} loading="lazy" />
                      <p>{photo.title}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="card">
                <h2>Approved-Only Photos</h2>
                {approvedPhotos.length === 0 && <p>No approved-only photos yet.</p>}
                <div className="photoGrid">
                  {approvedPhotos.map((photo) => (
                    <article key={photo.id} className="item photoCard">
                      <img src={photo.url} alt={photo.title} loading="lazy" />
                      <p>{photo.title}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      )}

      {mode === 'register' && <RegisterForm onSubmit={register} />}
      {mode === 'login' && <LoginForm onSubmit={login} />}
      {mode === 'changePassword' && currentUser && <ChangePasswordForm onSubmit={changePassword} />}

      {mode === 'admin' && isAdmin && (
        <AdminPanel
          users={users}
          auditLog={auditLog}
          content={content}
          onUpdateContent={setContent}
          onSetUserStatus={approveUser}
          onResetPassword={resetUserPassword}
          onClearLockout={clearUserLockout}
          onClearAuditLog={clearAuditLog}
          onAudit={appendAudit}
          onToast={pushToast}
        />
      )}
    </div>
  );
}

function RegisterForm({ onSubmit }: { onSubmit: (input: { firstName: string; lastName: string; email: string; password: string }) => Promise<void> }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const strength = evaluatePasswordStrength(password);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isFirstNameValid = firstName.trim().length >= 2;
  const isLastNameValid = lastName.trim().length >= 2;
  const canSubmit = password.length >= 10 && strength.score >= 3;

  return (
    <main id="main-content" tabIndex={-1} className="card narrow">
      <h2>Create account</h2>
      <p>Required fields: first name, last name, email, password. Access requires admin approval.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({ firstName, lastName, email, password });
        }}
      >
        <input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        {firstName.length > 0 && !isFirstNameValid && <small className="hintError">First name should be at least 2 characters.</small>}
        <input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        {lastName.length > 0 && !isLastNameValid && <small className="hintError">Last name should be at least 2 characters.</small>}
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {email.length > 0 && !isEmailValid && <small className="hintError">Enter a valid email address.</small>}
        <input required minLength={10} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="strengthWrap" aria-live="polite">
          <div className="strengthBar">
            <div className={`strengthFill strength-${Math.max(1, strength.score)}`} />
          </div>
          <p>
            Password strength: <strong>{strength.label}</strong>
          </p>
          <small>{strength.feedback}</small>
        </div>
        <button type="submit" disabled={!canSubmit || !isFirstNameValid || !isLastNameValid || !isEmailValid}>Submit for approval</button>
      </form>
    </main>
  );
}

function LoginForm({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <main id="main-content" tabIndex={-1} className="card narrow">
      <h2>Login</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(email, password);
        }}
      >
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {email.length > 0 && !isEmailValid && <small className="hintError">Enter a valid email address.</small>}
        <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {password.length > 0 && password.length < 4 && <small className="hintInfo">Password looks too short.</small>}
        <button type="submit" disabled={!isEmailValid || password.length === 0}>Sign in</button>
      </form>
      <details className="securityHint">
        <summary>Forgot password?</summary>
        <p>
          For security, password recovery is admin-assisted only on this static-hosted site.
        </p>
        <p>
          Contact an approved admin and request a temporary reset password. After signing in, change it immediately.
        </p>
        <p>
          Never share your password through chat or public comments.
        </p>
      </details>
    </main>
  );
}

function ChangePasswordForm({
  onSubmit
}: {
  onSubmit: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const strength = evaluatePasswordStrength(newPassword);
  const matches = confirmPassword === newPassword;
  const canSubmit = newPassword.length >= 10 && strength.score >= 3 && confirmPassword.length > 0;

  return (
    <main id="main-content" tabIndex={-1} className="card narrow">
      <h2>Change password</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({ currentPassword, newPassword, confirmPassword });
        }}
      >
        <input
          required
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        {currentPassword.length > 0 && currentPassword.length < 4 && <small className="hintInfo">Current password seems very short.</small>}
        <input
          required
          minLength={10}
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          required
          minLength={10}
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <div className="strengthWrap" aria-live="polite">
          <div className="strengthBar">
            <div className={`strengthFill strength-${Math.max(1, strength.score)}`} />
          </div>
          <p>
            New password strength: <strong>{strength.label}</strong>
          </p>
          <small>{strength.feedback}</small>
        </div>

        {confirmPassword.length > 0 && !matches && (
          <p className="message">Confirmation does not match new password.</p>
        )}

        <button type="submit" disabled={!canSubmit || !matches}>
          Update password
        </button>
      </form>
    </main>
  );
}

function AdminPanel({
  users,
  auditLog,
  content,
  onSetUserStatus,
  onUpdateContent,
  onResetPassword,
  onClearLockout,
  onClearAuditLog,
  onAudit,
  onToast
}: {
  users: AppUser[];
  auditLog: AuditLogEntry[];
  content: MissionContent;
  onSetUserStatus: (id: string, status: 'approved' | 'rejected' | 'suspended') => void;
  onUpdateContent: (next: MissionContent) => void;
  onResetPassword: (id: string) => Promise<string>;
  onClearLockout: (id: string) => void;
  onClearAuditLog: () => void;
  onAudit: (action: string, details: string) => void;
  onToast: (message: string, kind?: ToastKind, ttlMs?: number) => void;
}) {
  const [editorValue, setEditorValue] = useState(JSON.stringify(content, null, 2));
  const [jsonMessage, setJsonMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspended' | 'locked'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState<'newest' | 'oldest' | 'name' | 'status' | 'lockout'>('newest');
  const [auditFilter, setAuditFilter] = useState<'all' | 'auth' | 'user' | 'content' | 'audit'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [collapsedUserIds, setCollapsedUserIds] = useState<string[]>([]);
  const [tempSecret, setTempSecret] = useState<{
    email: string;
    value: string;
    expiresAt: number;
    revealed: boolean;
  } | null>(null);

  useEffect(() => {
    setEditorValue(JSON.stringify(content, null, 2));
  }, [content]);

  useEffect(() => {
    if (!tempSecret) return;

    const timeoutMs = Math.max(0, tempSecret.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setTempSecret(null);
      setCopyMessage('Temporary password expired and was cleared.');
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [tempSecret]);

  useEffect(() => {
    const knownIds = new Set(users.map((u) => u.id));
    setSelectedUserIds((prev) => prev.filter((id) => knownIds.has(id)));
    setCollapsedUserIds((prev) => prev.filter((id) => knownIds.has(id)));
  }, [users]);

  const boundaryText = content.map.boundary.map((point) => `${point[0]},${point[1]}`).join('\n');

  const updateMap = (next: { currentArea: string; boundaryText: string }) => {
    const parsedBoundary = next.boundaryText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [latRaw, lngRaw] = line.split(',').map((value) => value.trim());
        const lat = Number(latRaw);
        const lng = Number(lngRaw);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error(`Invalid boundary point: ${line}. Use format lat,lng`);
        }
        return [lat, lng] as [number, number];
      });

    onUpdateContent({
      ...content,
      map: {
        currentArea: next.currentArea.trim(),
        boundary: parsedBoundary
      }
    });
    onToast('Map saved.');
    onAudit('map_updated', `Area set to ${next.currentArea.trim() || 'Unknown'}`);
  };

  const addPhoto = (input: { title: string; url: string; visibility: 'public' | 'approved' }) => {
    const nextPhoto = {
      id: `p-${crypto.randomUUID()}`,
      title: input.title.trim(),
      url: input.url.trim(),
      visibility: input.visibility
    };

    onUpdateContent({
      ...content,
      photos: [...content.photos, nextPhoto]
    });
    onToast('Photo added.');
    onAudit('photo_added', `${nextPhoto.title} (${nextPhoto.visibility})`);
  };

  const removePhoto = (id: string) => {
    onUpdateContent({
      ...content,
      photos: content.photos.filter((photo) => photo.id !== id)
    });
    onToast('Photo removed.', 'info');
    onAudit('photo_removed', `Removed photo ${id}`);
  };

  const setPhotoVisibility = (id: string, visibility: 'public' | 'approved') => {
    onUpdateContent({
      ...content,
      photos: content.photos.map((photo) => (photo.id === id ? { ...photo, visibility } : photo))
    });
    onToast('Photo visibility updated.');
    onAudit('photo_visibility_updated', `Photo ${id} set to ${visibility}`);
  };

  const addUpdate = (input: { title: string; date: string; body: string; visibility: 'public' | 'approved' }) => {
    const nextUpdate = {
      id: `u-${crypto.randomUUID()}`,
      title: input.title.trim(),
      date: input.date.trim(),
      body: input.body.trim(),
      visibility: input.visibility
    };

    onUpdateContent({
      ...content,
      updates: [nextUpdate, ...content.updates]
    });
    onToast('Update added.');
    onAudit('update_added', `${nextUpdate.title} (${nextUpdate.visibility})`);
  };

  const removeUpdate = (id: string) => {
    onUpdateContent({
      ...content,
      updates: content.updates.filter((update) => update.id !== id)
    });
    onToast('Update removed.', 'info');
    onAudit('update_removed', `Removed update ${id}`);
  };

  const setUpdateVisibility = (id: string, visibility: 'public' | 'approved') => {
    onUpdateContent({
      ...content,
      updates: content.updates.map((update) => (update.id === id ? { ...update, visibility } : update))
    });
    onToast('Update visibility updated.');
    onAudit('update_visibility_updated', `Update ${id} set to ${visibility}`);
  };

  const updateSite = (site: MissionContent['site']) => {
    onUpdateContent({
      ...content,
      site
    });
    onToast('Site settings saved.');
    onAudit('site_updated', `Updated site title to ${site.title}`);
  };

  const updateProfile = (profile: MissionContent['profile']) => {
    onUpdateContent({
      ...content,
      profile
    });
    onToast('Profile saved.');
    onAudit('profile_updated', `Updated profile for ${profile.firstName} ${profile.lastName}`);
  };

  const updateSettings = (settings: MissionContent['settings']) => {
    onUpdateContent({
      ...content,
      settings
    });
    onToast('Access settings saved.');
    onAudit('settings_updated', `requireApproval=${settings.requireApproval}; admins=${settings.adminEmails.length}`);
  };

  const filteredUsers = users.filter((u) => {
    const lockoutUntilMs = u.lockoutUntil ? Date.parse(u.lockoutUntil) : 0;
    const isLocked = lockoutUntilMs > Date.now();

    const statusMatch =
      userFilter === 'all'
        ? true
        : userFilter === 'locked'
          ? isLocked
          : u.status === userFilter;

    const q = userSearch.trim().toLowerCase();
    const searchMatch =
      q.length === 0
        ? true
        : `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q);

    return statusMatch && searchMatch;
  });

  const statusOrder: Record<'pending' | 'approved' | 'rejected' | 'suspended', number> = {
    pending: 0,
    approved: 1,
    suspended: 2,
    rejected: 3
  };

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aRequested = Date.parse(a.requestedAt || '0');
    const bRequested = Date.parse(b.requestedAt || '0');
    const aLock = a.lockoutUntil ? Date.parse(a.lockoutUntil) : 0;
    const bLock = b.lockoutUntil ? Date.parse(b.lockoutUntil) : 0;

    switch (userSort) {
      case 'oldest':
        return aRequested - bRequested;
      case 'name':
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      case 'status':
        return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder] || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      case 'lockout':
        return (bLock - aLock) || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      case 'newest':
      default:
        return bRequested - aRequested;
    }
  });

  const lockoutsActive = users.filter((u) => (u.lockoutUntil ? Date.parse(u.lockoutUntil) > Date.now() : false)).length;
  const pendingUsers = users.filter((u) => u.status === 'pending').length;
  const approvedUsers = users.filter((u) => u.status === 'approved').length;
  const suspendedUsers = users.filter((u) => u.status === 'suspended').length;
  const publicUpdateCount = content.updates.filter((u) => u.visibility === 'public').length;
  const protectedUpdateCount = content.updates.filter((u) => u.visibility === 'approved').length;
  const publicPhotoCount = content.photos.filter((p) => p.visibility === 'public').length;
  const protectedPhotoCount = content.photos.filter((p) => p.visibility === 'approved').length;
  const auditEvents24h = auditLog.filter((e) => Date.now() - Date.parse(e.timestamp) <= 24 * 60 * 60 * 1000).length;
  const latestAudit = auditLog[0] ?? null;

  const getActionChipClass = (action: string) => {
    if (action.startsWith('login_') || action.includes('lockout')) return 'actionChip actionChip-auth';
    if (action.startsWith('user_') || action.includes('password')) return 'actionChip actionChip-user';
    if (action.includes('audit')) return 'actionChip actionChip-audit';
    if (action.includes('photo') || action.includes('update') || action.includes('map') || action.includes('profile') || action.includes('site') || action.includes('settings') || action.includes('json')) {
      return 'actionChip actionChip-content';
    }
    return 'actionChip actionChip-default';
  };

  const formatActionLabel = (action: string) => action.replace(/_/g, ' ');

  const getAuditCategory = (action: string): 'auth' | 'user' | 'content' | 'audit' | 'other' => {
    if (action.startsWith('login_') || action.includes('lockout')) return 'auth';
    if (action.startsWith('user_') || action.includes('password')) return 'user';
    if (action.includes('audit')) return 'audit';
    if (action.includes('photo') || action.includes('update') || action.includes('map') || action.includes('profile') || action.includes('site') || action.includes('settings') || action.includes('json')) return 'content';
    return 'other';
  };

  const filteredAuditLog = auditLog.filter((entry) => {
    if (auditFilter === 'all') return true;
    return getAuditCategory(entry.action) === auditFilter;
  });

  const recentActionsFiltered = filteredAuditLog.slice(0, 8);

  const auditCounts = {
    all: auditLog.length,
    auth: auditLog.filter((e) => getAuditCategory(e.action) === 'auth').length,
    user: auditLog.filter((e) => getAuditCategory(e.action) === 'user').length,
    content: auditLog.filter((e) => getAuditCategory(e.action) === 'content').length,
    audit: auditLog.filter((e) => getAuditCategory(e.action) === 'audit').length
  };

  const visibleUserIds = filteredUsers.map((u) => u.id);
  const allVisibleSelected = visibleUserIds.length > 0 && visibleUserIds.every((id) => selectedUserIds.includes(id));
  const allVisibleCollapsed = visibleUserIds.length > 0 && visibleUserIds.every((id) => collapsedUserIds.includes(id));

  const toggleUserSelected = (id: string) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectVisible = () => {
    if (allVisibleSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !visibleUserIds.includes(id)));
      return;
    }

    setSelectedUserIds((prev) => [...new Set([...prev, ...visibleUserIds])]);
  };

  const toggleUserCollapsed = (id: string) => {
    setCollapsedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleCollapseVisible = () => {
    if (allVisibleCollapsed) {
      setCollapsedUserIds((prev) => prev.filter((id) => !visibleUserIds.includes(id)));
      return;
    }

    setCollapsedUserIds((prev) => [...new Set([...prev, ...visibleUserIds])]);
  };

  const applyBulkStatus = (status: 'approved' | 'rejected' | 'suspended') => {
    if (selectedUserIds.length === 0) return;
    selectedUserIds.forEach((id) => onSetUserStatus(id, status));
    onToast(`Bulk updated ${selectedUserIds.length} user(s) to ${status}.`);
    onAudit('bulk_user_status_update', `Set ${selectedUserIds.length} selected user(s) to ${status}`);
    setSelectedUserIds([]);
  };

  const applyBulkClearLockout = () => {
    if (selectedUserIds.length === 0) return;
    selectedUserIds.forEach((id) => onClearLockout(id));
    onToast(`Cleared lockout for ${selectedUserIds.length} selected user(s).`, 'info');
    onAudit('bulk_lockout_clear', `Cleared lockout for ${selectedUserIds.length} selected user(s)`);
    setSelectedUserIds([]);
  };

  return (
    <main id="main-content" tabIndex={-1} className="grid">
      <section className="card">
        <h2>Quick stats</h2>
        <p className="updatedBadge">
          {latestAudit
            ? `Last data update: ${new Date(latestAudit.timestamp).toLocaleString()} (${latestAudit.action})`
            : 'Last data update: not available yet'}
        </p>
        <div className="statsGrid">
          <article className="item statCard"><strong>{users.length}</strong><small>Total users</small></article>
          <article className="item statCard"><strong>{pendingUsers}</strong><small>Pending approvals</small></article>
          <article className="item statCard"><strong>{approvedUsers}</strong><small>Approved users</small></article>
          <article className="item statCard"><strong>{suspendedUsers}</strong><small>Suspended users</small></article>
          <article className="item statCard"><strong>{lockoutsActive}</strong><small>Active lockouts</small></article>
          <article className="item statCard"><strong>{auditEvents24h}</strong><small>Audit events (24h)</small></article>
          <article className="item statCard"><strong>{publicUpdateCount}</strong><small>Public updates</small></article>
          <article className="item statCard"><strong>{protectedUpdateCount}</strong><small>Approved-only updates</small></article>
          <article className="item statCard"><strong>{publicPhotoCount}</strong><small>Public photos</small></article>
          <article className="item statCard"><strong>{protectedPhotoCount}</strong><small>Approved-only photos</small></article>
        </div>
      </section>

      <section className="card">
        <h2>Recent actions</h2>
        <div className="actions">
          <button className={auditFilter === 'all' ? 'tabActive' : ''} onClick={() => setAuditFilter('all')} aria-label="Show all audit actions">All ({auditCounts.all})</button>
          <button className={auditFilter === 'auth' ? 'tabActive' : ''} onClick={() => setAuditFilter('auth')} aria-label="Show auth audit actions">Auth ({auditCounts.auth})</button>
          <button className={auditFilter === 'user' ? 'tabActive' : ''} onClick={() => setAuditFilter('user')} aria-label="Show user audit actions">User ({auditCounts.user})</button>
          <button className={auditFilter === 'content' ? 'tabActive' : ''} onClick={() => setAuditFilter('content')} aria-label="Show content audit actions">Content ({auditCounts.content})</button>
          <button className={auditFilter === 'audit' ? 'tabActive' : ''} onClick={() => setAuditFilter('audit')} aria-label="Show audit maintenance actions">Audit ({auditCounts.audit})</button>
        </div>
        {recentActionsFiltered.length === 0 && <p>No recent actions yet.</p>}
        {recentActionsFiltered.map((entry) => (
          <article key={entry.id} className="item">
            <p><span className={getActionChipClass(entry.action)}>{formatActionLabel(entry.action)}</span></p>
            <p>{entry.details}</p>
            <small>{new Date(entry.timestamp).toLocaleString()} • {entry.actor}</small>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>User approvals</h2>
        <div className="actions">
          <select aria-label="Filter approval queue status" value={userFilter} onChange={(e) => setUserFilter(e.target.value as 'all' | 'pending' | 'approved' | 'rejected' | 'suspended' | 'locked')}>
            <option value="all">All users</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
            <option value="locked">Locked</option>
          </select>
          <input
            aria-label="Search users"
            placeholder="Search by name or email"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          <select aria-label="Sort approval queue" value={userSort} onChange={(e) => setUserSort(e.target.value as 'newest' | 'oldest' | 'name' | 'status' | 'lockout')}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="status">Status</option>
            <option value="lockout">Lockout first</option>
          </select>
        </div>
        <small className="hintInfo">Showing {sortedUsers.length} of {users.length} users • Selected: {selectedUserIds.length}</small>
        <div className="actions">
          <button aria-label={allVisibleSelected ? 'Deselect all visible users' : 'Select all visible users'} onClick={toggleSelectVisible}>
            {allVisibleSelected ? 'Deselect visible' : 'Select visible'}
          </button>
          <button aria-label={allVisibleCollapsed ? 'Expand all visible users' : 'Collapse all visible users'} onClick={toggleCollapseVisible}>
            {allVisibleCollapsed ? 'Expand visible' : 'Collapse visible'}
          </button>
          <button aria-label="Bulk approve selected users" disabled={selectedUserIds.length === 0} onClick={() => applyBulkStatus('approved')}>
            Bulk approve
          </button>
          <button aria-label="Bulk reject selected users" disabled={selectedUserIds.length === 0} onClick={() => applyBulkStatus('rejected')}>
            Bulk reject
          </button>
          <button aria-label="Bulk suspend selected users" disabled={selectedUserIds.length === 0} onClick={() => applyBulkStatus('suspended')}>
            Bulk suspend
          </button>
          <button aria-label="Bulk clear lockout for selected users" disabled={selectedUserIds.length === 0} onClick={applyBulkClearLockout}>
            Bulk clear lockout
          </button>
        </div>
        {tempSecret && (
          <div className="message">
            <p>
              Temporary password for <strong>{tempSecret.email}</strong>
            </p>
            <p className="mono">
              {tempSecret.revealed
                ? tempSecret.value
                : '••••••••••••••••'}
            </p>
            <p><small>Visible for 60 seconds, then auto-cleared.</small></p>
            <div className="actions">
              <button aria-label="Toggle temporary password visibility" onClick={() => setTempSecret((prev) => (prev ? { ...prev, revealed: !prev.revealed } : prev))}>
                {tempSecret.revealed ? 'Hide' : 'Reveal'} password
              </button>
              <button
                aria-label="Copy temporary password"
                onClick={() => {
                  if (!tempSecret.revealed) {
                    setCopyMessage('Reveal the temporary password before copying.');
                    return;
                  }

                  const secret = tempSecret.value;
                  if (!navigator.clipboard?.writeText) {
                    setCopyMessage('Clipboard API unavailable in this browser.');
                    return;
                  }

                  void navigator.clipboard.writeText(secret)
                    .then(() => setCopyMessage('Temporary password copied to clipboard.'))
                    .catch(() => setCopyMessage('Copy failed. Please copy manually.'));
                }}
              >
                Copy password
              </button>
              <button
                aria-label="Clear temporary password display"
                onClick={() => {
                  setTempSecret(null);
                  setCopyMessage('Temporary password cleared.');
                }}
              >
                Clear now
              </button>
            </div>
          </div>
        )}
        {copyMessage && <p className="message">{copyMessage}</p>}
        {users.length === 0 && <p>No users yet.</p>}
        {users.length > 0 && sortedUsers.length === 0 && <p>No users match current filters.</p>}
        {sortedUsers.map((u) => {
          const lockoutUntilMs = u.lockoutUntil ? Date.parse(u.lockoutUntil) : 0;
          const isLocked = lockoutUntilMs > Date.now();
          const isCollapsed = collapsedUserIds.includes(u.id);

          return (
            <article key={u.id} className="item">
              <div className="actions">
                <button aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} card for ${u.email}`} onClick={() => toggleUserCollapsed(u.id)}>
                  {isCollapsed ? 'Expand' : 'Collapse'} card
                </button>
              </div>
              <label className="hintInfo">
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(u.id)}
                  onChange={() => toggleUserSelected(u.id)}
                  aria-label={`Select user ${u.email} for bulk actions`}
                />{' '}
                Select
              </label>
              <h3>{u.firstName} {u.lastName}</h3>
              <p>{u.email}</p>
              {isCollapsed && <small className="hintInfo">Card collapsed. Expand to view actions.</small>}
              {!isCollapsed && (
                <>
              <p>Status: <strong>{u.status}</strong></p>
              <p>Failed attempts: <strong>{u.failedLoginAttempts ?? 0}</strong></p>
              <p>Lockout: <strong>{isLocked ? `Until ${new Date(lockoutUntilMs).toLocaleTimeString()}` : 'Not locked'}</strong></p>
              <div className="actions">
                <button aria-label={`Approve account for ${u.email}`} onClick={() => onSetUserStatus(u.id, 'approved')}>Approve</button>
                <button aria-label={`Reject account for ${u.email}`} onClick={() => onSetUserStatus(u.id, 'rejected')}>Reject</button>
                <button aria-label={`Suspend account for ${u.email}`} onClick={() => onSetUserStatus(u.id, 'suspended')}>Suspend</button>
                <button
                  aria-label={`Reset password for ${u.email}`}
                  onClick={() => {
                    void onResetPassword(u.id).then((temporaryPassword) => {
                      setTempSecret({
                        email: u.email,
                        value: temporaryPassword,
                        expiresAt: Date.now() + 60_000,
                        revealed: false
                      });
                      setCopyMessage('Temporary password generated. Reveal to view/copy.');
                      onToast('Temporary password generated.', 'info');
                      onAudit('user_password_reset_secret_generated', `Generated temporary secret for ${u.email}`);
                    });
                  }}
                >
                  Reset password
                </button>
                <button aria-label={`Clear lockout for ${u.email}`} onClick={() => onClearLockout(u.id)}>Clear lockout</button>
              </div>
                </>
              )}
            </article>
          );
        })}
      </section>

      <section className="card">
        <h2>Site settings editor</h2>
        <SiteEditor site={content.site} onSave={updateSite} />
      </section>

      <section className="card">
        <h2>Profile editor</h2>
        <ProfileEditor profile={content.profile} onSave={updateProfile} />
      </section>

      <section className="card">
        <h2>Access settings</h2>
        <SettingsEditor settings={content.settings} onSave={updateSettings} />
      </section>

      <section className="card">
        <h2>Map editor</h2>
        <MapEditor currentArea={content.map.currentArea} boundaryText={boundaryText} onSave={updateMap} />
      </section>

      <section className="card">
        <h2>Photo manager</h2>
        <PhotoEditor
          photos={content.photos}
          onAddPhoto={addPhoto}
          onRemovePhoto={removePhoto}
          onSetVisibility={setPhotoVisibility}
        />
      </section>

      <section className="card">
        <h2>Updates manager</h2>
        <UpdatesEditor
          updates={content.updates}
          onAddUpdate={addUpdate}
          onRemoveUpdate={removeUpdate}
          onSetVisibility={setUpdateVisibility}
        />
      </section>

      <section className="card">
        <h2>Full site JSON editor</h2>
        <p>Every detail of the webapp is editable here. Update JSON then save.</p>
        {jsonMessage && <p className="message">{jsonMessage}</p>}
        <textarea aria-label="Full site JSON editor" value={editorValue} onChange={(e) => setEditorValue(e.target.value)} rows={24} />
        <div className="actions">
          <button
            aria-label="Save full site JSON content"
            onClick={() => {
              try {
                const parsed = JSON.parse(editorValue) as MissionContent;
                onUpdateContent(parsed);
                setJsonMessage('JSON saved successfully.');
                onToast('JSON content saved.');
                onAudit('json_content_saved', 'Saved full site JSON editor content');
              } catch (error) {
                setJsonMessage(error instanceof Error ? error.message : 'Invalid JSON.');
              }
            }}
          >
            Save content
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Audit log</h2>
        <div className="actions">
          <button
            aria-label="Export audit log as JSON"
            onClick={() => {
              const blob = new Blob([JSON.stringify(auditLog, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `audit-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              onToast('Audit log exported.');
              onAudit('audit_exported', 'Exported audit log JSON');
            }}
          >
            Export audit JSON
          </button>
          <button
            aria-label="Clear all audit log entries"
            onClick={() => {
              onClearAuditLog();
              onToast('Audit log cleared.', 'info');
              onAudit('audit_cleared', 'Cleared audit log from local storage');
            }}
          >
            Clear audit log
          </button>
        </div>
        {filteredAuditLog.length === 0 && <p>No audit events for current filter.</p>}
        {filteredAuditLog.slice(0, 30).map((entry) => (
          <article key={entry.id} className="item">
            <p><span className={getActionChipClass(entry.action)}>{formatActionLabel(entry.action)}</span></p>
            <p>{entry.details}</p>
            <small>{new Date(entry.timestamp).toLocaleString()} • {entry.actor}</small>
          </article>
        ))}
      </section>
    </main>
  );
}

function MapEditor({
  currentArea,
  boundaryText,
  onSave
}: {
  currentArea: string;
  boundaryText: string;
  onSave: (next: { currentArea: string; boundaryText: string }) => void;
}) {
  const [area, setArea] = useState(currentArea);
  const [points, setPoints] = useState(boundaryText);
  const [message, setMessage] = useState('');
  const hasBadPoint = points
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => {
      const [latRaw, lngRaw] = line.split(',').map((value) => value.trim());
      return !Number.isFinite(Number(latRaw)) || !Number.isFinite(Number(lngRaw));
    });

  useEffect(() => {
    setArea(currentArea);
    setPoints(boundaryText);
  }, [boundaryText, currentArea]);

  return (
    <>
      {message && <p className="message">{message}</p>}
      <input aria-label="Current mission area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Current area" />
      <textarea
        aria-label="Map boundary points"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        rows={8}
        placeholder="One point per line in the format: lat,lng"
      />
      {hasBadPoint && <small className="hintError">Each boundary line must be numeric in this format: lat,lng</small>}
      <div className="actions">
        <button
          aria-label="Save map changes"
          onClick={() => {
            try {
              onSave({ currentArea: area, boundaryText: points });
              setMessage('Map updated.');
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Failed to update map.');
            }
          }}
        >
          Save map
        </button>
      </div>
    </>
  );
}

function SiteEditor({
  site,
  onSave
}: {
  site: MissionContent['site'];
  onSave: (site: MissionContent['site']) => void;
}) {
  const [title, setTitle] = useState(site.title);
  const [subtitle, setSubtitle] = useState(site.subtitle);
  const [missionName, setMissionName] = useState(site.missionName);

  useEffect(() => {
    setTitle(site.title);
    setSubtitle(site.subtitle);
    setMissionName(site.missionName);
  }, [site]);

  return (
    <>
      <input aria-label="Site title" placeholder="Site title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input aria-label="Site subtitle" placeholder="Site subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
      <input aria-label="Mission name" placeholder="Mission name" value={missionName} onChange={(e) => setMissionName(e.target.value)} />
      <div className="actions">
        <button
          aria-label="Save site settings"
          onClick={() =>
            onSave({
              title: title.trim(),
              subtitle: subtitle.trim(),
              missionName: missionName.trim()
            })
          }
        >
          Save site settings
        </button>
      </div>
    </>
  );
}

function ProfileEditor({
  profile,
  onSave
}: {
  profile: MissionContent['profile'];
  onSave: (profile: MissionContent['profile']) => void;
}) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [bio, setBio] = useState(profile.bio);
  const [testimony, setTestimony] = useState(profile.testimony);

  useEffect(() => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setBio(profile.bio);
    setTestimony(profile.testimony);
  }, [profile]);

  return (
    <>
      <input aria-label="Profile first name" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      <input aria-label="Profile last name" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      <textarea aria-label="Profile bio" placeholder="Bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
      <textarea aria-label="Profile testimony" placeholder="Testimony" rows={5} value={testimony} onChange={(e) => setTestimony(e.target.value)} />
      <div className="item previewCard">
        <h3>Live profile preview</h3>
        <p><strong>{(firstName || 'First')} {(lastName || 'Last')}</strong></p>
        <p>{bio || 'Bio preview will appear here.'}</p>
        <blockquote className="testimonyQuote">
          “{testimony || 'Testimony preview will appear here.'}”
        </blockquote>
      </div>
      <div className="actions">
        <button
          aria-label="Save profile"
          onClick={() =>
            onSave({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              bio: bio.trim(),
              testimony: testimony.trim()
            })
          }
        >
          Save profile
        </button>
      </div>
    </>
  );
}

function SettingsEditor({
  settings,
  onSave
}: {
  settings: MissionContent['settings'];
  onSave: (settings: MissionContent['settings']) => void;
}) {
  const [requireApproval, setRequireApproval] = useState(settings.requireApproval);
  const [adminEmailsText, setAdminEmailsText] = useState(settings.adminEmails.join('\n'));
  const [message, setMessage] = useState('');
  const parsedAdminEmails = adminEmailsText
    .split(/\n|,/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const invalidAdminEmail = parsedAdminEmails.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  useEffect(() => {
    setRequireApproval(settings.requireApproval);
    setAdminEmailsText(settings.adminEmails.join('\n'));
  }, [settings]);

  return (
    <>
      {message && <p className="message">{message}</p>}
      <label>
        <input
          type="checkbox"
          checked={requireApproval}
          onChange={(e) => setRequireApproval(e.target.checked)}
        />{' '}
        Require admin approval for protected content
      </label>
      <textarea
        aria-label="Admin emails"
        rows={6}
        value={adminEmailsText}
        onChange={(e) => setAdminEmailsText(e.target.value)}
        placeholder="One admin email per line"
      />
      {invalidAdminEmail && <small className="hintError">Invalid admin email: {invalidAdminEmail}</small>}
      {!invalidAdminEmail && parsedAdminEmails.length > 0 && <small className="hintInfo">{[...new Set(parsedAdminEmails)].length} admin email(s) detected.</small>}
      <div className="actions">
        <button
          aria-label="Save access settings"
          onClick={() => {
            const emails = parsedAdminEmails;

            const uniqueEmails = [...new Set(emails)];
            const invalid = uniqueEmails.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

            if (invalid) {
              setMessage(`Invalid email: ${invalid}`);
              return;
            }

            if (uniqueEmails.length === 0) {
              setMessage('At least one admin email is required.');
              return;
            }

            onSave({
              requireApproval,
              adminEmails: uniqueEmails
            });
            setMessage('Settings saved.');
          }}
        >
          Save settings
        </button>
      </div>
    </>
  );
}

function PhotoEditor({
  photos,
  onAddPhoto,
  onRemovePhoto,
  onSetVisibility
}: {
  photos: MissionContent['photos'];
  onAddPhoto: (input: { title: string; url: string; visibility: 'public' | 'approved' }) => void;
  onRemovePhoto: (id: string) => void;
  onSetVisibility: (id: string, visibility: 'public' | 'approved') => void;
}) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'approved'>('public');
  const isUrlValid = /^https?:\/\//i.test(url.trim()) || url.trim().startsWith('data:image/');

  return (
    <>
      <input aria-label="Photo title" placeholder="Photo title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input aria-label="Photo URL" placeholder="Photo URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      {url.length > 0 && !isUrlValid && <small className="hintError">Use an https:// URL (or data:image URI).</small>}
      <select aria-label="Photo visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'approved')}>
        <option value="public">Public</option>
        <option value="approved">Approved only</option>
      </select>
      <div className="actions">
        <button
          aria-label="Add photo"
          onClick={() => {
            if (!title.trim() || !url.trim() || !isUrlValid) {
              return;
            }
            onAddPhoto({ title, url, visibility });
            setTitle('');
            setUrl('');
            setVisibility('public');
          }}
        >
          Add photo
        </button>
      </div>

      <div className="photoGrid">
        {photos.map((photo) => (
          <article key={photo.id} className="item photoCard">
            <img src={photo.url} alt={photo.title} loading="lazy" />
            <p>{photo.title}</p>
            <div className="actions">
              <button
                aria-label={`Toggle visibility for photo ${photo.title}`}
                onClick={() =>
                  onSetVisibility(photo.id, photo.visibility === 'public' ? 'approved' : 'public')
                }
              >
                Set {photo.visibility === 'public' ? 'approved' : 'public'}
              </button>
              <button aria-label={`Remove photo ${photo.title}`} onClick={() => onRemovePhoto(photo.id)}>Remove</button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function UpdatesEditor({
  updates,
  onAddUpdate,
  onRemoveUpdate,
  onSetVisibility
}: {
  updates: MissionContent['updates'];
  onAddUpdate: (input: { title: string; date: string; body: string; visibility: 'public' | 'approved' }) => void;
  onRemoveUpdate: (id: string) => void;
  onSetVisibility: (id: string, visibility: 'public' | 'approved') => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'approved'>('public');

  return (
    <>
      <input aria-label="Update title" placeholder="Update title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input aria-label="Update date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <textarea aria-label="Update body" placeholder="Update body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      <select aria-label="Update visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'approved')}>
        <option value="public">Public</option>
        <option value="approved">Approved only</option>
      </select>
      <div className="actions">
        <button
          aria-label="Add update"
          onClick={() => {
            if (!title.trim() || !body.trim() || !date.trim()) {
              return;
            }
            onAddUpdate({ title, date, body, visibility });
            setTitle('');
            setBody('');
            setVisibility('public');
          }}
        >
          Add update
        </button>
      </div>

      {updates.map((update) => (
        <article key={update.id} className="item">
          <h3>{update.title}</h3>
          <small>{update.date}</small>
          <p>{update.body}</p>
          <p>Visibility: <strong>{update.visibility}</strong></p>
          <div className="actions">
            <button
              aria-label={`Toggle visibility for update ${update.title}`}
              onClick={() =>
                onSetVisibility(update.id, update.visibility === 'public' ? 'approved' : 'public')
              }
            >
              Set {update.visibility === 'public' ? 'approved' : 'public'}
            </button>
            <button aria-label={`Remove update ${update.title}`} onClick={() => onRemoveUpdate(update.id)}>Remove</button>
          </div>
        </article>
      ))}
    </>
  );
}
