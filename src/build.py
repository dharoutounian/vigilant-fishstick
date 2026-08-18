#!/usr/bin/env python3
"""Build index.html from the ordered fragments in src/.

The fragments are concatenated in the order listed below, then the three.js CDN
tag is swapped for the library itself, so the finished file is fully
self-contained and runs with no network connection.

    npm install           # fetches three.js into node_modules
    python3 src/build.py  # writes index.html at the repo root
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

PARTS = [
    '00_head.html',   # HUD markup + all CSS
    '10_core.js',     # tuning constants, difficulty table, procedural audio
    '20_world.js',    # renderer, quality presets, map, collision, A*
    '30_weapons.js',  # weapon/operator tables, viewmodel, hitscan, effects
    '40_player.js',   # input, movement, firing, grenades, spawning
    '50_bots.js',     # soldier models, bot AI, damage, sentry guns
    '60_streaks.js',  # killstreaks and progression
    '70_hud.js',      # HUD, minimap, killfeed, scoreboard
    '80_menu.js',     # menus, loadout, settings
    '90_main.js',     # match flow and the fixed-timestep loop
    '99_tail.html',
]

CDN_TAG = ('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/'
           'r128/three.min.js"></script>')
THREE_PATH = os.path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js')
OUT_PATH = os.path.join(ROOT, 'index.html')


def main():
    html = ''.join(
        open(os.path.join(HERE, p), encoding='utf-8').read() for p in PARTS
    )

    if CDN_TAG not in html:
        sys.exit('build failed: the three.js script tag in 00_head.html no longer '
                 'matches the tag this script looks for')

    if not os.path.exists(THREE_PATH):
        sys.exit('build failed: %s is missing - run `npm install` first' % THREE_PATH)

    three = open(THREE_PATH, encoding='utf-8').read()
    inline = ('<script>\n'
              '/*! three.js r128 | (c) 2010-2021 three.js authors | MIT License |'
              ' https://threejs.org */\n' + three + '\n</script>')

    out = html.replace(CDN_TAG, inline)
    with open(OUT_PATH, 'w', encoding='utf-8') as fh:
        fh.write(out)

    print('wrote %s (%d KB, three.js inlined)'
          % (os.path.relpath(OUT_PATH, ROOT), len(out.encode('utf-8')) // 1024))


if __name__ == '__main__':
    main()
