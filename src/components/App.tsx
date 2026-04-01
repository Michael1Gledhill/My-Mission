import { useEffect, useMemo, useState } from 'react';
import type { AppUser, MissionContent } from '../types';
import { generateSalt, hashPassword, normalizeEmail } from '../lib/auth';
import { loadContent, loadSession, loadUsers, saveContent, saveSession, saveUsers } from '../lib/storage';

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

type ViewMode = 'home' | 'login' | 'register' | 'admin';

export function App() {
  const [content, setContent] = useState<MissionContent>(DEFAULT_CONTENT);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string | null>(loadSession());
  const [mode, setMode] = useState<ViewMode>('home');
  const [message, setMessage] = useState('');

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

  const currentUser = useMemo(() => {
    if (!sessionEmail) return null;
    return users.find((u) => normalizeEmail(u.email) === normalizeEmail(sessionEmail)) ?? null;
  }, [sessionEmail, users]);

  const isApproved = currentUser?.status === 'approved';
  const isAdmin = !!currentUser && content.settings.adminEmails.map(normalizeEmail).includes(normalizeEmail(currentUser.email));

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
      requestedAt: new Date().toISOString()
    };

    setUsers((prev) => [...prev, user]);
    setMessage('Registration submitted. Wait for admin approval before access.');
    setMode('login');
  };

  const login = async (email: string, password: string) => {
    const normalized = normalizeEmail(email);
    const user = users.find((u) => normalizeEmail(u.email) === normalized);

    if (!user) {
      setMessage('No account found for that email.');
      return;
    }

    const attemptedHash = await hashPassword(password, user.salt);
    if (attemptedHash !== user.passwordHash) {
      setMessage('Incorrect password.');
      return;
    }

    if (user.status !== 'approved') {
      setMessage(`Your account is currently ${user.status}. Admin approval is required.`);
      return;
    }

    saveSession(user.email);
    setSessionEmail(user.email);
    setMessage('Signed in successfully.');
    setMode('home');
  };

  const logout = () => {
    saveSession(null);
    setSessionEmail(null);
    setMessage('Signed out.');
  };

  const approveUser = (id: string, status: 'approved' | 'rejected' | 'suspended') => {
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
  };

  const protectedUpdates = content.updates.filter((u) => u.visibility === 'approved');
  const publicUpdates = content.updates.filter((u) => u.visibility === 'public');

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>{content.site.title}</h1>
          <p>{content.site.subtitle}</p>
        </div>
        <nav className="nav">
          <button onClick={() => setMode('home')}>Home</button>
          <button onClick={() => setMode('register')}>Register</button>
          <button onClick={() => setMode('login')}>Login</button>
          {isAdmin && <button onClick={() => setMode('admin')}>Admin</button>}
          {currentUser && <button onClick={logout}>Logout</button>}
        </nav>
      </header>

      {message && <p className="message">{message}</p>}

      {mode === 'home' && (
        <main className="grid">
          <section className="card">
            <h2>Mission</h2>
            <p><strong>{content.site.missionName}</strong></p>
            <p>{content.profile.firstName} {content.profile.lastName}</p>
            <p>{content.profile.bio}</p>
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
            {!isApproved && content.settings.requireApproval && <p>Login with an approved account to view protected information.</p>}
            {isApproved &&
              protectedUpdates.map((u) => (
                <article key={u.id} className="item">
                  <h3>{u.title}</h3>
                  <small>{u.date}</small>
                  <p>{u.body}</p>
                </article>
              ))}
          </section>
        </main>
      )}

      {mode === 'register' && <RegisterForm onSubmit={register} />}
      {mode === 'login' && <LoginForm onSubmit={login} />}

      {mode === 'admin' && isAdmin && (
        <AdminPanel
          users={users}
          content={content}
          onUpdateContent={setContent}
          onSetUserStatus={approveUser}
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

  return (
    <main className="card narrow">
      <h2>Create account</h2>
      <p>Required fields: first name, last name, email, password. Access requires admin approval.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit({ firstName, lastName, email, password });
        }}
      >
        <input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input required minLength={10} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Submit for approval</button>
      </form>
    </main>
  );
}

function LoginForm({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main className="card narrow">
      <h2>Login</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(email, password);
        }}
      >
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}

function AdminPanel({
  users,
  content,
  onSetUserStatus,
  onUpdateContent
}: {
  users: AppUser[];
  content: MissionContent;
  onSetUserStatus: (id: string, status: 'approved' | 'rejected' | 'suspended') => void;
  onUpdateContent: (next: MissionContent) => void;
}) {
  const [editorValue, setEditorValue] = useState(JSON.stringify(content, null, 2));

  useEffect(() => {
    setEditorValue(JSON.stringify(content, null, 2));
  }, [content]);

  return (
    <main className="grid">
      <section className="card">
        <h2>User approvals</h2>
        {users.length === 0 && <p>No users yet.</p>}
        {users.map((u) => (
          <article key={u.id} className="item">
            <h3>{u.firstName} {u.lastName}</h3>
            <p>{u.email}</p>
            <p>Status: <strong>{u.status}</strong></p>
            <div className="actions">
              <button onClick={() => onSetUserStatus(u.id, 'approved')}>Approve</button>
              <button onClick={() => onSetUserStatus(u.id, 'rejected')}>Reject</button>
              <button onClick={() => onSetUserStatus(u.id, 'suspended')}>Suspend</button>
            </div>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>Full site JSON editor</h2>
        <p>Every detail of the webapp is editable here. Update JSON then save.</p>
        <textarea value={editorValue} onChange={(e) => setEditorValue(e.target.value)} rows={24} />
        <div className="actions">
          <button
            onClick={() => {
              const parsed = JSON.parse(editorValue) as MissionContent;
              onUpdateContent(parsed);
            }}
          >
            Save content
          </button>
        </div>
      </section>
    </main>
  );
}
