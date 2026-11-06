/* =====================================================================
   Menus: title, how to play, settings, pause, the end of the watch
   ===================================================================== */

const STORE_KEY = 'lighthouse.v1';
function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORE_KEY); if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) { return {}; }
}
function savePrefs() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ quality: settings.quality, volume: settings.volume, sens: settings.sens,
      tips: settings.tips, diff: G.diff, best: G.best }));
  } catch (e) { /* private mode or blocked storage: settings just won't persist */ }
}

const UI = {
  stack: [],
  open(id) { $(id).hidden = false; this.stack.push(id); },
  close(id) { $(id).hidden = true; this.stack = this.stack.filter(x => x !== id); },
  top() { return this.stack[this.stack.length - 1]; },
};

function initMenus() {
  const prefs = loadPrefs();
  if (prefs.quality && QUALITY[prefs.quality]) settings.quality = prefs.quality;
  if (typeof prefs.volume === 'number') settings.volume = prefs.volume;
  if (typeof prefs.sens === 'number') settings.sens = prefs.sens;
  if (typeof prefs.tips === 'boolean') settings.tips = prefs.tips;
  if (typeof prefs.diff === 'number') G.diff = clamp(prefs.diff, 0, 2);
  G.best = prefs.best || 0;
  Sound.setVolume(settings.volume);

  const diffs = document.querySelectorAll('.diff');
  const showDiff = () => diffs.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.d === G.diff)));
  diffs.forEach(b => b.addEventListener('click', () => { G.diff = +b.dataset.d; showDiff(); Sound.init(); Sound.ui(); savePrefs(); }));
  showDiff();
  if (G.best) $('menu-foot').textContent = `Your longest watch: ${G.best} night${G.best === 1 ? '' : 's'}. Mouse or touch to aim the beam.`;

  $('b-start').addEventListener('click', () => { Sound.init(); Sound.ui(); UI.close('menu'); newGame(G.diff); });
  $('b-how').addEventListener('click', () => { Sound.init(); Sound.ui(); UI.open('how'); });
  $('b-how-close').addEventListener('click', () => { Sound.ui(); UI.close('how'); });
  $('b-settings').addEventListener('click', () => { Sound.init(); Sound.ui(); openSettings(); });
  $('b-set-close').addEventListener('click', () => { Sound.ui(); UI.close('settings'); savePrefs(); });

  $('set-quality').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    settings.quality = b.dataset.q; applyQuality(); showSettings(); savePrefs();
  });
  $('set-tips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    settings.tips = b.dataset.t === '1'; showSettings(); savePrefs();
  });
  $('set-vol').addEventListener('input', (e) => { settings.volume = +e.target.value; Sound.setVolume(settings.volume); });
  $('set-sens').addEventListener('input', (e) => { settings.sens = +e.target.value; });

  $('b-resume').addEventListener('click', () => { Sound.ui(); setPaused(false); });
  $('b-p-settings').addEventListener('click', () => { Sound.ui(); openSettings(); });
  $('b-p-how').addEventListener('click', () => { Sound.ui(); UI.open('how'); });
  $('b-quit').addEventListener('click', () => { Sound.ui(); setPaused(false); toTitle(); });
}
function openSettings() { showSettings(); UI.open('settings'); }
function showSettings() {
  document.querySelectorAll('#set-quality button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.q === settings.quality)));
  document.querySelectorAll('#set-tips button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.t === '1') === settings.tips)));
  $('set-vol').value = settings.volume; $('set-sens').value = settings.sens;
  $('fps-note').textContent = PERF.fps ? `Running at about ${Math.round(PERF.fps)} frames per second.` : '';
}
function applyQuality() {
  applyPixelRatio(); onResize();
  applyShadowQuality();
  rebuildSea(); rebuildGrass();
}

function setPaused(p) {
  if (p && !['night', 'day', 'dusk', 'dawn'].includes(G.state)) return;
  G.paused = p;
  if (p) {
    beam.wantFocus = false; input.focusKey = input.focusMouse = input.focusBtn = false;
    $('pause-eyebrow').textContent = G.state === 'day' ? `Day ${G.night}` : `Night ${G.night}, ${HUD.clockText()}`;
    $('pause-note').textContent = G.state === 'day' ? 'The workshop is quiet.' : 'Out on the water, nothing moves while you look away.';
    UI.open('pause');
    if (document.pointerLockElement) { input.lockExitOk = true; document.exitPointerLock(); }
  } else {
    UI.close('pause'); UI.close('settings'); UI.close('how');
  }
}

function showEnd(kind) {
  const T = G.totals;
  const kept = kind === 'won' ? G.night : G.night - 1;
  G.best = Math.max(G.best || 0, kept); savePrefs();
  $('end-eyebrow').textContent = kind === 'won' ? `${DIFFS[G.diff].name}, ${CFG.NIGHTS} nights` : `Night ${G.night}, ${HUD.clockText()}`;
  $('end-title').textContent = kind === 'won' ? 'The light held' : 'The light went out';
  $('end-note').textContent = kind === 'won'
    ? 'Seven nights, and the lamp never failed. The supply boat came at first light and found you waiting on the jetty.'
    : (kept > 0 ? `You kept it burning for ${kept} night${kept === 1 ? '' : 's'}. The sea came up the rocks in the dark.` : 'The sea came up the rocks in the dark.');
  $('end-stats').innerHTML = [
    [kept, 'Nights kept'], [T.kills + G.stats.kills, 'Burned away'], [T.embers + G.stats.embers, 'Embers gathered'],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  const btns = $('end-btns'); btns.innerHTML = '';
  const add = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.type = 'button'; b.textContent = label; b.onclick = () => { Sound.ui(); UI.close('end'); fn(); }; btns.appendChild(b); };
  if (kind === 'won') {
    add('Keep watching', 'primary', () => { G.endless = true; toDay(true); });
    add('Start over', '', () => newGame(G.diff));
  } else {
    add(`Try night ${G.night} again`, 'primary', () => retryNight());
    add('Start over', '', () => newGame(G.diff));
  }
  add('Leave the island', 'ghost', toTitle);
  UI.open('end');
}
