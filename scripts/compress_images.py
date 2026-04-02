#!/usr/bin/env python3
"""Compress images and add to public/data.json as base64."""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

MAX_DIM = 1200
QUALITY = 75
RESAMPLING_LANCZOS = getattr(getattr(Image, 'Resampling', Image), 'LANCZOS')


def compress_image(image_path: str) -> str:
    """Return base64 data URL of compressed JPEG."""
    img = Image.open(image_path).convert('RGB')
    w, h = img.size
    if w > MAX_DIM:
        h = int(h * MAX_DIM / w)
        w = MAX_DIM
    if h > MAX_DIM:
        w = int(w * MAX_DIM / h)
        h = MAX_DIM
    img = img.resize((w, h), RESAMPLING_LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=QUALITY, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"


def add_photo(image_path: str, title: str, album: str, desc: str = '') -> None:
    data_path = Path('public/data.json')
    if not data_path.exists():
        raise FileNotFoundError('public/data.json not found')

    data = json.loads(data_path.read_text(encoding='utf-8'))
    photos = data.setdefault('photos', [])
    max_id = max((p.get('id', 0) for p in photos), default=0)
    data_url = compress_image(image_path)

    photo = {
        'id': max_id + 1,
        'title': title,
        'desc': desc,
        'album': album,
        'date': album,
        'imageData': data_url,
        'bg': 'linear-gradient(135deg,#b8d4f0,#7aaad8)',
        'emoji': '',
        'span': ''
    }

    photos.insert(0, photo)
    data_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    size_kb = len(data_url) // 1024
    print(f"✓ Added '{title}' to {album} ({size_kb}KB)")


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print('Usage: python scripts/compress_images.py <image.jpg> <title> <album> [desc]')
        sys.exit(1)
    add_photo(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else '')
