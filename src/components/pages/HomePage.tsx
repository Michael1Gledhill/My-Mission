import { useEffect, useMemo, useState } from 'react';
import type { SiteData } from '../../types';
import { MissionMap } from '../MissionMap';

interface HomePageProps {
  data: SiteData;
}

function calcDaysLeft(endDate: string): number {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

function useCountUp(target: number, duration = 1200): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (ts: number) => {
      const progress = Math.min(1, (ts - start) / duration);
      setVal(Math.round(target * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function HomePage({ data }: HomePageProps) {
  const go = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const daysLeft = useMemo(() => calcDaysLeft(data.missionary.endDate), [data.missionary.endDate]);
  const monthsServed = useCountUp(data.stats.monthsServed);
  const milesBiked = useCountUp(data.stats.monthsServed * 110);
  const weeklyUpdates = useCountUp(data.stats.weeklyUpdates);
  const latestPost = data.posts[0];

  return (
    <main id="main-content" tabIndex={-1}>
      <section className="hero">
        <div className="hero-in">
          <div className="eyebrow">Currently Serving in {data.location.city}, {data.location.state}</div>
          <h1>Sharing the Gospel,<br /><em>One Day at a Time</em></h1>
          <p>Follow along as Elder {data.missionary.lastName} serves a two-year mission for The Church of Jesus Christ of Latter-day Saints in the Idaho Idaho Falls Mission.</p>
          <div className="hero-stats">
            <div><div className="hs-v">{data.stats.monthsServed}</div><div className="hs-l">Months Served</div></div>
            <div><div className="hs-v">{Math.max(0, data.stats.monthsTotal - data.stats.monthsServed)}</div><div className="hs-l">Months Remaining</div></div>
            <div><div className="hs-v">{data.stats.weeklyUpdates}</div><div className="hs-l">Weekly Updates</div></div>
            <div><div className="hs-v">{data.stats.areasServed}</div><div className="hs-l">Areas Served</div></div>
          </div>
          <p style={{ marginTop: 16, color: 'var(--gold-light)', fontWeight: 700 }}>{daysLeft} days until Elder Gledhill comes home!</p>
        </div>
      </section>

      <div className="wrap">
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="g3">
            <div><div className="hs-v" style={{ color: 'var(--navy)' }}>{monthsServed}</div><div className="hs-l" style={{ color: 'var(--muted)' }}>Months Served</div></div>
            <div><div className="hs-v" style={{ color: 'var(--navy)' }}>{milesBiked}</div><div className="hs-l" style={{ color: 'var(--muted)' }}>Est. Miles Biked</div></div>
            <div><div className="hs-v" style={{ color: 'var(--navy)' }}>{weeklyUpdates}</div><div className="hs-l" style={{ color: 'var(--muted)' }}>Weekly Updates</div></div>
          </div>
        </div>

        <div className="g2" style={{ marginBottom: 22 }}>
          <div className="card">
            <div className="card-hd"><div className="card-title">Mission Progress</div><div className="badge">{data.stats.overallProgress}% Complete</div></div>
            <div className="sec-lbl">Overall Mission Timeline</div>
            <div className="prog-wrap">
              <div className="prog-row"><span className="prog-lbl">Started: January 2024</span><span className="prog-val">{data.stats.monthsServed} / {data.stats.monthsTotal} mo.</span></div>
              <div className="prog-track"><div className="prog-fill" style={{ width: `${data.stats.overallProgress}%` }} /></div>
            </div>
            <div className="sec-lbl" style={{ marginTop: 14 }}>Current Area — {data.location.areaDescription}</div>
            <div className="prog-track"><div className="prog-fill" style={{ width: `${data.stats.areaProgress}%` }} /></div>
            <div className="sec-lbl" style={{ marginTop: 14 }}>This Week's Goal</div>
            <div className="prog-track"><div className="prog-fill" style={{ width: `${Math.round((data.stats.weeklyGoalDiscussions / data.stats.weeklyGoalTarget) * 100)}%` }} /></div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 10px' }}><div className="card-title">Mission Map</div></div>
            <MissionMap
              mapBoundaries={data.mapBoundaries}
              currentLat={data.location.lat}
              currentLng={data.location.lng}
              currentArea={data.location.areaDescription}
            />
          </div>
        </div>

        <div className="g2" style={{ marginBottom: 22 }}>
          <div className="card">
            <div className="card-hd"><div className="card-title">Latest Update</div><div className="badge">Week {latestPost?.week ?? '--'}</div></div>
            <div className="post-date">{latestPost?.date}</div>
            <div className="post-title">{latestPost?.title}</div>
            <div className="post-body">{latestPost?.body.slice(0, 180)}...</div>
            <button className="btn bn" onClick={() => go('/updates')}>Read Full Update</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card card-dark">
              <div className="card-title">This Week's Scripture</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>“{data.scripture.text}”</div>
              <div style={{ marginTop: 8, color: 'var(--gold-light)' }}>— {data.scripture.reference}</div>
            </div>
            <div className="card">
              <div className="card-title">Mission Timeline</div>
              <div className="tl">
                {data.timeline.map((t) => <div key={t.id} className={`tl-item ${t.status === 'current' ? 'now' : t.status}`}><div className="tl-date">{t.date}</div><div className="tl-text">{t.event}</div></div>)}
              </div>
            </div>
          </div>
        </div>

        <div className="g2">
          <div className="card">
            <div className="card-title">Recent Photos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {data.photos.slice(0, 6).map((p) => (
                <button onClick={() => go('/photos')} key={p.id} style={{ aspectRatio: '1', borderRadius: 7, overflow: 'hidden', display: 'grid', placeItems: 'center', textDecoration: 'none', padding: 0, border: 'none', background: 'transparent' }}>
                  {p.imageData ? <img src={p.imageData} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: p.bg, display: 'grid', placeItems: 'center' }}>{p.emoji}</div>}
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-title">Stay Connected</div>
            <p style={{ color: 'var(--muted)' }}>Letters and emails mean the world to missionaries. Send Elder Gledhill a word of support!</p>
            <div className="actions">
              <button className="btn bn bfull" onClick={() => go('/contact')}>Send a Letter</button>
              <button className="btn bo bfull" onClick={() => go('/contact')}>Subscribe to Updates</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
