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
import { getGitHubConfig, saveGitHubConfig, testGitHubConnection, pushDataToGitHub } from '../lib/github';
import { MissionMap } from './MissionMap';

const DEFAULT_CONTENT: MissionContent = {
  site: {
    title: 'Mission Portal',
    subtitle: 'Secure updates for approved family and friends',
    missionName: 'Idaho Falls Mission'
  },
  profile: {
    firstName: 'Michael',
    lastName: 'Gledhill',
    bio: 'Serving in the Idaho Falls Mission from 2024–2026.',
    testimony: 'I know God lives and that He knows each of us personally. This work is transforming lives.'
  },
  updates: [
    {
      id: 'u-1',
      title: 'Welcome to the New Portal',
      date: '2026-04-01',
      body: 'This secure platform allows me to share mission updates with family and friends. You can see photos, read my experiences, and stay connected.',
      visibility: 'public'
    }
  ],
  map: {
    boundary: [[43.4917, -112.0339]],
    currentArea: 'Idaho Falls West'
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
interface BootstrapAdminCredentials {
  email: string;
  password: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
const INACTIVITY_WARNING_MS = 60 * 1000;
const DEFAULT_BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
const DEFAULT_BOOTSTRAP_ADMIN_PASSWORD = 'Admin@12345!';

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
  const [bootstrapAdmin, setBootstrapAdmin] = useState<BootstrapAdminCredentials | null>(null);

  useEffect(() => {
    const boot = async () => {
      let activeContent = DEFAULT_CONTENT;
      const localContent = loadContent();
      if (localContent) {
        setContent(localContent);
        activeContent = localContent;
      } else {
        try {
          const res = await fetch('./data/content.json');
          if (res.ok) {
            const json = (await res.json()) as MissionContent;
            setContent(json);
            activeContent = json;
          }
        } catch {
          // fallback to default
        }
      }

      const loadedUsers = loadUsers();
      if (loadedUsers.length === 0) {
        const adminEmail = normalizeEmail(activeContent.settings.adminEmails[0] ?? DEFAULT_BOOTSTRAP_ADMIN_EMAIL);
        const salt = generateSalt();
        const passwordHash = await hashPassword(DEFAULT_BOOTSTRAP_ADMIN_PASSWORD, salt);
        const nowIso = new Date().toISOString();

        const adminUser: AppUser = {
          id: crypto.randomUUID(),
          firstName: 'Site',
          lastName: 'Admin',
          email: adminEmail,
          passwordHash,
          salt,
          status: 'approved',
          requestedAt: nowIso,
          decidedAt: nowIso,
          failedLoginAttempts: 0
        };

        setUsers([adminUser]);
        setBootstrapAdmin({
          email: adminEmail,
          password: DEFAULT_BOOTSTRAP_ADMIN_PASSWORD
        });
        setMessage('Default admin account created for first-time setup. See login details below.');
        setAuditLog((prev) => [
          {
            id: `audit-${crypto.randomUUID()}`,
            timestamp: nowIso,
            actor: 'system',
            action: 'admin_bootstrap_created',
            details: `Created first-run admin account ${adminEmail}`
          },
          ...prev
        ].slice(0, 200));
      } else {
        setUsers(loadedUsers);
      }
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
    appendAudit('user_registered', `${email} registered`);
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

  const missionDuration = 24;
  const startDate = new Date('2024-01-08');
  const endDate = new Date('2026-01-08');
  const now = new Date();
  const totalMs = endDate.getTime() - startDate.getTime();
  const elapsedMs = now.getTime() - startDate.getTime();
  const monthsServed = Math.floor(elapsedMs / (30 * 24 * 60 * 60 * 1000));
  const progressPercent = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  const missionTimeline = [
    { id: 1, date: 'January 2024', event: 'Entered MTC in Provo', status: 'done' as const },
    { id: 2, date: 'March 2024', event: 'Arrived in Idaho — First area: Rexburg', status: 'done' as const },
    { id: 3, date: 'September 2024', event: 'Transferred to Pocatello', status: 'done' as const },
    { id: 4, date: 'January 2025', event: 'Transferred to Idaho Falls West', status: 'done' as const },
    { id: 5, date: 'July 2025', event: '18-month mark 🎉', status: monthsServed >= 18 ? 'done' : 'future' as const },
    { id: 6, date: 'January 2026', event: 'Return Home — Mission Complete', status: 'future' as const }
  ];

  const fakeMessages = [
    { id: 1, name: 'Grandma Ruth', relation: 'Family', message: 'So proud of you Elder! We pray for you every morning.', date: new Date().toLocaleDateString() },
    { id: 2, name: 'Sister Johnson', relation: 'Ward Member', message: 'Your testimony has strengthened mine. Thank you.', date: (new Date(Date.now() - 86400000)).toLocaleDateString() }
  ];

  return (
    <div className="page">
      <a className="skipLink" href="#main-content">Skip to main content</a>
      
      <header className="topbar">
        <div>
          <h1>{content.site.title}</h1>
          <p>{content.site.subtitle}</p>
        </div>
        <nav className="nav" aria-label="Primary">
          <button onClick={() => { setMode('home'); setMessage(''); }} aria-current={mode === 'home' ? 'page' : undefined}>Home</button>
          {!sessionEmail && <button onClick={() => { setMode('register'); setMessage(''); }} aria-current={mode === 'register' ? 'page' : undefined}>Register</button>}
          {!sessionEmail && <button onClick={() => { setMode('login'); setMessage(''); }} aria-current={mode === 'login' ? 'page' : undefined}>Login</button>}
          {currentUser && <button onClick={() => { setMode('changePassword'); setMessage(''); }} aria-current={mode === 'changePassword' ? 'page' : undefined}>Change Password</button>}
          {isAdmin && <button onClick={() => { setMode('admin'); setMessage(''); }} aria-current={mode === 'admin' ? 'page' : undefined}>Admin</button>}
          {currentUser && <button onClick={() => { logout(); setMode('home'); }}>Logout</button>}
        </nav>
      </header>

      {message && <p className="message">{message}</p>}
      {inactivitySecondsLeft !== null && sessionEmail && (
        <p className="message">Session expires in {inactivitySecondsLeft}s due to inactivity.</p>
      )}

      <div className="toastStack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
            {toast.message}
          </div>
        ))}
      </div>

      {mode === 'home' && (
        <main id="main-content" tabIndex={-1}>
          {!sessionEmail && (
            <section className="hero">
              <div className="hero-in">
                <p className="eyebrow">{content.site.missionName}</p>
                <h1>{content.profile.firstName} <em>{content.profile.lastName}</em></h1>
                <p>{content.profile.bio}</p>
                <div className="hero-stats">
                  <div>
                    <div className="hs-v">{monthsServed}</div>
                    <div className="hs-l">Months served</div>
                  </div>
                  <div>
                    <div className="hs-v">{progressPercent}%</div>
                    <div className="hs-l">Mission progress</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {canViewMissionInfo && (
            <div className="wrap">
              <div className="g2" style={{ marginBottom: '32px' }}>
                <div className="card">
                  <h2 className="card-title">Mission Information</h2>
                  <p><strong>Full name:</strong> {content.profile.firstName} {content.profile.lastName}</p>
                  <p><strong>Mission:</strong> {content.site.missionName}</p>
                  <p><strong>Current area:</strong> {content.map.currentArea}</p>
                  <p><strong>Months served:</strong> {monthsServed} of {missionDuration}</p>
                </div>

                <div className="card">
                  <h2 className="card-title">Progress</h2>
                  <div className="prog-wrap">
                    <div className="prog-row">
                      <span className="prog-lbl">Mission timeline</span>
                      <span className="prog-val">{progressPercent}%</span>
                    </div>
                    <div className="prog-track">
                      <div className="prog-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className="milestones">
                      {missionTimeline.map((t) => (
                        <div key={t.id} className={`ms ${t.status}`}>
                          {Math.round((t.id - 1) / (missionTimeline.length - 1) * 100)}%
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid">
                <section className="card">
                  <h2 className="card-title">Quick Stats</h2>
                  <div className="stats">
                    <article className="item statCard">
                      <strong>6</strong>
                      <small>Total updates</small>
                    </article>
                    <article className="item statCard">
                      <strong>{publicPhotos.length}</strong>
                      <small>Public photos</small>
                    </article>
                    <article className="item statCard">
                      <strong>{approvedPhotos.length}</strong>
                      <small>Approved photos</small>
                    </article>
                    <article className="item statCard">
                      <strong>{users.length}</strong>
                      <small>Total supporters</small>
                    </article>
                  </div>
                </section>

                <section className="card">
                  <h2 className="card-title">Testimony</h2>
                  <blockquote className="testimonyQuote">
                    "{content.profile.testimony || 'No testimony added yet.'}"
                  </blockquote>
                  <p className="mutedLine">— {content.profile.firstName} {content.profile.lastName}</p>
                </section>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <div className="card">
                  <h2 className="card-title">Recent Updates</h2>
                  {[...publicUpdates, ...protectedUpdates].slice(0, 4).map((update, idx) => (
                    <article key={update.id} className="post" style={{ marginBottom: '16px', animation: `fadeUp 0.35s ease ${idx * 0.08}s both` }}>
                      <div className="post-hd">
                        <span className="wk-b">Week {Math.floor(Math.random() * 50)}</span>
                      </div>
                      <div style={{ padding: '13px 22px 0' }}>
                        <div className="post-date">{update.date}</div>
                        <h3 className="post-title">{update.title}</h3>
                      </div>
                      <div className="post-body">{update.body}</div>
                      {update.visibility === 'approved' && <div className="post-tags"><span className="tag">Approved only</span></div>}
                    </article>
                  ))}
                </div>
              </div>

              {publicPhotos.length > 0 && (
                <div className="card" style={{ marginBottom: '32px' }}>
                  <h2 className="card-title">Public Photos</h2>
                  <div className="photoGrid">
                    {publicPhotos.map((photo) => (
                      <article key={photo.id} className="photoCard" title={photo.title}>
                        <img src={photo.url} alt={photo.title} loading="lazy" />
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {approvedPhotos.length > 0 && isApproved && (
                <div className="card" style={{ marginBottom: '32px' }}>
                  <h2 className="card-title">Approved-Only Photos</h2>
                  <div className="photoGrid">
                    {approvedPhotos.map((photo) => (
                      <article key={photo.id} className="photoCard" title={photo.title}>
                        <img src={photo.url} alt={photo.title} loading="lazy" />
                      </article>
                    ))}
                  </div>
                </div>
              )}

              <div className="g2" style={{ marginBottom: '32px' }}>
                <div className="card">
                  <h2 className="card-title">Mission Timeline</h2>
                  <div className="tl">
                    {missionTimeline.map((item) => (
                      <div key={item.id} className={`tl-item ${item.status}`}>
                        <div className="tl-date">{item.date}</div>
                        <div className="tl-text">{item.event}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h2 className="card-title">Messages from Supporters</h2>
                  {fakeMessages.map((msg) => (
                    <div key={msg.id} className="msg-item">
                      <div className="msg-from">{msg.name}</div>
                      <div className="msg-relation">{msg.relation}</div>
                      <div className="msg-text">"{msg.message}"</div>
                      <div className="msg-date">{msg.date}</div>
                    </div>
                  ))}
                </div>
              </div>

              {content.map.boundary.length > 0 && (
                <div className="card" style={{ marginBottom: '32px' }}>
                  <h2 className="card-title">Current Area: {content.map.currentArea}</h2>
                  <MissionMap
                    boundary={content.map.boundary}
                    currentLat={content.map.boundary[0]?.[0] || 43.4917}
                    currentLng={content.map.boundary[0]?.[1] || -112.0339}
                    currentArea={content.map.currentArea}
                  />
                </div>
              )}
            </div>
          )}

          {!canViewMissionInfo && (
            <div className="wrap">
              <section className="card narrow">
                <h2 className="card-title">Approval Required</h2>
                <p>Your account must be approved before you can view mission information.</p>
                <p>Please register/login, then wait for admin approval.</p>
              </section>
            </div>
          )}
        </main>
      )}

      {mode === 'register' && <RegisterForm onSubmit={register} />}
      {mode === 'login' && <LoginForm onSubmit={login} bootstrapAdmin={bootstrapAdmin} />}
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
          onAudit={appendAudit}
          onToast={pushToast}
          currentUser={currentUser}
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
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card narrow">
        <h2 className="card-title">Create Account</h2>
        <p className="card-desc">Register to request access to mission updates.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit({ firstName, lastName, email, password });
          }}
        >
          <div className="fg">
            <label>First Name</label>
            <input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            {firstName.length > 0 && !isFirstNameValid && <small className="hintError">First name should be at least 2 characters.</small>}
          </div>
          <div className="fg">
            <label>Last Name</label>
            <input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            {lastName.length > 0 && !isLastNameValid && <small className="hintError">Last name should be at least 2 characters.</small>}
          </div>
          <div className="fg">
            <label>Email</label>
            <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {email.length > 0 && !isEmailValid && <small className="hintError">Enter a valid email address.</small>}
          </div>
          <div className="fg">
            <label>Password</label>
            <input required minLength={10} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="strengthWrap" aria-live="polite">
              <div className="strengthBar">
                <div className={`strengthFill strength-${Math.max(1, strength.score)}`} />
              </div>
              <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                Password strength: <strong>{strength.label}</strong>
              </p>
              <small>{strength.feedback}</small>
            </div>
          </div>
          <div className="actions">
            <button type="submit" className="bn bfull" disabled={!canSubmit || !isFirstNameValid || !isLastNameValid || !isEmailValid}>Submit for Approval</button>
          </div>
        </form>
      </div>
    </main>
  );
}

function LoginForm({ onSubmit, bootstrapAdmin }: { onSubmit: (email: string, password: string) => Promise<void>; bootstrapAdmin: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card narrow">
        <h2 className="card-title">Sign In</h2>
        {bootstrapAdmin && (
          <div className="message" style={{ marginBottom: '16px', background: 'var(--gold-dim)', border: '1px solid #D4B46B', color: 'var(--navy)' }}>
            <p><strong>Starter Admin Login</strong></p>
            <p>Email: <code className="mono" style={{ background: 'rgba(255,255,255,0.5)', padding: '2px 4px', borderRadius: '3px' }}>{bootstrapAdmin.email}</code></p>
            <p>Password: <code className="mono" style={{ background: 'rgba(255,255,255,0.5)', padding: '2px 4px', borderRadius: '3px' }}>{bootstrapAdmin.password}</code></p>
            <small>Change this password immediately after your first login.</small>
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsSubmitting(true);
            try {
              await onSubmit(email.trim(), password);
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <div className="fg">
            <label>Email</label>
            <input required type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {email.length > 0 && !isEmailValid && <small className="hintError">Enter a valid email address.</small>}
          </div>
          <div className="fg">
            <label>Password</label>
            <input
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
            />
            <div className="actions" style={{ marginTop: '6px' }}>
              <button type="button" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? 'Hide' : 'Show'} password
              </button>
            </div>
            {capsLockOn && <small className="hintInfo">Caps Lock is on.</small>}
            {password.length > 0 && password.length < 4 && <small className="hintInfo">Password looks too short.</small>}
          </div>
          <div className="actions">
            <button type="submit" className="bn bfull" disabled={!isEmailValid || password.length === 0 || isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>
        <details className="securityHint">
          <summary>Forgot password?</summary>
          <p>For security, password recovery is admin-assisted only on this static-hosted site.</p>
          <p>Contact an approved admin and request a temporary reset password. After signing in, change it immediately.</p>
          <p>Never share your password through chat or public comments.</p>
        </details>
      </div>
    </main>
  );
}

function ChangePasswordForm({ onSubmit }: { onSubmit: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const strength = evaluatePasswordStrength(newPassword);
  const matches = confirmPassword === newPassword;
  const canSubmit = newPassword.length >= 10 && strength.score >= 3 && confirmPassword.length > 0;

  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card narrow">
        <h2 className="card-title">Change Password</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit({ currentPassword, newPassword, confirmPassword });
          }}
        >
          <div className="fg">
            <label>Current Password</label>
            <input required type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            {currentPassword.length > 0 && currentPassword.length < 4 && <small className="hintInfo">Current password seems very short.</small>}
          </div>
          <div className="fg">
            <label>New Password</label>
            <input required minLength={10} type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="fg">
            <label>Confirm New Password</label>
            <input required minLength={10} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <div className="strengthWrap" aria-live="polite">
            <div className="strengthBar">
              <div className={`strengthFill strength-${Math.max(1, strength.score)}`} />
            </div>
            <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
              New password strength: <strong>{strength.label}</strong>
            </p>
            <small>{strength.feedback}</small>
          </div>
          {confirmPassword.length > 0 && !matches && (
            <p className="message">Confirmation does not match new password.</p>
          )}
          <div className="actions">
            <button type="submit" className="bn bfull" disabled={!canSubmit || !matches}>
              Update Password
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function AdminPanel({ users, content, onUpdateContent, onSetUserStatus, onResetPassword, onAudit, onToast }: any) {
  const [currentTab, setCurrentTab] = useState<'queue' | 'content'>('queue');
  const [editorMode, setEditorMode] = useState<'users' | 'site' | 'profile' | 'updates' | 'photos' | 'map' | 'json' | 'github'>('users');
  const [tempSecret, setTempSecret] = useState<{ email: string; value: string; expiresAt: number; revealed: boolean } | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [jsonEditor, setJsonEditor] = useState(JSON.stringify(content, null, 2));
  const [ghStatus, setGhStatus] = useState<'unconfigured' | 'checking' | 'connected' | 'failed'>('unconfigured');
  const [ghUsername, setGhUsername] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghToken, setGhToken] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [pushLog, setPushLog] = useState<string[]>([]);

  useEffect(() => {
    const loadGhConfig = async () => {
      const cfg = await getGitHubConfig();
      if (cfg) {
        setGhUsername(cfg.user);
        setGhRepo(cfg.repo);
        setGhBranch(cfg.branch);
        setGhToken(cfg.token);
        setGhStatus('checking');
        const connected = await testGitHubConnection(cfg);
        setGhStatus(connected ? 'connected' : 'failed');
      } else {
        setGhStatus('unconfigured');
      }
    };
    void loadGhConfig();
  }, []);

  useEffect(() => {
    if (!tempSecret) return;
    const timeoutMs = Math.max(0, tempSecret.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setTempSecret(null);
      setCopyMessage('Temporary password expired and was cleared.');
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [tempSecret]);

  const pendingUsers = users.filter((u: AppUser) => u.status === 'pending');
  const approvedUsers = users.filter((u: AppUser) => u.status === 'approved');

  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card">
        <h2 className="card-title">Admin Panel</h2>
        <div className="actions" style={{ marginBottom: '16px' }}>
          <button className={currentTab === 'queue' ? 'tabActive' : ''} onClick={() => setCurrentTab('queue')}>User Queue</button>
          <button className={currentTab === 'content' ? 'tabActive' : ''} onClick={() => setCurrentTab('content')}>Content</button>
        </div>

        {currentTab === 'queue' && (
          <div>
            <h3 style={{ marginTop: '20px', marginBottom: '12px', fontSize: '1rem', fontFamily: "'Playfair Display', serif", color: 'var(--navy)' }}>
              Approval Queue ({pendingUsers.length} pending)
            </h3>
            {pendingUsers.length === 0 && <p style={{ color: 'var(--muted)' }}>No pending users.</p>}
            {pendingUsers.map((user: AppUser) => (
              <div key={user.id} className="item">
                <p><strong>{user.firstName} {user.lastName}</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '8px' }}>{user.email}</p>
                <div className="actions">
                  <button className="bgold" onClick={() => { onSetUserStatus(user.id, 'approved'); onAudit('user_approved', `Approved ${user.email}`); onToast('User approved', 'success'); }}>Approve</button>
                  <button className="bred" onClick={() => { onSetUserStatus(user.id, 'rejected'); onAudit('user_rejected', `Rejected ${user.email}`); onToast('User rejected', 'info'); }}>Reject</button>
                </div>
              </div>
            ))}

            <h3 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '1rem', fontFamily: "'Playfair Display', serif", color: 'var(--navy)' }}>
              Approved Users ({approvedUsers.length})
            </h3>
            {approvedUsers.map((user: AppUser) => (
              <div key={user.id} className="item">
                <p><strong>{user.firstName} {user.lastName}</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '8px' }}>{user.email}</p>
                <div className="actions">
                  <button onClick={() => { void onResetPassword(user.id).then((pwd: string) => { setTempSecret({ email: user.email, value: pwd, expiresAt: Date.now() + 60000, revealed: false }); setCopyMessage('Temporary password generated.'); }); }}>Reset Password</button>
                  <button className="bred" onClick={() => { onSetUserStatus(user.id, 'suspended'); onAudit('user_suspended', `Suspended ${user.email}`); }}>Suspend</button>
                </div>
              </div>
            ))}

            {tempSecret && (
              <div className="message" style={{ marginTop: '16px', background: 'var(--gold-dim)', border: '1px solid #D4B46B', color: 'var(--navy)' }}>
                <p><strong>Temporary password for {tempSecret.email}</strong></p>
                <p className="mono" style={{ background: 'rgba(255,255,255,0.5)', padding: '8px', borderRadius: '4px', marginBottom: '8px', wordBreak: 'break-all' }}>
                  {tempSecret.revealed ? tempSecret.value : '••••••••••••••••'}
                </p>
                <small>Expires in 60 seconds.</small>
                <div className="actions" style={{ marginTop: '8px' }}>
                  <button type="button" onClick={() => setTempSecret((prev) => (prev ? { ...prev, revealed: !prev.revealed } : prev))}>
                    {tempSecret.revealed ? 'Hide' : 'Reveal'}
                  </button>
                  <button type="button" onClick={() => {
                    if (!tempSecret.revealed) {
                      setCopyMessage('Reveal password first.');
                      return;
                    }
                    navigator.clipboard?.writeText(tempSecret.value).then(() => setCopyMessage('Copied!')).catch(() => setCopyMessage('Copy failed.'));
                  }}>Copy</button>
                </div>
              </div>
            )}
            {copyMessage && <p className="message" style={{ marginTop: '8px' }}>{copyMessage}</p>}
          </div>
        )}

        {currentTab === 'content' && (
          <div>
            <div className="actions" style={{ marginTop: '16px', marginBottom: '16px' }}>
              <button className={editorMode === 'site' ? 'tabActive' : ''} onClick={() => setEditorMode('site')}>Site</button>
              <button className={editorMode === 'profile' ? 'tabActive' : ''} onClick={() => setEditorMode('profile')}>Profile</button>
              <button className={editorMode === 'updates' ? 'tabActive' : ''} onClick={() => setEditorMode('updates')}>Updates</button>
              <button className={editorMode === 'photos' ? 'tabActive' : ''} onClick={() => setEditorMode('photos')}>Photos</button>
              <button className={editorMode === 'map' ? 'tabActive' : ''} onClick={() => setEditorMode('map')}>Map</button>
              <button className={editorMode === 'json' ? 'tabActive' : ''} onClick={() => setEditorMode('json')}>JSON</button>
              <button className={editorMode === 'github' ? 'tabActive' : ''} onClick={() => setEditorMode('github')}>GitHub</button>
            </div>

            {editorMode === 'site' && (
              <div>
                <div className="fg">
                  <label>Site Title</label>
                  <input defaultValue={content.site.title} onChange={(e) => onUpdateContent({ ...content, site: { ...content.site, title: e.target.value } })} />
                </div>
                <div className="fg">
                  <label>Mission Name</label>
                  <input defaultValue={content.site.missionName} onChange={(e) => onUpdateContent({ ...content, site: { ...content.site, missionName: e.target.value } })} />
                </div>
                <button className="bn" onClick={() => { onAudit('site_updated', 'Updated site settings'); onToast('Site settings saved'); }}>Save</button>
              </div>
            )}

            {editorMode === 'profile' && (
              <div>
                <div className="fg">
                  <label>First Name</label>
                  <input defaultValue={content.profile.firstName} onChange={(e) => onUpdateContent({ ...content, profile: { ...content.profile, firstName: e.target.value } })} />
                </div>
                <div className="fg">
                  <label>Last Name</label>
                  <input defaultValue={content.profile.lastName} onChange={(e) => onUpdateContent({ ...content, profile: { ...content.profile, lastName: e.target.value } })} />
                </div>
                <div className="fg">
                  <label>Bio</label>
                  <textarea defaultValue={content.profile.bio} onChange={(e) => onUpdateContent({ ...content, profile: { ...content.profile, bio: e.target.value } })} />
                </div>
                <div className="fg">
                  <label>Testimony</label>
                  <textarea defaultValue={content.profile.testimony} onChange={(e) => onUpdateContent({ ...content, profile: { ...content.profile, testimony: e.target.value } })} />
                </div>
                <button className="bn" onClick={() => { onAudit('profile_updated', 'Updated profile'); onToast('Profile saved'); }}>Save</button>
              </div>
            )}

            {editorMode === 'json' && (
              <div>
                <textarea value={jsonEditor} onChange={(e) => setJsonEditor(e.target.value)} rows={16} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                <button className="bn" onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonEditor) as MissionContent;
                    onUpdateContent(parsed);
                    onToast('JSON saved successfully');
                    onAudit('json_updated', 'Updated full JSON');
                  } catch (err) {
                    onToast('Invalid JSON', 'info');
                  }
                }}>Save JSON</button>
              </div>
            )}

            {editorMode === 'github' && (
              <div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #1A2744, #243256)', color: 'white', marginBottom: '20px', padding: '20px', borderRadius: '14px' }}>
                  <h3 style={{ color: '#F0D898', marginBottom: '12px', fontFamily: "'Playfair Display', serif" }}>GitHub Configuration</h3>
                  <p style={{ fontSize: '0.9rem', marginBottom: '16px', color: 'rgba(255,255,255,0.85)' }}>
                    Connect to GitHub to publish your mission data. Your token is stored only in your browser.
                  </p>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: ghStatus === 'connected' ? '#2a7a4a' : ghStatus === 'failed' ? '#c0392b' : '#9ca3af' }} />
                      <span style={{ fontSize: '0.9rem' }}>
                        {ghStatus === 'unconfigured' && 'Not configured'}
                        {ghStatus === 'checking' && 'Checking connection...'}
                        {ghStatus === 'connected' && '✓ Connected'}
                        {ghStatus === 'failed' && '✗ Connection failed'}
                      </span>
                    </div>
                  </div>

                  <div className="fg" style={{ marginBottom: '12px' }}>
                    <label style={{ color: '#F0D898' }}>GitHub Username</label>
                    <input value={ghUsername} onChange={(e) => setGhUsername(e.target.value)} placeholder="your-username" style={{ color: '#1A2744' }} />
                  </div>

                  <div className="fg" style={{ marginBottom: '12px' }}>
                    <label style={{ color: '#F0D898' }}>Repository Name</label>
                    <input value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} placeholder="my-mission-site" style={{ color: '#1A2744' }} />
                  </div>

                  <div className="fg" style={{ marginBottom: '12px' }}>
                    <label style={{ color: '#F0D898' }}>Branch</label>
                    <input value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} placeholder="main" style={{ color: '#1A2744' }} />
                  </div>

                  <div className="fg" style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#F0D898' }}>Personal Access Token (PAT)</label>
                    <input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="ghp_..." style={{ color: '#1A2744' }} />
                    <small style={{ color: 'rgba(255,255,255,0.7)' }}>Get one at github.com → Settings → Developer Settings → Personal access tokens</small>
                  </div>

                  <div className="actions">
                    <button className="bgold" onClick={async () => {
                      const cfg = { user: ghUsername, repo: ghRepo, branch: ghBranch, token: ghToken };
                      setGhStatus('checking');
                      const connected = await testGitHubConnection(cfg);
                      if (connected) {
                        await saveGitHubConfig(cfg);
                        setGhStatus('connected');
                        onToast('GitHub connected!');
                        onAudit('github_configured', `Connected to ${ghUsername}/${ghRepo}`);
                      } else {
                        setGhStatus('failed');
                        onToast('Connection failed - check your credentials', 'info');
                      }
                    }}>Test & Save</button>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: '16px', fontFamily: "'Playfair Display', serif", fontSize: '1rem' }}>Push to GitHub</h3>

                  {pushLog.length > 0 && (
                    <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: '200px', overflowY: 'auto', color: '#2d3e5f' }}>
                      {pushLog.map((log, idx) => (
                        <div key={idx}>{log}</div>
                      ))}
                    </div>
                  )}

                  <div className="fg" style={{ marginBottom: '16px' }}>
                    <label>Commit Message</label>
                    <input
                      type="text"
                      defaultValue={`Update mission data — ${new Date().toLocaleDateString()}`}
                      id="commitMessage"
                      placeholder="Update mission data"
                    />
                  </div>

                  <button
                    className="bn bgold"
                    disabled={isPushing || ghStatus !== 'connected'}
                    onClick={async () => {
                      setIsPushing(true);
                      setPushLog([]);
                      const msg = (document.getElementById('commitMessage') as HTMLInputElement)?.value || 'Update mission data';

                      const result = await pushDataToGitHub(
                        { user: ghUsername, repo: ghRepo, branch: ghBranch, token: ghToken },
                        content,
                        msg,
                        (log) => setPushLog((prev) => [...prev, log])
                      );

                      if (result.success) {
                        onAudit('github_pushed', `Pushed data.json (${result.sha?.slice(0, 7)})`);
                        onToast('Data pushed to GitHub!');
                      } else {
                        onToast(`Push failed: ${result.error}`, 'info');
                      }

                      setIsPushing(false);
                    }}
                  >
                    {isPushing ? 'Publishing...' : 'Push to GitHub'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
