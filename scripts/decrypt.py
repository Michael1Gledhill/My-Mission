import argparse
import base64
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Decrypt JSON encrypted by encrypt.py')
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
        blob = json.load(f)

    nonce = base64.b64decode(blob['nonce'])
    tag = base64.b64decode(blob['tag'])
    ciphertext = base64.b64decode(blob['ciphertext'])

    aes = AESGCM(key)
    plain = aes.decrypt(nonce, ciphertext + tag, None)
    decoded = json.loads(plain.decode('utf-8'))

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(decoded, f, indent=2)


if __name__ == '__main__':
    main()
