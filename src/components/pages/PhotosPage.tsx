import { useMemo, useState } from 'react';
import type { Photo, SiteData } from '../../types';

interface PhotosPageProps {
  data: SiteData;
}

export function PhotosPage({ data }: PhotosPageProps) {
  const albums = useMemo(() => Array.from(new Set(data.photos.map((p) => p.album))), [data.photos]);
  const [filter, setFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Photo | null>(null);

  const visiblePhotos = useMemo(
    () => (filter === 'all' ? data.photos : data.photos.filter((p) => p.album === filter)),
    [data.photos, filter]
  );

  const grouped = useMemo(() => {
    return albums
      .map((album) => ({ album, photos: visiblePhotos.filter((p) => p.album === album) }))
      .filter((group) => group.photos.length > 0);
  }, [albums, visiblePhotos]);

  return (
    <main id="main-content" tabIndex={-1}>
      <section className="hero">
        <div className="hero-in">
          <div className="eyebrow">Mission Memories</div>
          <h1>Photo <em>Gallery</em></h1>
          <p>Snapshots from Elder Gledhill's mission in Idaho — the people, places, and moments that make up two years of service.</p>
        </div>
      </section>

      <div className="wrap">
        <div className="filter-bar">
          <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All Photos</button>
          {albums.map((album) => (
            <button key={album} className={`chip ${filter === album ? 'on' : ''}`} onClick={() => setFilter(album)}>{album}</button>
          ))}
        </div>

        {grouped.map((group) => (
          <section key={group.album}>
            <div className="album-hd">
              <div className="album-title">{group.album}</div>
              <div className="album-date">{group.photos.length} photos</div>
              <div className="album-div" />
            </div>
            <div className="photo-grid">
              {group.photos.map((p) => (
                <div key={p.id} className={`ph ${p.span || ''}`} onClick={() => setSelected(p)}>
                  {p.imageData ? (
                    <img src={p.imageData} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="ph-inner" style={{ background: p.bg }}>{p.emoji}</div>
                  )}
                  <div className="ph-cap">
                    <div className="ph-cap-t">{p.title}</div>
                    <div className="ph-cap-d">{p.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className={`lb ${selected ? 'on' : ''}`} onClick={(e) => e.currentTarget === e.target && setSelected(null)}>
        <button className="lb-close" onClick={() => setSelected(null)} aria-label="Close photo lightbox">✕</button>
        {selected && (
          <div className="lb-box">
            <div className="lb-img" style={selected.imageData ? { backgroundImage: `url(${selected.imageData})` } : { background: selected.bg }}>{selected.imageData ? '' : selected.emoji}</div>
            <div className="lb-info">
              <div className="lb-title">{selected.title}</div>
              <div className="lb-desc">{selected.desc} · {selected.date}</div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
