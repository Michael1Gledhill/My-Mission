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
  const publicPhotos = content.photos.filter((p) => p.visibility === 'public');
  const approvedPhotos = content.photos.filter((p) => p.visibility === 'approved');

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
            {!isApproved && content.settings.requireApproval && <p>Login with an approved account to view protected photos.</p>}
            {isApproved && approvedPhotos.length === 0 && <p>No approved-only photos yet.</p>}
            {isApproved && (
              <div className="photoGrid">
                {approvedPhotos.map((photo) => (
                  <article key={photo.id} className="item photoCard">
                    <img src={photo.url} alt={photo.title} loading="lazy" />
                    <p>{photo.title}</p>
                  </article>
                ))}
              </div>
            )}
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
  const [jsonMessage, setJsonMessage] = useState('');

  useEffect(() => {
    setEditorValue(JSON.stringify(content, null, 2));
  }, [content]);

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
  };

  const removePhoto = (id: string) => {
    onUpdateContent({
      ...content,
      photos: content.photos.filter((photo) => photo.id !== id)
    });
  };

  const setPhotoVisibility = (id: string, visibility: 'public' | 'approved') => {
    onUpdateContent({
      ...content,
      photos: content.photos.map((photo) => (photo.id === id ? { ...photo, visibility } : photo))
    });
  };

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
        <h2>Full site JSON editor</h2>
        <p>Every detail of the webapp is editable here. Update JSON then save.</p>
        {jsonMessage && <p className="message">{jsonMessage}</p>}
        <textarea value={editorValue} onChange={(e) => setEditorValue(e.target.value)} rows={24} />
        <div className="actions">
          <button
            onClick={() => {
              try {
                const parsed = JSON.parse(editorValue) as MissionContent;
                onUpdateContent(parsed);
                setJsonMessage('JSON saved successfully.');
              } catch (error) {
                setJsonMessage(error instanceof Error ? error.message : 'Invalid JSON.');
              }
            }}
          >
            Save content
          </button>
        </div>
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

  useEffect(() => {
    setArea(currentArea);
    setPoints(boundaryText);
  }, [boundaryText, currentArea]);

  return (
    <>
      {message && <p className="message">{message}</p>}
      <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Current area" />
      <textarea
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        rows={8}
        placeholder="One point per line in the format: lat,lng"
      />
      <div className="actions">
        <button
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

  return (
    <>
      <input placeholder="Photo title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Photo URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'approved')}>
        <option value="public">Public</option>
        <option value="approved">Approved only</option>
      </select>
      <div className="actions">
        <button
          onClick={() => {
            if (!title.trim() || !url.trim()) {
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
                onClick={() =>
                  onSetVisibility(photo.id, photo.visibility === 'public' ? 'approved' : 'public')
                }
              >
                Set {photo.visibility === 'public' ? 'approved' : 'public'}
              </button>
              <button onClick={() => onRemovePhoto(photo.id)}>Remove</button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
