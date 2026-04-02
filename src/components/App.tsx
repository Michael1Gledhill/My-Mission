import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_DATA } from '../data/defaultData';
import type { GitHubConfig, Photo, SiteData } from '../types';
import { loadAdminData, loadPassword, saveAdminData, savePassword } from '../lib/storage';
import { HomePage } from './pages/HomePage';
import { UpdatesPage } from './pages/UpdatesPage';
import { PhotosPage } from './pages/PhotosPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { MapEditor } from './map/MapEditor';

const STORAGE_GH_KEY = 'mission_gh';
const GITHUB_DATA_URL = 'https://raw.githubusercontent.com/michael1gledhill/My-Mission/main/data.json';

type AdminPanelKey =
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

async function loadFreshData(config?: GitHubConfig | null): Promise<SiteData | null> {
  try {
    const target = config?.user ? `https://raw.githubusercontent.com/${config.user}/${config.repo}/${config.branch}/data.json?t=${Date.now()}` : `${GITHUB_DATA_URL}?t=${Date.now()}`;
    const res = await fetch(target, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as SiteData;
  } catch {
    return null;
  }
}

async function pushToGitHub(config: GitHubConfig, data: SiteData, message: string): Promise<string> {
  const headers = {
    Authorization: `token ${config.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json'
  };

  let sha: string | undefined;
  const getRes = await fetch(`https://api.github.com/repos/${config.user}/${config.repo}/contents/data.json?ref=${config.branch}`, { headers });
  if (getRes.ok) {
    const found = (await getRes.json()) as { sha?: string };
    sha = found.sha;
  }

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const body: Record<string, string> = { message, content, branch: config.branch };
  if (sha) body.sha = sha;

  const putRes = await fetch(`https://api.github.com/repos/${config.user}/${config.repo}/contents/data.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const err = (await putRes.json()) as { message?: string };
    throw new Error(err.message || 'Unknown GitHub push error');
  }

  const out = (await putRes.json()) as { commit?: { sha?: string } };
  return out.commit?.sha || 'unknown';
}

function AdminView({ data, setData }: { data: SiteData; setData: (next: SiteData) => void }) {
  const [panel, setPanel] = useState<AdminPanelKey>('dashboard');
  const [pendingUpload, setPendingUpload] = useState<Array<{ fileName: string; imageData: string; title: string; album: string }>>([]);
  const [albumChoice, setAlbumChoice] = useState('March 2025');
  const [newAlbum, setNewAlbum] = useState('');
  const [ghUser, setGhUser] = useState('');
  const [ghRepo, setGhRepo] = useState('My-Mission');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghToken, setGhToken] = useState('');
  const [commitMessage, setCommitMessage] = useState(`Update mission data — ${new Date().toLocaleDateString()}`);
  const [pushLog, setPushLog] = useState<string[]>([]);
  const [isPushing, setIsPushing] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_GH_KEY);
      if (!stored) return;
      const cfg = JSON.parse(stored) as GitHubConfig;
      setGhUser(cfg.user);
      setGhRepo(cfg.repo);
      setGhBranch(cfg.branch);
      setGhToken(cfg.token);
    } catch {
      // ignore
    }
  }, []);

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          let w = img.width;
          let h = img.height;
          if (w > MAX) { h = Math.round((h * MAX) / w); w = MAX; }
          if (h > MAX) { w = Math.round((w * MAX) / h); h = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = () => reject(new Error('Failed to load selected image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const all = Array.from(files);
    const selectedAlbum = albumChoice === '__new__' ? newAlbum.trim() || 'New Album' : albumChoice;
    const nextItems: Array<{ fileName: string; imageData: string; title: string; album: string }> = [];
    for (const file of all) {
      if (file.size > 3 * 1024 * 1024) {
        setPushLog((prev) => [...prev, `⚠ ${file.name} is larger than 3MB before compression.`]);
      }
      try {
        const imageData = await compressImage(file);
        nextItems.push({ fileName: file.name, imageData, title: file.name.replace(/\.[^.]+$/, ''), album: selectedAlbum });
      } catch (err) {
        setPushLog((prev) => [...prev, `✗ ${file.name}: ${(err as Error).message}`]);
      }
    }
    setPendingUpload((prev) => [...prev, ...nextItems]);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    void handleFiles(e.dataTransfer.files);
  };

  const addPendingPhotos = () => {
    const mapped: Photo[] = pendingUpload.map((p, idx) => ({
      id: Date.now() + idx,
      emoji: '',
      title: p.title,
      desc: '',
      album: p.album,
      date: p.album,
      bg: 'linear-gradient(135deg,#b8d4f0,#7aaad8)',
      span: '',
      imageData: p.imageData
    }));
    setData({ ...data, photos: [...mapped, ...data.photos].slice(0, 50), stats: { ...data.stats, subscribers: data.subscribers.length } });
    setPendingUpload([]);
  };

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= data.photos.length) return;
    const next = [...data.photos];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    setData({ ...data, photos: next });
  };

  const panelLabel: Record<AdminPanelKey, string> = {
    dashboard: 'Dashboard',
    profile: 'Profile & Info',
    progress: 'Mission Progress',
    map: 'Mission Map',
    updates: 'Weekly Updates',
    photos: 'Photos',
    scripture: 'Scripture',
    timeline: 'Timeline',
    github: 'GitHub / Publish',
    settings: 'Settings',
    messages: 'Messages',
    subscribers: 'Subscribers'
  };

  return (
    <div className="adminLayout">
      <aside className="adminSidebar">
        {Object.keys(panelLabel).map((key) => (
          <button key={key} className={panel === key ? 'tabActive' : ''} onClick={() => setPanel(key as AdminPanelKey)}>{panelLabel[key as AdminPanelKey]}</button>
        ))}
      </aside>
      <section className="adminMain">
        <div className="adminTopbar">
          <h2>{panelLabel[panel]}</h2>
          <button className="bn bgold" onClick={() => setPanel('github')}>Push to GitHub</button>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          {panel === 'dashboard' && (
            <>
              <div className="stats">
                <article className="statCard"><div className="sv">{data.posts.length}</div><div className="sl">Updates</div></article>
                <article className="statCard"><div className="sv">{data.stats.overallProgress}%</div><div className="sl">Progress</div></article>
                <article className="statCard"><div className="sv">{data.subscribers.length}</div><div className="sl">Subscribers</div></article>
                <article className="statCard"><div className="sv">{data.photos.length}</div><div className="sl">Photos</div></article>
              </div>
              <h3>Recent Messages</h3>
              {data.messages.slice(0, 3).map((msg) => <div key={msg.id} className="item"><strong>{msg.name}</strong> — {msg.message}</div>)}
            </>
          )}

          {panel === 'profile' && (
            <>
              <div className="fr">
                <div className="fg"><label>First Name</label><input value={data.missionary.firstName} onChange={(e) => setData({ ...data, missionary: { ...data.missionary, firstName: e.target.value } })} /></div>
                <div className="fg"><label>Last Name</label><input value={data.missionary.lastName} onChange={(e) => setData({ ...data, missionary: { ...data.missionary, lastName: e.target.value } })} /></div>
              </div>
              <div className="fr">
                <div className="fg"><label>Hometown</label><input value={data.missionary.hometown} onChange={(e) => setData({ ...data, missionary: { ...data.missionary, hometown: e.target.value } })} /></div>
                <div className="fg"><label>Age</label><input type="number" value={data.missionary.age} onChange={(e) => setData({ ...data, missionary: { ...data.missionary, age: Number(e.target.value) } })} /></div>
              </div>
              <div className="fg"><label>Bio</label><textarea value={data.missionary.bio} onChange={(e) => setData({ ...data, missionary: { ...data.missionary, bio: e.target.value } })} /></div>
              <div className="fg"><label>Testimony</label><textarea value={data.missionary.testimony} onChange={(e) => setData({ ...data, missionary: { ...data.missionary, testimony: e.target.value } })} /></div>
            </>
          )}

          {panel === 'progress' && (
            <>
              <div className="fg"><label>Overall Mission Progress ({data.stats.overallProgress}%)</label><input type="range" min={0} max={100} value={data.stats.overallProgress} onChange={(e) => setData({ ...data, stats: { ...data.stats, overallProgress: Number(e.target.value) } })} /></div>
              <div className="fg"><label>Current Area Progress ({data.stats.areaProgress}%)</label><input type="range" min={0} max={100} value={data.stats.areaProgress} onChange={(e) => setData({ ...data, stats: { ...data.stats, areaProgress: Number(e.target.value) } })} /></div>
              <div className="fg"><label>Weekly Discussion Goal ({data.stats.weeklyGoalDiscussions}/{data.stats.weeklyGoalTarget})</label><input type="range" min={0} max={12} value={data.stats.weeklyGoalDiscussions} onChange={(e) => setData({ ...data, stats: { ...data.stats, weeklyGoalDiscussions: Number(e.target.value) } })} /></div>
            </>
          )}

          {panel === 'map' && (
            <>
              <MapEditor
                boundary={data.mapBoundaries.missionBoundary}
                currentArea={data.location.areaDescription}
                onBoundaryChange={(nextBoundary) => setData({ ...data, mapBoundaries: { ...data.mapBoundaries, missionBoundary: nextBoundary } })}
                onCurrentAreaChange={(nextArea) => setData({ ...data, location: { ...data.location, areaDescription: nextArea } })}
              />
              <div className="fg" style={{ marginTop: 12 }}><label>Mission Boundary JSON [[lat,lng],...]</label><textarea onBlur={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value) as [number, number][];
                  if (Array.isArray(parsed)) setData({ ...data, mapBoundaries: { ...data.mapBoundaries, missionBoundary: parsed } });
                } catch {
                  // ignore
                }
              }} defaultValue={JSON.stringify(data.mapBoundaries.missionBoundary, null, 2)} /></div>
              <button className="bn" onClick={() => {
                const name = prompt('Area name');
                if (!name) return;
                const lat = Number(prompt('Area latitude', `${data.location.lat}`));
                const lng = Number(prompt('Area longitude', `${data.location.lng}`));
                const status = (prompt('Status: completed/current/future', 'future') || 'future') as 'completed' | 'current' | 'future';
                setData({
                  ...data,
                  mapBoundaries: {
                    ...data.mapBoundaries,
                    areas: [...data.mapBoundaries.areas, { id: name.toLowerCase().replace(/\s+/g, ''), name, status, startDate: null, endDate: null, lat, lng, boundary: [] }]
                  }
                });
              }}>Add Area</button>
            </>
          )}

          {panel === 'updates' && (
            <>
              <button className="bn" onClick={() => {
                const next = {
                  id: Date.now(),
                  week: data.posts.length + 1,
                  date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                  title: 'New Weekly Update',
                  location: data.location.areaDescription,
                  body: 'Dear family and friends,\n\nThis week was full of faith-building moments.\n\n— Elder Gledhill',
                  scripture: data.scripture.text,
                  scriptureRef: data.scripture.reference,
                  tags: ['Teaching']
                };
                setData({ ...data, posts: [next, ...data.posts], stats: { ...data.stats, weeklyUpdates: data.posts.length + 1 } });
              }}>Publish Update</button>
              {data.posts.map((post, i) => (
                <div className="item" key={post.id}>
                  <div><strong>Week {post.week}:</strong> {post.title}</div>
                  <div className="actions">
                    <button onClick={() => {
                      const title = prompt('Edit title', post.title);
                      if (!title) return;
                      const next = [...data.posts];
                      next[i] = { ...next[i], title };
                      setData({ ...data, posts: next });
                    }}>Edit</button>
                    <button className="bred" onClick={() => setData({ ...data, posts: data.posts.filter((_, idx) => idx !== i), stats: { ...data.stats, weeklyUpdates: Math.max(0, data.posts.length - 1) } })}>Delete</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {panel === 'photos' && (
            <>
              <div className="item" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
                <p><strong>Upload Area</strong> (drag files here or browse)</p>
                <div className="fr">
                  <div className="fg">
                    <label>Album</label>
                    <select value={albumChoice} onChange={(e) => setAlbumChoice(e.target.value)}>
                      {Array.from(new Set(data.photos.map((p) => p.album))).map((album) => <option key={album} value={album}>{album}</option>)}
                      <option value="__new__">New Album...</option>
                    </select>
                  </div>
                  {albumChoice === '__new__' && <div className="fg"><label>New Album Name</label><input value={newAlbum} onChange={(e) => setNewAlbum(e.target.value)} /></div>}
                </div>
                <input type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); }} />
              </div>

              {pendingUpload.length > 0 && (
                <div className="item">
                  <strong>Pending Photos</strong>
                  <div className="photoGrid">
                    {pendingUpload.map((p, i) => <div key={`${p.fileName}-${i}`} className="photoCard"><img src={p.imageData} alt={p.title} /></div>)}
                  </div>
                  <div className="actions">
                    <button className="bgold" onClick={addPendingPhotos}>Add These Photos to Gallery</button>
                    <button className="bred" onClick={() => setPendingUpload([])}>Clear</button>
                  </div>
                </div>
              )}

              <div className="photoGrid">
                {data.photos.map((photo, idx) => (
                  <div className="photoCard" key={photo.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(idx))} onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData('text/plain'));
                    movePhoto(from, idx);
                  }} onDragOver={(e) => e.preventDefault()}>
                    {photo.imageData ? <img src={photo.imageData} alt={photo.title} /> : <div style={{ width: '100%', height: '100%', background: photo.bg, display: 'grid', placeItems: 'center' }}>{photo.emoji}</div>}
                    <div className="actions" style={{ position: 'absolute', right: 6, top: 6 }}>
                      <button aria-label="Delete photo" className="bred" onClick={() => setData({ ...data, photos: data.photos.filter((_, i) => i !== idx) })}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {panel === 'scripture' && (
            <>
              <div className="fg"><label>Scripture Text</label><textarea value={data.scripture.text} onChange={(e) => setData({ ...data, scripture: { ...data.scripture, text: e.target.value } })} /></div>
              <div className="fg"><label>Reference</label><input value={data.scripture.reference} onChange={(e) => setData({ ...data, scripture: { ...data.scripture, reference: e.target.value } })} /></div>
            </>
          )}

          {panel === 'timeline' && (
            <>
              <button className="bn" onClick={() => setData({ ...data, timeline: [...data.timeline, { id: Date.now(), date: 'New Date', event: 'New milestone', status: 'future' }] })}>+ Add Milestone</button>
              {data.timeline.map((item, idx) => (
                <div className="item" key={item.id}>
                  <strong>{item.date}</strong> — {item.event} ({item.status})
                  <div className="actions">
                    <button onClick={() => {
                      const event = prompt('Edit milestone', item.event);
                      if (!event) return;
                      const next = [...data.timeline];
                      next[idx] = { ...next[idx], event };
                      setData({ ...data, timeline: next });
                    }}>Edit</button>
                    <button className="bred" onClick={() => setData({ ...data, timeline: data.timeline.filter((_, i) => i !== idx) })}>Delete</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {panel === 'github' && (
            <>
              <div className="fg"><label>GitHub Username</label><input value={ghUser} onChange={(e) => setGhUser(e.target.value)} /></div>
              <div className="fg"><label>Repository Name</label><input value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} /></div>
              <div className="fg"><label>Branch</label><input value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} /></div>
              <div className="fg"><label>Personal Access Token</label><input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} /></div>
              <div className="fg"><label>Commit Message</label><input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} /></div>
              <div className="actions">
                <button className="bn" onClick={() => {
                  localStorage.setItem(STORAGE_GH_KEY, JSON.stringify({ user: ghUser, repo: ghRepo, branch: ghBranch, token: ghToken }));
                  setPushLog((prev) => [...prev, '✓ Saved GitHub config locally']);
                }}>Save GitHub Config</button>
                <button className="bgold" disabled={isPushing} onClick={async () => {
                  const cfg: GitHubConfig = { user: ghUser, repo: ghRepo, branch: ghBranch, token: ghToken };
                  try {
                    setIsPushing(true);
                    setPushLog((prev) => [...prev, '⏳ Pushing data.json to GitHub...']);
                    const sha = await pushToGitHub(cfg, data, commitMessage);
                    setPushLog((prev) => [...prev, `✅ Push success: ${sha}`]);
                  } catch (err) {
                    setPushLog((prev) => [...prev, `❌ ${(err as Error).message}`]);
                  } finally {
                    setIsPushing(false);
                  }
                }}>{isPushing ? 'Publishing...' : 'Push data.json to GitHub'}</button>
              </div>
              <textarea readOnly value={pushLog.join('\n')} style={{ width: '100%', minHeight: 160, marginTop: 12 }} />
            </>
          )}

          {panel === 'settings' && (
            <>
              <div className="fg"><label><input type="checkbox" checked onChange={() => {}} /> Show Mission Progress Bar</label></div>
              <div className="fg"><label><input type="checkbox" checked onChange={() => {}} /> Show Mission Map</label></div>
              <div className="fg"><label><input type="checkbox" checked onChange={() => {}} /> Allow Contact Form Messages</label></div>
              <div className="fg"><label><input type="checkbox" checked onChange={() => {}} /> Email Subscriptions</label></div>
              <div className="fg"><label><input type="checkbox" checked onChange={() => {}} /> Photo Gallery Visible</label></div>
            </>
          )}

          {panel === 'messages' && (
            <>
              {data.messages.map((msg, idx) => (
                <div className="item" key={msg.id}>
                  <strong>{msg.name}</strong> ({msg.relation})<br />
                  {msg.message}
                  <div className="actions">
                    <button onClick={() => window.open(`mailto:${msg.email}`, '_blank')}>Reply</button>
                    <button className="bred" onClick={() => setData({ ...data, messages: data.messages.filter((_, i) => i !== idx) })}>Delete</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {panel === 'subscribers' && (
            <>
              <p><strong>{data.subscribers.length}</strong> people subscribed</p>
              {data.subscribers.map((sub, idx) => (
                <div className="item" key={`${sub.email}-${idx}`}>
                  {sub.email} — {sub.date} ({sub.relation})
                  <button className="bred" onClick={() => setData({ ...data, subscribers: data.subscribers.filter((_, i) => i !== idx), stats: { ...data.stats, subscribers: Math.max(0, data.subscribers.length - 1) } })}>Unsub</button>
                </div>
              ))}
              <div className="fg"><label>Broadcast Email Draft</label><textarea placeholder="Static mode: draft your broadcast copy here." /></div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [data, setData] = useState<SiteData>(DEFAULT_DATA);
  const [showLoader, setShowLoader] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [adminPassword, setAdminPasswordState] = useState(loadPassword());
  const [path, setPath] = useState<string>(window.location.pathname.replace(/\/+$/, '') || '/');

  const go = (nextPath: string) => {
    const normalized = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
    window.history.pushState({}, '', normalized);
    setPath(normalized);
  };

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname.replace(/\/+$/, '') || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    async function startup() {
      setData(DEFAULT_DATA);
      window.setTimeout(() => setShowLoader(false), 400);

      const cached = loadAdminData();
      if (cached) {
        const { _ts: _ignoreTs, ...rest } = cached;
        setData(rest);
      }

      const cfg = (() => {
        try {
          const raw = localStorage.getItem(STORAGE_GH_KEY);
          return raw ? (JSON.parse(raw) as GitHubConfig) : null;
        } catch {
          return null;
        }
      })();

      const fresh = await loadFreshData(cfg);
      if (fresh) setData(fresh);
    }

    void startup();
  }, []);

  useEffect(() => {
    saveAdminData(data);
  }, [data]);

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const sortedPosts = useMemo(() => [...data.posts].sort((a, b) => b.id - a.id), [data.posts]);
  const routeData = { ...data, posts: sortedPosts };

  return (
    <div className="page">
      {showLoader && (
        <div id="loader">
          <div className="ld-cross">✚</div>
          <div className="ld-txt">Loading Elder Gledhill's Mission…</div>
        </div>
      )}

      <header className="topbar">
        <div>
          <h1>Elder Gledhill Mission Portal</h1>
          <p>Idaho Idaho Falls Mission</p>
        </div>
        <nav className="nav">
          <button className="nl" onClick={() => go('/')}>Home</button>
          <button className="nl" onClick={() => go('/updates')}>Updates</button>
          <button className="nl" onClick={() => go('/photos')}>Photos</button>
          <button className="nl" onClick={() => go('/about')}>About</button>
          <button className="nl" onClick={() => go('/contact')}>Contact</button>
          <button className="nl" onClick={() => setDarkMode((prev) => !prev)}>{darkMode ? 'Light' : 'Dark'} Mode</button>
          <button className="nl" onClick={() => go('/admin')}>Admin</button>
        </nav>
      </header>

      {(path === '/' || path === '/My-Mission' || path === '/My-Mission/') && <HomePage data={routeData} />}
      {path === '/updates' && <UpdatesPage data={routeData} />}
      {path === '/photos' && <PhotosPage data={routeData} />}
      {path === '/about' && <AboutPage data={routeData} />}
      {path === '/contact' && <ContactPage data={routeData} onMessageSubmit={(payload) => {
          setData({
            ...data,
            messages: [{ id: Date.now(), ...payload, date: new Date().toLocaleDateString(), replied: false }, ...data.messages]
          });
        }} onSubscribe={(email, relation) => {
          setData({
            ...data,
            subscribers: [{ email, date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), relation }, ...data.subscribers],
            stats: { ...data.stats, subscribers: data.subscribers.length + 1 }
          });
        }} />}

      {(path === '/admin' || path === '/admin.html') && (adminAuthenticated ? (
        <AdminView data={data} setData={setData} />
      ) : (
        <main className="wrap"><div className="card narrow"><h2 className="card-title">Admin Login</h2><div className="fg"><label>Password</label><input type="password" value={adminInput} onChange={(e) => setAdminInput(e.target.value)} /></div><div className="actions"><button className="bn" onClick={() => { if (adminInput === adminPassword) setAdminAuthenticated(true); }}>Login</button></div><p style={{ marginTop: 10, fontSize: '.85rem' }}>Default password: <code>mission2024</code></p><div className="fg" style={{ marginTop: 12 }}><label>Change Password</label><input type="password" placeholder="New admin password" onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const next = (e.target as HTMLInputElement).value;
                if (!next) return;
                savePassword(next);
                setAdminPasswordState(next);
                (e.target as HTMLInputElement).value = '';
              }
            }} /></div></div></main>
      ))}

      {!(path === '/' || path === '/updates' || path === '/photos' || path === '/about' || path === '/contact' || path === '/admin' || path === '/admin.html' || path === '/My-Mission' || path === '/My-Mission/') && (
        <main className="wrap"><div className="card"><h2 className="card-title">Page not found</h2><button className="bn" onClick={() => go('/')}>Go Home</button></div></main>
      )}
    </div>
  );
}
