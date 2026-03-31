import { PhotoManager } from './photos';

// Example: initialize and render
const photoManager = new PhotoManager();

window.addEventListener('DOMContentLoaded', () => {
  // Render photos on page load
  photoManager.renderPhotoGallery();

  // Set up photo upload form
  const form = document.getElementById('photo-upload-form') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('photo-file') as HTMLInputElement;
      const captionInput = document.getElementById('photo-caption') as HTMLInputElement;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        photoManager.addPhoto(fileInput.files[0], captionInput.value);
        form.reset();
      }
    });
  }
});
