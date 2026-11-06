/**
 * Draws every icon and splash image from one SVG design, so they always match.
 *
 *   node scripts/make-icons.js
 *
 * Writes:
 *   assets/coinleaf.icon/            iOS 26 layered (Liquid Glass) app icon
 *   assets/images/icon.png           1024² opaque icon (App Store fallback, web)
 *   assets/images/splash-icon.png    white mark for the launch screen
 *   assets/images/favicon.png        web favicon
 *   assets/images/android-icon-*.png Android adaptive icon layers
 *
 * Needs Playwright's Chromium (preinstalled in CI images; otherwise
 * `npx playwright install chromium`). PNGs that must not have an alpha channel
 * are flattened with Python's Pillow when it's available.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const IMAGES = path.join(ROOT, 'assets', 'images');
const ICON_DIR = path.join(ROOT, 'assets', 'coinleaf.icon');

const GREEN_TOP = '#16A87A';
const GREEN_BOTTOM = '#0B6E4F';

/**
 * The mark: a coin with a leaf cut out of it and a vein running through the leaf.
 * Drawn in a 660×660 box; `fill` colors the coin, the leaf is a hole.
 */
function markPaths() {
  const c = 330; // centre
  const r = 318; // coin radius
  const rim = 30; // width of the raised rim
  // Coin disc, then an inner ring cut-out, then the inner disc again: a rimmed coin.
  const circle = (rad) => `M${c - rad},${c} a${rad},${rad} 0 1,0 ${rad * 2},0 a${rad},${rad} 0 1,0 ${-rad * 2},0 Z`;
  const coin = `${circle(r)} ${circle(r - rim)} ${circle(r - rim - 16)}`;
  // Leaf from lower-left to upper-right.
  const leaf = 'M180,486 C160,330 296,190 490,170 C506,364 362,500 180,486 Z';
  // Midrib: a thin tapered crescent curving along the leaf.
  const vein = 'M212,458 Q300,340 462,198 Q312,352 224,470 Z';
  return { coin, leaf, vein };
}

function markSvg({ fill = '#FFFFFF', size = 660 } = {}) {
  const { coin, leaf, vein } = markPaths();
  return `<svg width="${size}" height="${size}" viewBox="0 0 660 660" xmlns="http://www.w3.org/2000/svg">
  <path fill="${fill}" fill-rule="evenodd" d="${coin} ${leaf}"/>
  <path fill="${fill}" d="${vein}"/>
</svg>`;
}

function iconHtml({ size, background = true, markScale = 0.645, fill = '#FFFFFF' }) {
  const mark = Math.round(size * markScale);
  const bg = background
    ? `background: linear-gradient(160deg, ${GREEN_TOP} 0%, ${GREEN_BOTTOM} 100%);`
    : 'background: transparent;';
  return `<!doctype html><html><body style="margin:0">
<div style="width:${size}px;height:${size}px;${bg}display:flex;align-items:center;justify-content:center">
  <div style="width:${mark}px;height:${mark}px;filter:${background ? 'drop-shadow(0 ' + size * 0.012 + 'px ' + size * 0.02 + 'px rgba(0,40,25,0.35))' : 'none'}">
    ${markSvg({ fill, size: mark })}
  </div>
</div></body></html>`;
}

async function render(page, html, size, file, { transparent = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}

function flattenAlpha(file) {
  try {
    execFileSync('python3', ['-c', `from PIL import Image; im = Image.open(${JSON.stringify(file)}).convert('RGB'); im.save(${JSON.stringify(file)})`]);
  } catch {
    console.warn(`Could not strip the alpha channel from ${file} (needs Python + Pillow).`);
  }
}

(async () => {
  fs.mkdirSync(path.join(ICON_DIR, 'Assets'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  // App icon: Apple rejects icons with an alpha channel, so flatten it.
  const icon = path.join(IMAGES, 'icon.png');
  await render(page, iconHtml({ size: 1024 }), 1024, icon);
  flattenAlpha(icon);

  // Launch screen mark: white on transparent; the splash background is green.
  await render(page, iconHtml({ size: 1024, background: false, markScale: 0.9 }), 1024, path.join(IMAGES, 'splash-icon.png'), { transparent: true });

  // Favicon.
  await render(page, iconHtml({ size: 48 }), 48, path.join(IMAGES, 'favicon.png'));

  // Android adaptive icon: the system crops to a circle/squircle within the middle
  // two-thirds, so the mark is kept small.
  await render(page, iconHtml({ size: 1024, background: false, markScale: 0.42 }), 1024, path.join(IMAGES, 'android-icon-foreground.png'), { transparent: true });
  await render(page, iconHtml({ size: 1024, background: false, markScale: 0.42 }), 1024, path.join(IMAGES, 'android-icon-monochrome.png'), { transparent: true });
  await render(page, `<!doctype html><body style="margin:0"><div style="width:1024px;height:1024px;background:linear-gradient(160deg, ${GREEN_TOP}, ${GREEN_BOTTOM})"></div>`, 1024, path.join(IMAGES, 'android-icon-background.png'));
  flattenAlpha(path.join(IMAGES, 'android-icon-background.png'));

  await browser.close();

  // iOS 26 layered icon (the format Icon Composer saves). The system adds the
  // glass, depth and the dark/tinted variants from these layers.
  fs.writeFileSync(path.join(ICON_DIR, 'Assets', 'coinleaf-mark.svg'), markSvg() + '\n');
  const hex = (h) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(5)).join(',');
  const iconJson = {
    fill: { 'automatic-gradient': `extended-srgb:${hex('#0E8A63')},1.00000` },
    groups: [
      {
        layers: [
          {
            'image-name': 'coinleaf-mark.svg',
            name: 'coinleaf-mark',
            position: { scale: 1, 'translation-in-points': [0, 0] },
          },
        ],
        shadow: { kind: 'neutral', opacity: 0.5 },
        translucency: { enabled: true, value: 0.5 },
      },
    ],
    'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
  };
  fs.writeFileSync(path.join(ICON_DIR, 'icon.json'), JSON.stringify(iconJson, null, 2) + '\n');
  console.log('Icons written.');
})();
