import argparse
import base64
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Encrypt JSON using AES-256-GCM')
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--key', default=os.getenv('ENCRYPTION_KEY', ''))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.key:
        raise SystemExit('ENCRYPTION_KEY (or --key) is required')

    key = bytes.fromhex(args.key)
    if len(key) != 32:
        raise SystemExit('ENCRYPTION_KEY must be 64 hex chars (32 bytes)')

    with open(args.input, 'r', encoding='utf-8') as f:
        payload = json.dumps(json.load(f), separators=(',', ':')).encode('utf-8')

    nonce = os.urandom(12)
    aes = AESGCM(key)
    encrypted = aes.encrypt(nonce, payload, None)

    tag = encrypted[-16:]
    ciphertext = encrypted[:-16]

    out = {
        'algorithm': 'aes-256-gcm',
        'nonce': base64.b64encode(nonce).decode('utf-8'),
        'tag': base64.b64encode(tag).decode('utf-8'),
        'ciphertext': base64.b64encode(ciphertext).decode('utf-8')
    }

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)


if __name__ == '__main__':
    main()
