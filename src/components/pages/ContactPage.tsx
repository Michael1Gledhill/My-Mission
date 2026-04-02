import { useState } from 'react';
import type { SiteData } from '../../types';

interface ContactPageProps {
  data: SiteData;
  onMessageSubmit: (payload: { name: string; email: string; relation: string; message: string }) => void;
  onSubscribe: (email: string, relation: string) => void;
}

export function ContactPage({ data, onMessageSubmit, onSubscribe }: ContactPageProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('Friend from home');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [subEmail, setSubEmail] = useState('');

  const emailCopy = `To: ${data.missionary.firstName} ${data.missionary.lastName}\nFrom: ${firstName} ${lastName} (${email})\nRelation: ${relation}\n\n${message}`;

  return (
    <main id="main-content" tabIndex={-1}>
      <section className="hero">
        <div className="hero-in">
          <div className="eyebrow">Reach Out</div>
          <h1>Contact & <em>Letters</em></h1>
          <p>Letters from home mean the world to missionaries. Send Elder Gledhill a message of support.</p>
        </div>
      </section>

      <div className="wrap">
        <div className="g2">
          <div className="card">
            <div className="card-title">Send a Message</div>
            <div className="fr">
              <div className="fg"><label>First Name</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="fg"><label>Last Name</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <div className="fg"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="fg"><label>How do you know Elder Gledhill?</label><select value={relation} onChange={(e) => setRelation(e.target.value)}><option>Family member</option><option>Friend from home</option><option>Friend from school</option><option>Ward member</option><option>Found this site online</option><option>Other</option></select></div>
            <div className="fg"><label>Your Message</label><textarea value={message} onChange={(e) => setMessage(e.target.value)} /></div>
            <div className="actions">
              <button className="btn bn" onClick={() => {
                if (!firstName || !email || !message) return;
                onMessageSubmit({ name: `${firstName} ${lastName}`.trim(), email, relation, message });
                setSuccess(true);
                setTimeout(() => setSuccess(false), 5000);
                setFirstName('');
                setLastName('');
                setEmail('');
                setMessage('');
              }}>Send My Message</button>
              <button className="btn bo" onClick={() => void navigator.clipboard.writeText(emailCopy)}>Copy as email text</button>
            </div>
            {success && <div className="success-msg" style={{ display: 'block' }}>Message sent! Elder Gledhill's family will forward it to him. Thank you!</div>}
          </div>

          <div>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Other Ways to Connect</div>
              <div className="cm"><div className="cm-ico">📧</div><div><div className="cm-t">Email (Mondays only)</div><div className="cm-d">Missionaries can receive and send emails on Preparation Day only.</div></div></div>
              <div className="cm"><div className="cm-ico">📮</div><div><div className="cm-t">Physical Mail</div><div className="cm-d">Letters and cards to the mission home. Allow 1–2 weeks.</div></div></div>
              <div className="cm"><div className="cm-ico">📞</div><div><div className="cm-t">Phone / Video Calls</div><div className="cm-d">Christmas and Mother's Day only.</div></div></div>
              <div className="cm"><div className="cm-ico">📦</div><div><div className="cm-t">Care Packages</div><div className="cm-d">Coordinate with family first.</div></div></div>
            </div>
            <div className="addr">
              <div className="addr-t">Mailing Address</div>
              <div className="addr-body">Elder {data.missionary.firstName} {data.missionary.lastName}<br />Idaho Idaho Falls Mission<br />3350 Merlin Drive<br />Idaho Falls, ID 83404<br />United States</div>
            </div>
            <div className="sub-strip">
              <h3>Get Weekly Updates</h3>
              <p>Elder Gledhill's letter delivered to your inbox every Monday.</p>
              <div className="sub-form">
                <input type="email" value={subEmail} onChange={(e) => setSubEmail(e.target.value)} placeholder="your@email.com" />
                <button onClick={() => { if (!subEmail) return; onSubscribe(subEmail, 'Website'); setSubEmail(''); }}>Subscribe</button>
              </div>
            </div>
          </div>
        </div>

        <div className="quote-bar">"And now, my beloved brethren, I know by this that unless a man shall endure to the end..."<span className="q-ref">2 Nephi 31:16</span></div>
      </div>
    </main>
  );
}
