import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / 'data.json'
TARGET = ROOT / 'data' / 'content.json'


def main() -> None:
    if not LEGACY.exists():
        raise SystemExit('Legacy data.json not found')

    legacy = json.loads(LEGACY.read_text(encoding='utf-8'))

    transformed = {
        'site': {
            'title': f"Elder {legacy.get('missionary', {}).get('lastName', 'Mission')} Portal",
            'subtitle': 'Secure mission updates for approved viewers',
            'missionName': legacy.get('missionary', {}).get('missionName', 'Mission')
        },
        'profile': {
            'firstName': legacy.get('missionary', {}).get('firstName', ''),
            'lastName': legacy.get('missionary', {}).get('lastName', ''),
            'bio': legacy.get('missionary', {}).get('bio', ''),
            'testimony': legacy.get('missionary', {}).get('testimony', '')
        },
        'updates': [
            {
                'id': str(item.get('id', '')),
                'title': item.get('title', ''),
                'date': item.get('date', ''),
                'body': item.get('body', ''),
                'visibility': 'approved'
            }
            for item in legacy.get('posts', [])
        ],
        'map': {
            'boundary': legacy.get('mapBoundaries', {}).get('missionBoundary', []),
            'currentArea': legacy.get('location', {}).get('areaDescription', '')
        },
        'photos': [
            {
                'id': str(photo.get('id', '')),
                'title': photo.get('title', ''),
                'url': photo.get('imageData', ''),
                'visibility': 'approved'
            }
            for photo in legacy.get('photos', [])
        ],
        'settings': {
            'adminEmails': ['admin@example.com'],
            'requireApproval': True
        }
    }

    TARGET.write_text(json.dumps(transformed, indent=2), encoding='utf-8')
    print(f'Migrated legacy data -> {TARGET}')


if __name__ == '__main__':
    main()
