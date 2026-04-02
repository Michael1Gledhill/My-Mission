import { MissionContent } from '../../types';
import { useState } from 'react';

interface PhotosPageProps {
  content: MissionContent;
}

export function PhotosPage({ content }: PhotosPageProps) {
  const publicPhotos = content.photos.filter((p) => p.visibility === 'public');
  const [selectedPhoto, setSelectedPhoto] = useState<typeof publicPhotos[0] | null>(null);

  return (
    <main id="main-content" tabIndex={-1} className="wrap">
      <div className="card">
        <h2 className="card-title">Mission Photos</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
          View photos from {content.profile.firstName}'s mission
        </p>

        {publicPhotos.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px' }}>
            No photos available yet.
          </p>
        ) : (
          <div className="photoGrid">
            {publicPhotos.map((photo) => (
              <article
                key={photo.id}
                className="photoCard"
                title={photo.title}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedPhoto(photo)}
              >
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
        )}
      </div>

      {selectedPhoto && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', minHeight: '400px' }}>
              {selectedPhoto.url.startsWith('http') ? (
                <img src={selectedPhoto.url} alt={selectedPhoto.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '8rem' }}>{selectedPhoto.url}</span>
              )}
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid #eee' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>{selectedPhoto.title}</h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                style={{ padding: '8px 16px', backgroundColor: '#c0392b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
