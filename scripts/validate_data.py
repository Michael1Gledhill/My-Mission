#!/usr/bin/env python3
"""Validates public/data.json against the expected schema before committing."""
import json
import sys
from pathlib import Path

REQUIRED_KEYS = [
    'missionary',
    'stats',
    'location',
    'scripture',
    'mapBoundaries',
    'timeline',
    'posts',
    'photos',
    'messages',
    'subscribers',
]


def validate(path: str = 'public/data.json') -> bool:
    target = Path(path)
    if not target.exists():
        print(f"VALIDATION FAILED:\n  ✗ Missing file: {path}")
        return False

    data = json.loads(target.read_text(encoding='utf-8'))
    errors: list[str] = []

    for key in REQUIRED_KEYS:
        if key not in data:
            errors.append(f"Missing top-level key: {key}")

    m = data.get('missionary', {})
    for field in ['firstName', 'lastName', 'startDate', 'endDate', 'missionName']:
        if not m.get(field):
            errors.append(f"missionary.{field} is empty")

    for post in data.get('posts', []):
        if not all(k in post for k in ['id', 'week', 'title', 'body', 'date']):
            errors.append(f"Post {post.get('id')} missing required fields")

    if errors:
        print('VALIDATION FAILED:')
        for err in errors:
            print(f"  ✗ {err}")
        return False

    posts = len(data.get('posts', []))
    photos = len(data.get('photos', []))
    print(f"✓ public/data.json valid — {posts} posts, {photos} photos")
    return True


if __name__ == '__main__':
    sys.exit(0 if validate() else 1)
