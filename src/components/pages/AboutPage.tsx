import type { SiteData } from '../../types';

interface AboutPageProps {
  data: SiteData;
}

export function AboutPage({ data }: AboutPageProps) {
  const m = data.missionary;

  return (
    <main id="main-content" tabIndex={-1}>
      <section className="profile-hero">
        <div className="avatar">👤</div>
        <div>
          <div className="eyebrow">Servant of the Lord</div>
          <div className="pi-name">Elder <em>{m.firstName}</em> {m.lastName}</div>
          <div className="pi-sub">Serving a full-time mission for The Church of Jesus Christ of Latter-day Saints.</div>
          <div className="chips">
            <span className="chip-sm">{data.location.city}, {data.location.state}</span>
            <span className="chip-sm">{new Date(m.startDate).getFullYear()} – {new Date(m.endDate).getFullYear()}</span>
            <span className="chip-sm">LDS Missionary</span>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="facts-row">
          <div className="fact"><div className="fact-ico">🏠</div><div className="fact-v">{m.hometown}</div><div className="fact-l">Hometown</div></div>
          <div className="fact"><div className="fact-ico">🎂</div><div className="fact-v">{m.age}</div><div className="fact-l">Age</div></div>
          <div className="fact"><div className="fact-ico">🎓</div><div className="fact-v">{m.collegePlans}</div><div className="fact-l">College Plans</div></div>
          <div className="fact"><div className="fact-ico">⛪</div><div className="fact-v">Lifelong</div><div className="fact-l">Member</div></div>
        </div>

        <div className="g2" style={{ marginBottom: 22 }}>
          <div className="card">
            <div className="card-title">My Story</div>
            <div style={{ marginTop: 8 }}>{m.bio.split('\n').map((p, i) => <p key={i} style={{ marginBottom: 10 }}>{p}</p>)}</div>
          </div>
          <div className="card">
            <div className="card-title">Mission Details</div>
            <table className="info-tbl" style={{ marginTop: 10 }}>
              <tbody>
                <tr><td>Mission</td><td>{m.missionName}</td></tr>
                <tr><td>Mission President</td><td>{m.missionPresident}</td></tr>
                <tr><td>Start Date</td><td>{new Date(m.startDate).toLocaleDateString()}</td></tr>
                <tr><td>End Date</td><td>{new Date(m.endDate).toLocaleDateString()}</td></tr>
                <tr><td>Current Area</td><td>{data.location.areaDescription}</td></tr>
                <tr><td>Current Companion</td><td>{m.currentCompanion}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="testimony">
          <div className="test-title">My Testimony</div>
          <div className="test-text">{m.testimony}</div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>Hobbies & Interests</div>
          <div className="interests">{m.hobbies.map((h) => <span key={h} className="interest">{h}</span>)}</div>
        </div>
      </div>
    </main>
  );
}
