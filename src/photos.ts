export interface Photo {
  url: string;
  caption: string;
}

export class PhotoManager {
  private photos: Photo[] = [];

  addPhoto(file: File, caption: string) {
    // For demo: use local URL. Replace with upload logic for real backend.
    const url = URL.createObjectURL(file);
    this.photos.push({ url, caption });
    this.renderPhotoGallery();
  }

  renderPhotoGallery() {
    const gallery = document.getElementById('photo-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';
    this.photos.forEach(photo => {
      const div = document.createElement('div');
      div.className = 'photo-item';
      div.innerHTML = `<img src="${photo.url}" alt="Photo"><p>${photo.caption}</p>`;
      gallery.appendChild(div);
    });
  }
}
