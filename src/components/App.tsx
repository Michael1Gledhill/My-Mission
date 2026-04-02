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
import { MapEditor } from './map/MapEditor';

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
    requireApproval: true,
    showProgressBar: true,
    showMap: true,
    allowMessages: true,
    allowSubscriptions: true,
    photoGalleryVisible: true
  },
  scripture: {
    text: 'And the Spirit shall be given unto you by the prayer of faith.',
    reference: 'Doctrine & Covenants 42:14'
  },
  timeline: [
    { id: 1, date: 'January 2024', event: 'Entered the MTC in Provo, Utah', status: 'done' },
    { id: 2, date: 'March 2024', event: 'Arrived in Idaho — First area: Rexburg', status: 'done' },
    { id: 3, date: 'January 2025', event: 'Transferred to Idaho Falls West', status: 'current' },
    { id: 4, date: 'January 2026', event: 'Return Home — Mission Complete!', status: 'future' }
  ],
  messages: [],
  subscribers: [],
  stats: {
    monthsServed: 14,
    monthsTotal: 24,
    overallProgress: 58,
    areaProgress: 50,
    weeklyGoalDiscussions: 8,
    weeklyGoalTarget: 12,
    areasServed: 3
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
  type PanelMode =
    | 'dashboard'
    | 'profile'
    | 'progress'
    | 'map'
    | 'updates'
    | 'photos'
    | 'scripture'
    | 'timeline'
    | 'github'
    | 'settings'
    | 'messages'
    | 'subscribers';

  const [panel, setPanel] = useState<PanelMode>('dashboard');
  const [tempSecret, setTempSecret] = useState<{ email: string; value: string; expiresAt: number; revealed: boolean } | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [jsonEditor, setJsonEditor] = useState(JSON.stringify(content, null, 2));
  const [boundaryInput, setBoundaryInput] = useState(JSON.stringify(content.map.boundary, null, 2));
  const [ghStatus, setGhStatus] = useState<'unconfigured' | 'checking' | 'connected' | 'failed'>('unconfigured');
  const [ghUsername, setGhUsername] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghToken, setGhToken] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [pushLog, setPushLog] = useState<string[]>([]);
  const [adminPassword, setAdminPassword] = useState(localStorage.getItem('mission_pw') || 'mission2024');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pendingUpload, setPendingUpload] = useState<Array<{ title: string; album: string; date: string; imageData: string; fileName: string }>>([]);
  const [albumChoice, setAlbumChoice] = useState('March 2025');
  const [newAlbum, setNewAlbum] = useState('');

  const contentSafe: MissionContent = {
    ...content,
    scripture: content.scripture ?? { text: '', reference: '' },
    timeline: content.timeline ?? [],
    messages: content.messages ?? [],
    subscribers: content.subscribers ?? [],
    stats: content.stats ?? {
      monthsServed: 14,
      monthsTotal: 24,
      overallProgress: 58,
      areaProgress: 50,
      weeklyGoalDiscussions: 8,
      weeklyGoalTarget: 12,
      areasServed: 3
    },
    settings: {
      ...content.settings,
      showProgressBar: content.settings.showProgressBar ?? true,
      showMap: content.settings.showMap ?? true,
      allowMessages: content.settings.allowMessages ?? true,
      allowSubscriptions: content.settings.allowSubscriptions ?? true,
      photoGalleryVisible: content.settings.photoGalleryVisible ?? true
    }
  };

  const patch = (next: MissionContent) => {
    onUpdateContent(next);
    setJsonEditor(JSON.stringify(next, null, 2));
  };

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

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          let w = img.width;
          let h = img.height;
          if (w > MAX) {
            h = Math.round((h * MAX) / w);
            w = MAX;
          }
          if (h > MAX) {
            w = Math.round((w * MAX) / h);
            h = MAX;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Could not read image'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const nextAlbum = albumChoice === '__new__' ? newAlbum.trim() || 'New Album' : albumChoice;
    const queued: Array<{ title: string; album: string; date: string; imageData: string; fileName: string }> = [];
    for (const file of files) {
      if (file.size > 3 * 1024 * 1024) {
        onToast(`Warning: ${file.name} is > 3MB before compression.`, 'info');
      }
      try {
        const imageData = await compressImage(file);
        queued.push({
          title: file.name.replace(/\.[^.]+$/, ''),
          album: nextAlbum,
          date: nextAlbum,
          imageData,
          fileName: file.name
        });
      } catch {
        onToast(`Could not process ${file.name}`, 'info');
      }
    }
    setPendingUpload((prev) => [...prev, ...queued]);
  };

  const pendingUsers = users.filter((u: AppUser) => u.status === 'pending');
  const approvedUsers = users.filter((u: AppUser) => u.status === 'approved');
  const albums = Array.from(new Set(contentSafe.photos.map((p) => p.album).filter(Boolean) as string[]));

  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card">
        <h2 className="card-title">Admin Panel</h2>

        <div className="actions" style={{ marginBottom: '16px' }}>
          {[
            ['dashboard', 'Dashboard'],
            ['profile', 'Profile & Info'],
            ['progress', 'Mission Progress'],
            ['map', 'Mission Map'],
            ['updates', 'Weekly Updates'],
            ['photos', 'Photos'],
            ['scripture', 'Scripture'],
            ['timeline', 'Timeline'],
            ['github', 'GitHub / Publish'],
            ['settings', 'Settings'],
            ['messages', 'Messages'],
            ['subscribers', 'Subscribers']
          ].map(([key, label]) => (
            <button key={key} className={panel === key ? 'tabActive' : ''} onClick={() => setPanel(key as PanelMode)}>{label}</button>
          ))}
        </div>

        {panel === 'dashboard' && (
          <div>
            <div className="stats">
              <article className="item statCard"><strong>{contentSafe.updates.length}</strong><small>Updates</small></article>
              <article className="item statCard"><strong>{contentSafe.stats?.overallProgress ?? 0}%</strong><small>Mission Progress</small></article>
              <article className="item statCard"><strong>{contentSafe.subscribers?.length ?? 0}</strong><small>Subscribers</small></article>
              <article className="item statCard"><strong>{contentSafe.photos.length}</strong><small>Photos</small></article>
            </div>

            <h3 style={{ marginBottom: '10px' }}>Approval Queue ({pendingUsers.length})</h3>
            {pendingUsers.length === 0 && <p style={{ color: 'var(--muted)' }}>No pending users.</p>}
            {pendingUsers.map((user: AppUser) => (
              <div key={user.id} className="item">
                <p><strong>{user.firstName} {user.lastName}</strong> — {user.email}</p>
                <div className="actions">
                  <button className="bgold" onClick={() => { onSetUserStatus(user.id, 'approved'); onAudit('user_approved', `Approved ${user.email}`); onToast('User approved'); }}>Approve</button>
                  <button className="bred" onClick={() => { onSetUserStatus(user.id, 'rejected'); onAudit('user_rejected', `Rejected ${user.email}`); onToast('User rejected', 'info'); }}>Reject</button>
                </div>
              </div>
            ))}

            <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>Approved Users ({approvedUsers.length})</h3>
            {approvedUsers.map((user: AppUser) => (
              <div key={user.id} className="item">
                <p><strong>{user.firstName} {user.lastName}</strong> — {user.email}</p>
                <div className="actions">
                  <button onClick={() => { void onResetPassword(user.id).then((pwd: string) => { setTempSecret({ email: user.email, value: pwd, expiresAt: Date.now() + 60000, revealed: false }); setCopyMessage('Temporary password generated.'); }); }}>Reset Password</button>
                  <button className="bred" onClick={() => onSetUserStatus(user.id, 'suspended')}>Suspend</button>
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

        {panel === 'profile' && (
          <div>
            <div className="fr">
              <div className="fg"><label>First Name</label><input value={contentSafe.profile.firstName} onChange={(e) => patch({ ...contentSafe, profile: { ...contentSafe.profile, firstName: e.target.value } })} /></div>
              <div className="fg"><label>Last Name</label><input value={contentSafe.profile.lastName} onChange={(e) => patch({ ...contentSafe, profile: { ...contentSafe.profile, lastName: e.target.value } })} /></div>
            </div>
            <div className="fg"><label>Mission Name</label><input value={contentSafe.site.missionName} onChange={(e) => patch({ ...contentSafe, site: { ...contentSafe.site, missionName: e.target.value } })} /></div>
            <div className="fg"><label>Current Area</label><input value={contentSafe.map.currentArea} onChange={(e) => patch({ ...contentSafe, map: { ...contentSafe.map, currentArea: e.target.value } })} /></div>
            <div className="fg"><label>Bio</label><textarea value={contentSafe.profile.bio} onChange={(e) => patch({ ...contentSafe, profile: { ...contentSafe.profile, bio: e.target.value } })} /></div>
            <div className="fg"><label>Testimony</label><textarea value={contentSafe.profile.testimony} onChange={(e) => patch({ ...contentSafe, profile: { ...contentSafe.profile, testimony: e.target.value } })} /></div>
          </div>
        )}

        {panel === 'progress' && (
          <div>
            <div className="fr3">
              <div className="fg"><label>Months Served</label><input type="number" value={contentSafe.stats?.monthsServed ?? 0} onChange={(e) => patch({ ...contentSafe, stats: { ...contentSafe.stats!, monthsServed: Number(e.target.value) } })} /></div>
              <div className="fg"><label>Total Months</label><input type="number" value={contentSafe.stats?.monthsTotal ?? 0} onChange={(e) => patch({ ...contentSafe, stats: { ...contentSafe.stats!, monthsTotal: Number(e.target.value) } })} /></div>
              <div className="fg"><label>Areas Served</label><input type="number" value={contentSafe.stats?.areasServed ?? 0} onChange={(e) => patch({ ...contentSafe, stats: { ...contentSafe.stats!, areasServed: Number(e.target.value) } })} /></div>
            </div>

            <div className="fg"><label>Overall Mission Progress ({contentSafe.stats?.overallProgress ?? 0}%)</label><input type="range" min={0} max={100} value={contentSafe.stats?.overallProgress ?? 0} onChange={(e) => patch({ ...contentSafe, stats: { ...contentSafe.stats!, overallProgress: Number(e.target.value) } })} /></div>
            <div className="fg"><label>Current Area Progress ({contentSafe.stats?.areaProgress ?? 0}%)</label><input type="range" min={0} max={100} value={contentSafe.stats?.areaProgress ?? 0} onChange={(e) => patch({ ...contentSafe, stats: { ...contentSafe.stats!, areaProgress: Number(e.target.value) } })} /></div>
            <div className="fg"><label>Weekly Goal ({contentSafe.stats?.weeklyGoalDiscussions ?? 0}/{contentSafe.stats?.weeklyGoalTarget ?? 12})</label><input type="range" min={0} max={12} value={contentSafe.stats?.weeklyGoalDiscussions ?? 0} onChange={(e) => patch({ ...contentSafe, stats: { ...contentSafe.stats!, weeklyGoalDiscussions: Number(e.target.value) } })} /></div>
          </div>
        )}

        {panel === 'map' && (
          <div>
            <div className="fg"><label>Current Area</label><input value={contentSafe.map.currentArea} onChange={(e) => patch({ ...contentSafe, map: { ...contentSafe.map, currentArea: e.target.value } })} /></div>
            <MapEditor
              boundary={contentSafe.map.boundary}
              currentArea={contentSafe.map.currentArea}
              onBoundaryChange={(nextBoundary) => patch({ ...contentSafe, map: { ...contentSafe.map, boundary: nextBoundary } })}
              onCurrentAreaChange={(nextArea) => patch({ ...contentSafe, map: { ...contentSafe.map, currentArea: nextArea } })}
            />
            <div className="fg" style={{ marginTop: '12px' }}><label>Mission Boundary JSON [[lat,lng],...]</label><textarea value={boundaryInput} onChange={(e) => setBoundaryInput(e.target.value)} /></div>
            <div className="actions">
              <button className="bn" onClick={() => {
                try {
                  const parsed = JSON.parse(boundaryInput);
                  if (!Array.isArray(parsed)) throw new Error('Boundary must be an array');
                  patch({ ...contentSafe, map: { ...contentSafe.map, boundary: parsed } });
                  onToast('Mission boundary imported');
                } catch (e) {
                  onToast(`Boundary import failed: ${(e as Error).message}`, 'info');
                }
              }}>Import Boundary</button>
              <button className="bred" onClick={() => { setBoundaryInput('[]'); patch({ ...contentSafe, map: { ...contentSafe.map, boundary: [] } }); }}>Clear Boundary</button>
            </div>
          </div>
        )}

        {panel === 'updates' && (
          <div>
            <button className="bn" onClick={() => {
              const newUpdate = {
                id: `u-${Date.now()}`,
                week: contentSafe.updates.length + 1,
                title: 'New Weekly Update',
                date: new Date().toISOString().split('T')[0],
                location: contentSafe.map.currentArea,
                body: 'Dear family and friends,\n\nThis week was full of meaningful experiences.\n\nLove, Elder Gledhill',
                scripture: contentSafe.scripture?.text,
                scriptureRef: contentSafe.scripture?.reference,
                tags: ['Teaching'],
                visibility: 'public' as const
              };
              patch({ ...contentSafe, updates: [newUpdate, ...contentSafe.updates] });
            }}>Publish Update</button>

            {contentSafe.updates.map((update, idx) => (
              <div key={update.id} className="item" style={{ marginTop: '12px' }}>
                <div className="fg"><label>Title</label><input value={update.title} onChange={(e) => {
                  const next = [...contentSafe.updates];
                  next[idx] = { ...next[idx], title: e.target.value };
                  patch({ ...contentSafe, updates: next });
                }} /></div>
                <div className="fr">
                  <div className="fg"><label>Date</label><input type="date" value={update.date} onChange={(e) => {
                    const next = [...contentSafe.updates];
                    next[idx] = { ...next[idx], date: e.target.value };
                    patch({ ...contentSafe, updates: next });
                  }} /></div>
                  <div className="fg"><label>Visibility</label><select value={update.visibility} onChange={(e) => {
                    const next = [...contentSafe.updates];
                    next[idx] = { ...next[idx], visibility: e.target.value as 'public' | 'approved' };
                    patch({ ...contentSafe, updates: next });
                  }}><option value="public">Public</option><option value="approved">Approved</option></select></div>
                </div>
                <div className="fg"><label>Body</label><textarea value={update.body} onChange={(e) => {
                  const next = [...contentSafe.updates];
                  next[idx] = { ...next[idx], body: e.target.value };
                  patch({ ...contentSafe, updates: next });
                }} /></div>
                <button className="bred" onClick={() => patch({ ...contentSafe, updates: contentSafe.updates.filter((_, i) => i !== idx) })}>Delete</button>
              </div>
            ))}
          </div>
        )}

        {panel === 'photos' && (
          <div>
            <div className="item" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void handlePhotoFiles(e.dataTransfer.files); }}>
              <p style={{ marginBottom: '8px' }}><strong>Upload Photos</strong> (drag & drop or choose files)</p>
              <div className="fr">
                <div className="fg">
                  <label>Album</label>
                  <select value={albumChoice} onChange={(e) => setAlbumChoice(e.target.value)}>
                    {albums.map((album) => <option key={album} value={album}>{album}</option>)}
                    <option value="March 2025">March 2025</option>
                    <option value="Early 2025">Early 2025</option>
                    <option value="2024">2024</option>
                    <option value="__new__">New Album…</option>
                  </select>
                </div>
                {albumChoice === '__new__' && (
                  <div className="fg">
                    <label>New Album Name</label>
                    <input value={newAlbum} onChange={(e) => setNewAlbum(e.target.value)} placeholder="April 2026" />
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) void handlePhotoFiles(e.target.files); }} />
            </div>

            {pendingUpload.length > 0 && (
              <div className="item" style={{ marginTop: '12px' }}>
                <p><strong>Pending Upload ({pendingUpload.length})</strong></p>
                <div className="photoGrid" style={{ marginTop: '12px' }}>
                  {pendingUpload.map((photo, i) => (
                    <article key={`${photo.fileName}-${i}`} className="photoCard">
                      <img src={photo.imageData} alt={photo.title} />
                    </article>
                  ))}
                </div>
                <div className="actions">
                  <button className="bgold" onClick={() => {
                    const mapped = pendingUpload.map((p, idx) => ({
                      id: `p-${Date.now()}-${idx}`,
                      title: p.title,
                      url: p.imageData,
                      imageData: p.imageData,
                      album: p.album,
                      date: p.date,
                      desc: '',
                      emoji: '📸',
                      bg: 'linear-gradient(135deg,#b8d4f0,#7aaad8)',
                      span: '',
                      visibility: 'public' as const
                    }));
                    patch({ ...contentSafe, photos: [...mapped, ...contentSafe.photos].slice(0, 50) });
                    setPendingUpload([]);
                    onToast('Photos added to gallery');
                  }}>Add These Photos to Gallery</button>
                  <button className="bred" onClick={() => setPendingUpload([])}>Clear Pending</button>
                </div>
              </div>
            )}

            <div className="photoGrid" style={{ marginTop: '12px' }}>
              {contentSafe.photos.map((photo, idx) => (
                <div key={photo.id} className="photoCard" title={photo.title}>
                  {photo.imageData || photo.url.startsWith('data:image') || photo.url.startsWith('http')
                    ? <img src={photo.imageData || photo.url} alt={photo.title} />
                    : <div style={{ width: '100%', height: '100%', background: photo.bg || '#ddd', display: 'grid', placeItems: 'center', fontSize: '2rem' }}>{photo.emoji || photo.url || '📸'}</div>}
                  <div className="actions" style={{ position: 'absolute', right: '6px', top: '6px' }}>
                    <button aria-label="Delete photo" className="bred" onClick={() => patch({ ...contentSafe, photos: contentSafe.photos.filter((_, i) => i !== idx) })}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {panel === 'scripture' && (
          <div>
            <div className="fg"><label>Scripture Text</label><textarea value={contentSafe.scripture?.text ?? ''} onChange={(e) => patch({ ...contentSafe, scripture: { ...(contentSafe.scripture ?? { text: '', reference: '' }), text: e.target.value } })} /></div>
            <div className="fg"><label>Reference</label><input value={contentSafe.scripture?.reference ?? ''} onChange={(e) => patch({ ...contentSafe, scripture: { ...(contentSafe.scripture ?? { text: '', reference: '' }), reference: e.target.value } })} /></div>
          </div>
        )}

        {panel === 'timeline' && (
          <div>
            <button className="bn" onClick={() => {
              const next = [...(contentSafe.timeline ?? []), { id: Date.now(), date: 'New Date', event: 'New milestone', status: 'future' as const }];
              patch({ ...contentSafe, timeline: next });
            }}>+ Add Milestone</button>

            {(contentSafe.timeline ?? []).map((item, idx) => (
              <div key={item.id} className="item" style={{ marginTop: '10px' }}>
                <div className="fr">
                  <div className="fg"><label>Date</label><input value={item.date} onChange={(e) => {
                    const next = [...(contentSafe.timeline ?? [])];
                    next[idx] = { ...next[idx], date: e.target.value };
                    patch({ ...contentSafe, timeline: next });
                  }} /></div>
                  <div className="fg"><label>Status</label><select value={item.status} onChange={(e) => {
                    const next = [...(contentSafe.timeline ?? [])];
                    next[idx] = { ...next[idx], status: e.target.value as 'done' | 'current' | 'future' };
                    patch({ ...contentSafe, timeline: next });
                  }}><option value="done">Done</option><option value="current">Current</option><option value="future">Future</option></select></div>
                </div>
                <div className="fg"><label>Event</label><input value={item.event} onChange={(e) => {
                  const next = [...(contentSafe.timeline ?? [])];
                  next[idx] = { ...next[idx], event: e.target.value };
                  patch({ ...contentSafe, timeline: next });
                }} /></div>
                <button className="bred" onClick={() => patch({ ...contentSafe, timeline: (contentSafe.timeline ?? []).filter((_, i) => i !== idx) })}>Delete</button>
              </div>
            ))}
          </div>
        )}

        {panel === 'github' && (
          <div>
            <div className="fg"><label>GitHub Username</label><input value={ghUsername} onChange={(e) => setGhUsername(e.target.value)} /></div>
            <div className="fg"><label>Repository</label><input value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} /></div>
            <div className="fg"><label>Branch</label><input value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} /></div>
            <div className="fg"><label>Personal Access Token</label><input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} /></div>
            <small style={{ color: 'var(--muted)' }}>Token stored only in this browser, used only for GitHub API.</small>

            <div className="actions">
              <button className="bn bgold" onClick={async () => {
                await saveGitHubConfig({ user: ghUsername, repo: ghRepo, branch: ghBranch, token: ghToken });
                setGhStatus('checking');
                const connected = await testGitHubConnection({ user: ghUsername, repo: ghRepo, branch: ghBranch, token: ghToken });
                setGhStatus(connected ? 'connected' : 'failed');
                onToast(connected ? 'GitHub connected' : 'GitHub connection failed', connected ? 'success' : 'info');
              }}>Save + Test Connection</button>
            </div>

            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '4px', background: ghStatus === 'connected' ? '#d4edda' : ghStatus === 'failed' ? '#fdecea' : '#e2e3e5' }}>
              Status: {ghStatus}
            </div>

            <div className="fg" style={{ marginTop: '12px' }}>
              <label>Commit Message</label>
              <input defaultValue={`Update mission data — ${new Date().toLocaleDateString()}`} id="commitMessage" />
            </div>

            <button
              className="bn bgold"
              disabled={isPushing || ghStatus !== 'connected'}
              onClick={async () => {
                setIsPushing(true);
                setPushLog([]);
                const msg = (document.getElementById('commitMessage') as HTMLInputElement)?.value || 'Update mission data';
                const result = await pushDataToGitHub({ user: ghUsername, repo: ghRepo, branch: ghBranch, token: ghToken }, contentSafe, msg, (log) => setPushLog((prev) => [...prev, log]));
                if (result.success) {
                  onAudit('github_pushed', `Pushed data.json (${result.sha?.slice(0, 7)})`);
                  onToast('Data pushed to GitHub!');
                } else {
                  onToast(`Push failed: ${result.error}`, 'info');
                }
                setIsPushing(false);
              }}
            >{isPushing ? 'Publishing...' : 'Push data.json to GitHub'}</button>

            {pushLog.length > 0 && <textarea readOnly value={pushLog.join('\n')} style={{ width: '100%', minHeight: '150px', marginTop: '12px' }} />}

            <div className="item" style={{ marginTop: '12px' }}>
              <strong>How to get a PAT</strong>
              <ol style={{ margin: '8px 0 0 16px' }}>
                <li>GitHub → Settings → Developer Settings → Personal access tokens (classic)</li>
                <li>Generate token with <code>repo</code> scope</li>
                <li>Paste token above and save</li>
              </ol>
            </div>
          </div>
        )}

        {panel === 'settings' && (
          <div>
            <div className="fg"><label><input type="checkbox" checked={!!contentSafe.settings.showProgressBar} onChange={(e) => patch({ ...contentSafe, settings: { ...contentSafe.settings, showProgressBar: e.target.checked } })} /> Show Mission Progress Bar</label></div>
            <div className="fg"><label><input type="checkbox" checked={!!contentSafe.settings.showMap} onChange={(e) => patch({ ...contentSafe, settings: { ...contentSafe.settings, showMap: e.target.checked } })} /> Show Mission Map</label></div>
            <div className="fg"><label><input type="checkbox" checked={!!contentSafe.settings.allowMessages} onChange={(e) => patch({ ...contentSafe, settings: { ...contentSafe.settings, allowMessages: e.target.checked } })} /> Allow Contact Form Messages</label></div>
            <div className="fg"><label><input type="checkbox" checked={!!contentSafe.settings.allowSubscriptions} onChange={(e) => patch({ ...contentSafe, settings: { ...contentSafe.settings, allowSubscriptions: e.target.checked } })} /> Email Subscriptions</label></div>
            <div className="fg"><label><input type="checkbox" checked={!!contentSafe.settings.photoGalleryVisible} onChange={(e) => patch({ ...contentSafe, settings: { ...contentSafe.settings, photoGalleryVisible: e.target.checked } })} /> Photo Gallery Visible</label></div>

            <div className="item" style={{ marginTop: '16px' }}>
              <h3 style={{ marginBottom: '8px' }}>Change Admin Password</h3>
              <div className="fr">
                <div className="fg"><label>Current</label><input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} /></div>
                <div className="fg"><label>New</label><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
              </div>
              <div className="fg"><label>Confirm</label><input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /></div>
              <button className="bn" onClick={() => {
                if (currentPw !== adminPassword) { onToast('Current password is incorrect', 'info'); return; }
                if (!newPw || newPw !== confirmPw) { onToast('New password and confirmation must match', 'info'); return; }
                localStorage.setItem('mission_pw', newPw);
                setAdminPassword(newPw);
                setCurrentPw('');
                setNewPw('');
                setConfirmPw('');
                onToast('Admin password updated');
              }}>Update Password</button>
            </div>
          </div>
        )}

        {panel === 'messages' && (
          <div>
            {(contentSafe.messages ?? []).length === 0 && <p style={{ color: 'var(--muted)' }}>No messages yet.</p>}
            {(contentSafe.messages ?? []).map((msg, idx) => (
              <div className="item" key={msg.id}>
                <p><strong>{msg.name}</strong> ({msg.relation}) — {msg.email}</p>
                <p style={{ margin: '8px 0' }}>{msg.message}</p>
                <small>{msg.date}</small>
                <div className="actions">
                  <button onClick={() => window.open(`mailto:${msg.email}?subject=Mission Site Reply`, '_blank')}>Reply</button>
                  <button className="bred" onClick={() => patch({ ...contentSafe, messages: (contentSafe.messages ?? []).filter((_, i) => i !== idx) })}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {panel === 'subscribers' && (
          <div>
            <p style={{ marginBottom: '8px' }}><strong>{contentSafe.subscribers?.length ?? 0}</strong> people subscribed</p>
            {(contentSafe.subscribers ?? []).map((sub, idx) => (
              <div key={`${sub.email}-${idx}`} className="item">
                <p><strong>{sub.email}</strong> — {sub.relation} — {sub.date}</p>
                <button className="bred" onClick={() => patch({ ...contentSafe, subscribers: (contentSafe.subscribers ?? []).filter((_, i) => i !== idx) })}>Unsub</button>
              </div>
            ))}
            <div className="item" style={{ marginTop: '12px' }}>
              <h3 style={{ marginBottom: '8px' }}>Broadcast Email</h3>
              <p style={{ color: 'var(--muted)' }}>Static version note: this records intent only. Use your mail app to send broadcasts.</p>
            </div>
          </div>
        )}

        <div className="item" style={{ marginTop: '16px' }}>
          <label>Raw JSON (advanced)</label>
          <textarea value={jsonEditor} onChange={(e) => setJsonEditor(e.target.value)} style={{ minHeight: '180px', fontFamily: 'monospace' }} />
          <div className="actions">
            <button className="bn" onClick={() => {
              try {
                patch(JSON.parse(jsonEditor) as MissionContent);
                onToast('JSON imported successfully');
              } catch (e) {
                onToast(`JSON parse error: ${(e as Error).message}`, 'info');
              }
            }}>Import JSON</button>
          </div>
        </div>
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
          const primary = await fetch('./data.json');
          if (primary.ok) {
            const data = (await primary.json()) as any;
            if (data.site && data.profile) {
              setContent(data as MissionContent);
              activeContent = data as MissionContent;
            }
          }
          if (activeContent === DEFAULT_CONTENT) {
            const legacy = await fetch('./data/content.json');
            if (legacy.ok) {
              const json = (await legacy.json()) as MissionContent;
              setContent(json);
              activeContent = json;
            }
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
