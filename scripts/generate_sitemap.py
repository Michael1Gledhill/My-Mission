#!/usr/bin/env python3
"""Generate sitemap.xml for GitHub Pages deployment."""
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree

BASE_URL = 'https://your-username.github.io/mission-site'
ROUTES = ['/', '/updates', '/photos', '/about', '/contact', '/admin']


def generate(output_path: str = 'public/sitemap.xml') -> None:
    urlset = Element('urlset')
    urlset.set('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')

    for route in ROUTES:
        url = SubElement(urlset, 'url')
        loc = SubElement(url, 'loc')
        loc.text = f"{BASE_URL}{route}"

    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    ElementTree(urlset).write(target, encoding='utf-8', xml_declaration=True)
    print(f'✓ Generated {output_path} with {len(ROUTES)} routes')


if __name__ == '__main__':
    generate()
