#!/usr/bin/env python3
"""
Fix: adds https://m.media-amazon.com to CSP connect-src in web/index.html
This allows Amazon product images to load in Flutter web.
Also adds https://*.media-amazon.com for future-proofing.
Run from repo root: python3 fix_csp.py
"""
import os, shutil

TARGET = '/workspaces/MiniGuru-App/app/miniguru/web/index.html'

with open(TARGET, 'r') as f:
    content = f.read()

shutil.copy(TARGET, TARGET + '.bak')

# Add Amazon image CDN to connect-src
OLD = "https://firebasestorage.googleapis.com\""
NEW = "https://firebasestorage.googleapis.com https://m.media-amazon.com https://*.media-amazon.com\""

if OLD in content:
    content = content.replace(OLD, NEW)
    with open(TARGET, 'w') as f:
        f.write(content)
    print('✅ CSP updated — Amazon image URLs now allowed')
else:
    print('⚠️  Pattern not found — check index.html manually')
    # Show current connect-src
    for i, line in enumerate(content.splitlines()):
        if 'connect-src' in line:
            print(f'Line {i+1}: {line.strip()[:200]}')
