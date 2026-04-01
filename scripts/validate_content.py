import argparse
import json
from jsonschema import validate

SCHEMA = {
    'type': 'object',
    'required': ['site', 'profile', 'updates', 'map', 'photos', 'settings'],
    'properties': {
        'site': {
            'type': 'object',
            'required': ['title', 'subtitle', 'missionName']
        },
        'profile': {
            'type': 'object',
            'required': ['firstName', 'lastName', 'bio', 'testimony']
        },
        'updates': {
            'type': 'array'
        },
        'map': {
            'type': 'object',
            'required': ['boundary', 'currentArea']
        },
        'photos': {
            'type': 'array'
        },
        'settings': {
            'type': 'object',
            'required': ['adminEmails', 'requireApproval']
        }
    }
}


def main() -> None:
    parser = argparse.ArgumentParser(description='Validate mission content schema')
    parser.add_argument('--file', required=True)
    args = parser.parse_args()

    with open(args.file, 'r', encoding='utf-8') as f:
        payload = json.load(f)

    validate(instance=payload, schema=SCHEMA)
    print(f'Validation successful: {args.file}')


if __name__ == '__main__':
    main()
