<#
Build index.html from the ordered fragments in src/ — a faithful port of
build.py for machines with PowerShell but no Python.

The fragments are concatenated in the order listed below, then the three.js CDN
tag is swapped for the library itself, so the finished file is fully
self-contained and runs with no network connection.

    npm install                        # fetches three.js into node_modules
    powershell -File src/build.ps1     # writes index.html at the repo root

Output is written with LF endings and no BOM so it matches build.py byte for
byte; keep the two in step if either is edited.
#>

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here

$parts = @(
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
  '99_tail.html'
)

$cdnTag = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/' +
          'r128/three.min.js"></script>'
$threePath = Join-Path $root 'node_modules\three\build\three.min.js'
$outPath = Join-Path $root 'index.html'

$sb = New-Object Text.StringBuilder
foreach ($p in $parts) {
  $null = $sb.Append([IO.File]::ReadAllText((Join-Path $here $p)))
}
$html = $sb.ToString()

if (-not $html.Contains($cdnTag)) {
  throw 'build failed: the three.js script tag in 00_head.html no longer matches the tag this script looks for'
}
if (-not (Test-Path $threePath)) {
  throw "build failed: $threePath is missing - run ``npm install`` first"
}

$three = [IO.File]::ReadAllText($threePath)
$inline = "<script>`n" +
          '/*! three.js r128 | (c) 2010-2021 three.js authors | MIT License | https://threejs.org */' +
          "`n" + $three + "`n</script>"

$out = $html.Replace($cdnTag, $inline)
[IO.File]::WriteAllText($outPath, $out, (New-Object Text.UTF8Encoding $false))

$kb = [Text.Encoding]::UTF8.GetByteCount($out) / 1024
"wrote index.html ({0:N0} KB, three.js inlined)" -f [Math]::Floor($kb)
