import { useMemo, useState } from 'react';
import type { SiteData } from '../../types';

interface UpdatesPageProps {
  data: SiteData;
}

function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function UpdatesPage({ data }: UpdatesPageProps) {
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<'all' | '2025' | '2024'>('all');

  const posts = useMemo(() => {
    return [...data.posts]
      .sort((a, b) => b.id - a.id)
      .filter((p) => {
        const hay = `${p.title} ${p.body} ${p.date} ${p.tags.join(' ')}`.toLowerCase();
        const matchesQuery = !query || hay.includes(query.toLowerCase());
        const matchesYear = yearFilter === 'all' || p.date.includes(yearFilter);
        return matchesQuery && matchesYear;
      });
  }, [data.posts, query, yearFilter]);

  const sharePost = async (post: SiteData['posts'][number]) => {
    const shareText = `${post.title} — ${post.date}`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: shareText, url: shareUrl });
        return;
      } catch {
        // fall back to clipboard
      }
    }

    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
  };

  return (
    <main id="main-content" tabIndex={-1}>
      <section className="hero">
        <div className="hero-in">
          <div className="eyebrow">Weekly Letters Home</div>
          <h1>Mission <em>Updates</em></h1>
          <p>Every week Elder Gledhill shares what he is learning, who he is teaching, and the miracles happening in Idaho Falls.</p>
        </div>
      </section>

      <div className="wrap" style={{ maxWidth: 780 }}>
        <div className="filter-bar">
          <input className="fi" placeholder="Search updates..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className={`chip ${yearFilter === 'all' ? 'on' : ''}`} onClick={() => setYearFilter('all')}>All</button>
          <button className={`chip ${yearFilter === '2025' ? 'on' : ''}`} onClick={() => setYearFilter('2025')}>2025</button>
          <button className={`chip ${yearFilter === '2024' ? 'on' : ''}`} onClick={() => setYearFilter('2024')}>2024</button>
        </div>

        {posts.map((post, index) => (
          <article key={post.id} className="post" style={{ animationDelay: `${index * 80}ms` }}>
            <div className="post-hd">
              <div className="wk-b">Week {post.week}</div>
              <div>
                <div className="post-date">{post.date}</div>
                <div className="post-title">{post.title}</div>
                <div className="post-loc">{post.location}</div>
                <div className="post-date">~{readingTime(post.body)} min read</div>
              </div>
            </div>
            <div className="post-body">
              {post.body.split('\n\n').map((p, idx) => <p key={idx}>{p}</p>)}
            </div>
            <div className="post-tags">
              {post.tags.map((tag) => <span className="tag" key={`${post.id}-${tag}`}>{tag}</span>)}
              <button className="chip" onClick={() => void sharePost(post)}>Share</button>
            </div>
            <div className="post-ft">“{post.scripture}”<span>{post.scriptureRef}</span></div>
          </article>
        ))}
      </div>
    </main>
  );
}
