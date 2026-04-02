import { MissionContent } from '../../types';
import { MissionMap } from '../MissionMap';

interface HomePageProps {
  content: MissionContent;
  sessionEmail: string | null;
  canViewMissionInfo: boolean;
}

export function HomePage({
  content,
  sessionEmail,
  canViewMissionInfo
}: HomePageProps) {
  const startDate = new Date('2024-01-08');
  const endDate = new Date('2026-01-08');
  const now = new Date();
  const totalMs = endDate.getTime() - startDate.getTime();
  const elapsedMs = now.getTime() - startDate.getTime();
  const monthsServed = Math.floor(elapsedMs / (30 * 24 * 60 * 60 * 1000));
  const progressPercent = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
  const missionDuration = 24;

  const missionTimeline = [
    { id: 1, date: 'January 2024', event: 'Entered MTC in Provo', status: 'done' as const },
    { id: 2, date: 'March 2024', event: 'Arrived in Idaho — First area: Rexburg', status: 'done' as const },
    { id: 3, date: 'September 2024', event: 'Transferred to Pocatello', status: 'done' as const },
    { id: 4, date: 'January 2025', event: 'Transferred to Idaho Falls West', status: 'done' as const },
    { id: 5, date: 'July 2025', event: '18-month mark 🎉', status: monthsServed >= 18 ? 'done' : 'future' as const },
    { id: 6, date: 'January 2026', event: 'Return Home — Mission Complete', status: 'future' as const }
  ];

  const publicPhotos = content.photos.filter((p) => p.visibility === 'public');
  const publicUpdates = content.updates.filter((u) => u.visibility === 'public');

  return (
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
                  <strong>{content.profile.firstName}</strong>
                  <small>Missionary</small>
                </article>
                <article className="item statCard">
                  <strong>{missionDuration}</strong>
                  <small>Mission months</small>
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
              {publicUpdates.slice(0, 3).map((update, idx) => (
                <article key={update.id} className="post" style={{ marginBottom: '16px', animation: `fadeUp 0.35s ease ${idx * 0.08}s both` }}>
                  <div className="post-hd">
                    <span className="wk-b">Week {Math.floor(Math.random() * 50)}</span>
                  </div>
                  <div style={{ padding: '13px 22px 0' }}>
                    <div className="post-date">{update.date}</div>
                    <h3 className="post-title">{update.title}</h3>
                  </div>
                  <div className="post-body">{update.body}</div>
                </article>
              ))}
            </div>
          </div>

          {publicPhotos.length > 0 && (
            <div className="card" style={{ marginBottom: '32px' }}>
              <h2 className="card-title">Recent Photos</h2>
              <div className="photoGrid">
                {publicPhotos.slice(0, 6).map((photo) => (
                  <article key={photo.id} className="photoCard" title={photo.title}>
                    <div style={{ width: '100%', height: '200px', backgroundColor: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', overflow: 'hidden' }}>
                      {photo.url.startsWith('http') ? (
                        <img src={photo.url} alt={photo.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '4rem' }}>{photo.url}</span>
                      )}
                    </div>
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
              <h2 className="card-title">Mission Location</h2>
              <MissionMap boundary={content.map.boundary} currentLat={43.4917} currentLng={-112.0339} currentArea={content.map.currentArea} />
            </div>
          </div>
        </div>
      )}

      {!canViewMissionInfo && (
        <div className="wrap">
          <div className="card" style={{ maxWidth: '500px', margin: '60px auto', textAlign: 'center' }}>
            <h2>Mission Updates</h2>
            <p>Sign in to see detailed mission information, photos, and updates.</p>
          </div>
        </div>
      )}
    </main>
  );
}
