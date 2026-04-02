import { useState } from 'react';
import { MissionContent } from '../../types';

interface ContactPageProps {
  content: MissionContent;
}

export function ContactPage({ content }: ContactPageProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    relation: 'Friend'
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Contact form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => {
      setFormData({ name: '', email: '', message: '', relation: 'Friend' });
      setSubmitted(false);
    }, 5000);
  };

  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="grid">
        <div className="card">
          <h2 className="card-title">Contact & Support</h2>
          <form onSubmit={handleSubmit}>
            <div className="fg">
              <label>Name *</label>
              <input
                required
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="fg">
              <label>Email *</label>
              <input
                required
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="fg">
              <label>Relation to Missionary</label>
              <select
                value={formData.relation}
                onChange={(e) => setFormData({ ...formData, relation: e.target.value })}
              >
                <option>Friend</option>
                <option>Family</option>
                <option>Ward Member</option>
                <option>Other</option>
              </select>
            </div>
            <div className="fg">
              <label>Message *</label>
              <textarea
                required
                placeholder="Write your message here..."
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>
            {submitted ? (
              <div style={{ padding: '16px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px', color: '#155724' }}>
                ✓ Message sent! Thank you for your support.
              </div>
            ) : (
              <button type="submit" className="bn bgold">Send Message</button>
            )}
          </form>
        </div>

        <div>
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', color: 'var(--navy)' }}>Contact Methods</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>✉️</span>
                <span>Send letters through the church mailing system</span>
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>📱</span>
                <span>Contact family members for direct communication</span>
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>🙏</span>
                <span>Include {content.profile.firstName} in your prayers</span>
              </p>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '16px', color: 'var(--navy)' }}>Mailing Address</h3>
            <div style={{ backgroundColor: '#f9f9f9', padding: '16px', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{content.profile.firstName} {content.profile.lastName}</p>
              <p style={{ margin: '0 0 8px 0' }}>{content.site.missionName}</p>
              <p style={{ margin: '0' }}>Church of Jesus Christ of Latter-day Saints</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
