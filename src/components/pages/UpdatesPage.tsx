import { MissionContent } from '../../types';

interface UpdatesPageProps {
  content: MissionContent;
}

export function UpdatesPage({ content }: UpdatesPageProps) {
  const publicUpdates = content.updates.filter((u) => u.visibility === 'public');

  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card">
        <h2 className="card-title">Mission Updates</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
          Follow {content.profile.firstName}'s mission journey through weekly updates
        </p>

        {publicUpdates.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px' }}>
            No updates available yet.
          </p>
        ) : (
          <div>
            {publicUpdates.map((update, idx) => (
              <article key={update.id} className="post" style={{ marginBottom: '24px', animation: `fadeUp 0.35s ease ${idx * 0.08}s both` }}>
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
        )}
      </div>
    </main>
  );
}
