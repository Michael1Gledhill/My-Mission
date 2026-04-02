import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
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
import { HomePage } from './pages/HomePage';
import { UpdatesPage } from './pages/UpdatesPage';
import { PhotosPage } from './pages/PhotosPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';

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

function LoginForm({ onLogin, onSwitchToRegister }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isCapsOn = (e: React.KeyboardEvent) => e.getModifierState('CapsLock');

  const [capsWarning, setCapsWarning] = useState(false);

  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card narrow">
        <h2 className="card-title">Sign In</h2>
        <form onSubmit={(e) => { e.preventDefault(); void onLogin(email, password); }}>
          <div className="fg">
            <label>Email</label>
            <input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="fg">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => setCapsWarning(isCapsOn(e))}
                onKeyUp={(e) => setCapsWarning(isCapsOn(e))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  fontSize: '1rem'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {capsWarning && <small style={{ color: 'var(--red)' }}>⚠️ Caps Lock is on</small>}
          </div>
          <div className="actions">
            <button type="submit" className="bn bfull">Sign In</button>
          </div>
          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem' }}>
            Don't have an account? <button type="button" onClick={onSwitchToRegister} className="link-btn">Register</button>
          </p>
        </form>
      </div>
    </main>
  );
}

function RegisterForm({ onRegister, onSwitchToLogin }: any) {
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const strength = evaluatePasswordStrength(formData.password);

  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card narrow">
        <h2 className="card-title">Create Account</h2>
        <form onSubmit={(e) => { e.preventDefault(); void onRegister(formData); }}>
          <div className="fg">
            <label>First Name</label>
            <input required type="text" placeholder="First name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
          </div>
          <div className="fg">
            <label>Last Name</label>
            <input required type="text" placeholder="Last name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
          </div>
          <div className="fg">
            <label>Email</label>
            <input required type="email" placeholder="you@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <div className="fg">
            <label>Password</label>
            <input required minLength={10} type="password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
          </div>
          <div className="fg">
            <label>Confirm Password</label>
            <input required minLength={10} type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} />
          </div>
          <div className="strengthWrap">
            <div className="strengthBar">
              <div className={`strengthFill strength-${Math.max(1, strength.score)}`} />
            </div>
            <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}>Password strength: <strong>{strength.label}</strong></p>
            <small>{strength.feedback}</small>
          </div>
          <div className="actions">
            <button type="submit" className="bn bfull" disabled={formData.password.length < 10 || strength.score < 3}>Create Account</button>
          </div>
          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem' }}>
            Already have an account? <button type="button" onClick={onSwitchToLogin} className="link-btn">Sign In</button>
          </p>
        </form>
      </div>
    </main>
  );
}

