import { MissionContent } from '../../types';

interface AboutPageProps {
  content: MissionContent;
}

export function AboutPage({ content }: AboutPageProps) {
  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card" style={{ marginBottom: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '80px', marginBottom: '16px' }}>👤</div>
          <h2 className="card-title" style={{ marginBottom: '8px' }}>
            {content.profile.firstName} {content.profile.lastName}
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--gold)', marginBottom: '16px' }}>
            {content.site.missionName}
          </p>
          <p style={{ color: 'var(--muted)', maxWidth: '600px', margin: '0 auto' }}>
            {content.profile.bio}
          </p>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3 style={{ marginBottom: '16px', color: 'var(--navy)' }}>About the Mission</h3>
          <p style={{ marginBottom: '12px' }}>
            <strong>Name:</strong> {content.site.missionName}
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>Service Period:</strong> January 2024 - January 2026
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>Current Area:</strong> {content.map.currentArea}
          </p>
          <p>
            <strong>Missionary Name:</strong> {content.profile.firstName} {content.profile.lastName}
          </p>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '16px', color: 'var(--navy)' }}>Testimony</h3>
          <blockquote className="testimonyQuote">
            "{content.profile.testimony || 'No testimony added yet.'}"
          </blockquote>
        </div>
      </div>

      <div className="card" style={{ marginTop: '32px' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--navy)' }}>Ways to Support</h3>
        <div className="grid">
          <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>✉️ Write a Letter</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
              Send encouraging letters and cards to support {content.profile.firstName}'s mission journey.
            </p>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>📱 Stay Connected</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
              Check back regularly for updates, photos, and insights from the mission field.
            </p>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>🙏 Prayers & Support</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
              Your fasting, prayers, and support are deeply appreciated during this sacred service.
            </p>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>📍 Get to Know the Area</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
              Learn about {content.site.missionName} and the communities being served.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
