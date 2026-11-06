#!/usr/bin/env python3
"""Build lighthouse/index.html from the ordered fragments in lighthouse/src/.

The fragments are concatenated in order, then the three.js CDN tag is swapped
for the library itself, so the finished file runs with no network connection.

    npm install                  # fetches three.js into node_modules
    python3 lighthouse/build.py  # writes lighthouse/index.html

    python3 lighthouse/build.py --embed OUT.html
        also writes a copy without the <html>/<head>/<body> wrapper, for hosts
        that supply their own document skeleton.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'src')

PARTS = [
    '00_head.html',      # markup and all CSS
    '10_core.js',        # helpers, tuning tables, procedural audio
    '20_world.js',       # renderer, sky, sea, island, props, the tower
    '30_light.js',       # beam, reflectors, lanterns, flares, lightning, particles
    '40_monsters.js',    # creature models, behaviour, burning, embers
    '50_workshop.js',    # daytime building and upgrades
    '60_hud.js',         # HUD, keeper's log, radar
    '70_menu.js',        # title, settings, pause, end screens
    '90_main.js',        # the night cycle, input, camera, loop
    '99_tail.html',
]

CDN_TAG = ('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/'
           'r128/three.min.js"></script>')
THREE_PATH = os.path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js')
OUT_PATH = os.path.join(HERE, 'index.html')


def main():
    html = ''.join(open(os.path.join(SRC, p), encoding='utf-8').read() for p in PARTS)

    if CDN_TAG not in html:
        sys.exit('build failed: the three.js script tag in 00_head.html no longer '
                 'matches the tag this script looks for')
    if not os.path.exists(THREE_PATH):
        sys.exit('build failed: %s is missing - run `npm install` first' % THREE_PATH)

    three = open(THREE_PATH, encoding='utf-8').read()
    inline = ('<script>\n/*! three.js r128 | (c) 2010-2021 three.js authors | MIT License |'
              ' https://threejs.org */\n' + three + '\n</script>')
    out = html.replace(CDN_TAG, inline)
    with open(OUT_PATH, 'w', encoding='utf-8') as fh:
        fh.write(out)
    print('wrote %s (%d KB, three.js inlined)'
          % (os.path.relpath(OUT_PATH, ROOT), len(out.encode('utf-8')) // 1024))

    if '--embed' in sys.argv:
        dest = sys.argv[sys.argv.index('--embed') + 1]
        body = out
        for pat in (r'<!DOCTYPE html>\s*', r'<html[^>]*>\s*', r'<head>\s*', r'</head>\s*',
                    r'<body>\s*', r'</body>\s*', r'</html>\s*',
                    r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*'):
            body = re.sub(pat, '', body, count=1)
        with open(dest, 'w', encoding='utf-8') as fh:
            fh.write(body)
        print('wrote %s (no document wrapper)' % dest)


if __name__ == '__main__':
    main()