function ChangePasswordForm({ onSubmit }: any) {
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
        <form onSubmit={(e) => { e.preventDefault(); void onSubmit({ currentPassword, newPassword, confirmPassword }); }}>
          <div className="fg">
            <label>Current Password</label>
            <input required type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="fg">
            <label>New Password</label>
            <input required minLength={10} type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="fg">
            <label>Confirm New Password</label>
            <input required minLength={10} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <div className="strengthWrap">
            <div className="strengthBar">
              <div className={`strengthFill strength-${Math.max(1, strength.score)}`} />
            </div>
            <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}>Password strength: <strong>{strength.label}</strong></p>
            <small>{strength.feedback}</small>
          </div>
          <div className="actions">
            <button type="submit" className="bn bfull" disabled={!canSubmit || !matches}>Update Password</button>
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
                  <label>Subtitle</label>
                  <input defaultValue={content.site.subtitle} onChange={(e) => onUpdateContent({ ...content, site: { ...content.site, subtitle: e.target.value } })} />
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

            {editorMode === 'updates' && (
              <div>
                <h3>Updates</h3>
                {content.updates.map((update: any, idx: number) => (
                  <div key={update.id} style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
                    <div className="fg">
                      <label>Title</label>
                      <input defaultValue={update.title} onChange={(e) => {
                        const updated = [...content.updates];
                        updated[idx].title = e.target.value;
                        onUpdateContent({ ...content, updates: updated });
                      }} />
                    </div>
                    <div className="fg">
                      <label>Date</label>
                      <input defaultValue={update.date} type="date" onChange={(e) => {
                        const updated = [...content.updates];
                        updated[idx].date = e.target.value;
                        onUpdateContent({ ...content, updates: updated });
                      }} />
                    </div>
                    <div className="fg">
                      <label>Body</label>
                      <textarea defaultValue={update.body} onChange={(e) => {
                        const updated = [...content.updates];
                        updated[idx].body = e.target.value;
                        onUpdateContent({ ...content, updates: updated });
                      }} />
                    </div>
                    <div className="fg">
                      <label>Visibility</label>
                      <select defaultValue={update.visibility} onChange={(e) => {
                        const updated = [...content.updates];
                        updated[idx].visibility = e.target.value as 'public' | 'approved';
                        onUpdateContent({ ...content, updates: updated });
                      }}>
                        <option value="public">Public</option>
                        <option value="approved">Approved Only</option>
                      </select>
                    </div>
                  </div>
                ))}
                <button className="bn" onClick={() => {
                  const newUpdate = {
                    id: `u-${Date.now()}`,
                    title: 'New Update',
                    date: new Date().toISOString().split('T')[0],
                    body: 'Write your update here...',
                    visibility: 'public' as const
                  };
                  onUpdateContent({ ...content, updates: [...content.updates, newUpdate] });
                }}>Add Update</button>
              </div>
            )}

            {editorMode === 'photos' && (
              <div>
                <h3>Photos</h3>
                {content.photos.map((photo: any, idx: number) => (
                  <div key={photo.id} style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
                    <div className="fg">
                      <label>Title</label>
                      <input defaultValue={photo.title} onChange={(e) => {
                        const updated = [...content.photos];
                        updated[idx].title = e.target.value;
                        onUpdateContent({ ...content, photos: updated });
                      }} />
                    </div>
                    <div className="fg">
                      <label>URL (or emoji)</label>
                      <input defaultValue={photo.url} onChange={(e) => {
                        const updated = [...content.photos];
                        updated[idx].url = e.target.value;
                        onUpdateContent({ ...content, photos: updated });
                      }} />
                    </div>
                    <div className="fg">
                      <label>Visibility</label>
                      <select defaultValue={photo.visibility} onChange={(e) => {
                        const updated = [...content.photos];
                        updated[idx].visibility = e.target.value as 'public' | 'approved';
                        onUpdateContent({ ...content, photos: updated });
                      }}>
                        <option value="public">Public</option>
                        <option value="approved">Approved Only</option>
                      </select>
                    </div>
                    <button className="bred" onClick={() => onUpdateContent({ ...content, photos: content.photos.filter((_: any, i: number) => i !== idx) })}>Delete</button>
                  </div>
                ))}
                <button className="bn" onClick={() => {
                  const newPhoto = {
                    id: `p-${Date.now()}`,
                    title: 'New Photo',
                    url: '📸',
                    visibility: 'public' as const
                  };
                  onUpdateContent({ ...content, photos: [...content.photos, newPhoto] });
                }}>Add Photo</button>
              </div>
            )}

            {editorMode === 'map' && (
              <div>
                <div className="fg">
                  <label>Current Area</label>
                  <input defaultValue={content.map.currentArea} onChange={(e) => onUpdateContent({ ...content, map: { ...content.map, currentArea: e.target.value } })} />
                </div>
                <button className="bn" onClick={() => { onAudit('map_updated', 'Updated map'); onToast('Map settings saved'); }}>Save</button>
              </div>
            )}

            {editorMode === 'json' && (
              <div>
                <textarea
                  value={jsonEditor}
                  onChange={(e) => setJsonEditor(e.target.value)}
                  style={{ width: '100%', height: '400px', fontFamily: 'monospace', fontSize: '12px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <button className="bn" onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonEditor) as MissionContent;
                    onUpdateContent(parsed);
                    onToast('JSON imported successfully');
                  } catch (e) {
                    onToast(`JSON parse error: ${(e as Error).message}`, 'info');
                  }
                }}>Import JSON</button>
              </div>
            )}

            {editorMode === 'github' && (
              <div>
                <div className="fg">
                  <label>GitHub Username</label>
                  <input value={ghUsername} onChange={(e) => setGhUsername(e.target.value)} />
                </div>
                <div className="fg">
                  <label>Repository</label>
                  <input value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} />
                </div>
                <div className="fg">
                  <label>Branch</label>
                  <input value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} />
                </div>
                <div className="fg">
                  <label>Personal Access Token</label>
                  <input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="ghp_..." />
                  <small style={{ color: 'var(--muted)' }}>Token is stored locally only, never transmitted except to GitHub.</small>
                </div>

                <button className="bn bgold" onClick={async () => {
                  await saveGitHubConfig({ user: ghUsername, repo: ghRepo, branch: ghBranch, token: ghToken });
                  setGhStatus('checking');
                  const connected = await testGitHubConnection({ user: ghUsername, repo: ghRepo, branch: ghBranch, token: ghToken });
                  setGhStatus(connected ? 'connected' : 'failed');
                }}>Test Connection</button>

                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: ghStatus === 'connected' ? '#d4edda' : ghStatus === 'failed' ? '#f8d7da' : '#e2e3e5', borderRadius: '4px', color: ghStatus === 'connected' ? '#155724' : ghStatus === 'failed' ? '#721c24' : '#383d41' }}>
                  {ghStatus === 'connected' && '✓ Connected to GitHub'}
                  {ghStatus === 'failed' && '✗ Connection failed'}
                  {ghStatus === 'unconfigured' && '⚙️ Configure and test'}
                  {ghStatus === 'checking' && '⏳ Checking...'}
                </div>

                <div style={{ marginTop: '24px' }}>
                  <label>Commit Message</label>
                  <input
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

                {pushLog.length > 0 && (
                  <div style={{ marginTop: '16px', backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px' }}>
                    {pushLog.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export function App() {
  const navigate = useNavigate();
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
          // fallback
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
    navigate('/');
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
    navigate('/');
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



  return (
    <div className="page">
      <a className="skipLink" href="#main-content">Skip to main content</a>

      {mode === 'login' && <div style={{ position: 'absolute', top: '0', right: '0', width: '0', height: '0', visibility: 'hidden', pointerEvents: 'none' }}>{bootstrapAdmin && <div style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(bootstrapAdmin)}</div>}</div>}

      <header className="topbar">
        <div>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>{content.site.title}</h1>
          </Link>
          <p>{content.site.subtitle}</p>
        </div>

        <nav className="nav" aria-label="Primary">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/updates" className="nav-link">Updates</Link>
          <Link to="/photos" className="nav-link">Photos</Link>
          <Link to="/about" className="nav-link">About</Link>
          <Link to="/contact" className="nav-link">Contact</Link>

          {mode === 'login' && <button onClick={() => setMode('register')}>Register</button>}
          {mode === 'register' && <button onClick={() => setMode('login')}>Sign In</button>}
          {sessionEmail && <button onClick={() => setMode('changePassword')}>Change Password</button>}
          {isAdmin && <button onClick={() => setMode('admin')}>Admin</button>}
          {sessionEmail && <button onClick={() => { logout(); navigate('/'); }}>Logout</button>}
          {!sessionEmail && (
            <>
              <button onClick={() => setMode('register')}>Register</button>
              <button onClick={() => setMode('login')}>Sign In</button>
            </>
          )}
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

      {mode === 'login' && (
        <>
          <LoginForm onLogin={login} onSwitchToRegister={() => setMode('register')} message={message} />
          {bootstrapAdmin && (
            <div className="wrap" style={{ marginTop: '32px' }}>
              <div className="card" style={{ backgroundColor: '#e8f4f8', borderLeft: '4px solid var(--gold)' }}>
                <h3 style={{ marginBottom: '12px', color: 'var(--navy)' }}>🔑 First-Run Admin Account</h3>
                <p style={{ marginBottom: '8px' }}>Email: <strong>{bootstrapAdmin.email}</strong></p>
                <p style={{ marginBottom: '0' }}>Password: <strong>{bootstrapAdmin.password}</strong></p>
                <small style={{ color: 'var(--muted)', display: 'block', marginTop: '8px' }}>Save these credentials. You'll need them to access the admin panel.</small>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'register' && <RegisterForm onRegister={register} onSwitchToLogin={() => setMode('login')} message={message} />}

      {mode === 'changePassword' && <ChangePasswordForm onSubmit={changePassword} />}

      {mode === 'admin' && (
        <AdminPanel
          users={users}
          content={content}
          onUpdateContent={setContent}
          onSetUserStatus={approveUser}
          onResetPassword={resetUserPassword}
          onAudit={appendAudit}
          onToast={pushToast}
        />
      )}

      {mode === 'home' && (
        <Routes>
          <Route path="/" element={<HomePage content={content} sessionEmail={sessionEmail} canViewMissionInfo={canViewMissionInfo} />} />
          <Route path="/updates" element={<UpdatesPage content={content} />} />
          <Route path="/photos" element={<PhotosPage content={content} />} />
          <Route path="/about" element={<AboutPage content={content} />} />
          <Route path="/contact" element={<ContactPage content={content} />} />
        </Routes>
      )}
    </div>
  );
}
