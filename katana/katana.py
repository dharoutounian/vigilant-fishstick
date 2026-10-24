#!/usr/bin/env python3
"""
Collapsible katana for FDM printing, sized for the Anycubic Kobra S1 (250 mm cube).

Three blade segments nest inside the handle. Flick the handle and they slide out
along one shared arc (so the blade keeps a katana curve). Each segment has a collar
at its base that wedges into a taper at the mouth of the part outside it: the wedge
holds it extended and the collar can't pass the mouth, so it can't fly off. Push
the tip back in to collapse it.

Every part is modelled straight (x = blade width, spine at x=0 and edge at +x;
y = blade thickness; z = along the blade) and then bent onto the arc, so the
clearances are the same everywhere along the curve.

    pip install manifold3d numpy
    python3 katana.py              # writes stl/*.stl
    python3 katana.py --check      # also checks every sliding fit in 3D
"""

import argparse
import math
import pathlib
import sys

import numpy as np
from manifold3d import CrossSection, JoinType, Manifold, Mesh, OpType

HERE = pathlib.Path(__file__).resolve().parent

# ---- printer -------------------------------------------------------------------
MAX_PRINT_HEIGHT = 248.0  # Kobra S1 build height is 250 mm; keep a little margin
BED = 250.0

# ---- blade shape (this is the tip segment; the others are grown from it) -------
R = 3000.0  # radius of the blade curve (sori); bigger = straighter
TIP_W = 19.0  # tip segment width, spine to edge
TIP_T = 6.0  # tip segment thickness at the ridge line
SPINE_T = 2.6  # thickness at the spine
EDGE_T = 1.2  # thickness at the edge (kept blunt on purpose)
RIDGE = 0.30  # ridge line (shinogi) position, as a fraction of width from the spine

# ---- telescoping fit (all distances are per side) -------------------------------
WALL = 1.2  # blade segment wall: 3 lines with a 0.4 mm nozzle
CLEAR = 0.35  # sliding clearance between nested parts
LIP = 1.0  # how far a segment's base collar sticks out past its body
WEDGE = 8.0  # length of the collar / seat taper (LIP over WEDGE = ~7 degrees)
LAND = 15.0  # straight throat above the seat that steadies the extended segment
COLLAR = 2.0  # straight band at the bottom of each collar
STEP = WALL + CLEAR + LIP  # how much bigger each segment is than the one inside it

G_TIP = 0.0  # profile growth of each segment's body relative to the tip segment
G_MID = G_TIP + STEP
G_BASE = G_MID + STEP

# ---- lengths -------------------------------------------------------------------
HANDLE_L = 242.0  # handle body, pommel end to the top of the habaki
HABAKI_L = 27.0  # the collar above the guard
PLUG = 14.0  # pommel cap plug = height of the floor inside the handle
BLADE_L = 227.0  # the two hollow blade segments
TIP_L = 242.0  # the tip segment (sticks out of the handle a little when collapsed)
KISSAKI_L = 42.0  # length of the shaped tip

# ---- handle and fittings -------------------------------------------------------
TSUKA_WALL = 3.4  # minimum handle wall around the cavity
TSUKA_W = 40.0  # handle oval, across the blade width
TSUKA_T = 26.0  # handle oval, across the blade thickness
HABAKI_G0 = G_BASE + CLEAR + 3.5  # habaki outside, at the guard (tapers for a snug guard)
HABAKI_G1 = HABAKI_G0 - 0.25  # habaki outside, at the top
KASHIRA_T = 6.0  # pommel cap flange
PLUG_FIT = 0.2  # pommel plug clearance in the handle
PIN_AF = 5.25  # pin hole across flats (octagon), at the middle of the handle
PIN_TAPER = 0.027  # the hole and the pin both taper, like a real mekugi
PIN_L = TSUKA_T + 5.0
TSUBA_W, TSUBA_H, TSUBA_T = 76.0, 68.0, 5.5  # guard
TSUBA_FIT = 0.12  # guard hole clearance over the habaki at the shoulder
KEEPER_FIT = 0.12  # optional keeper cap over the habaki (it is straight; the habaki curves a hair)

S_FUCHI = HANDLE_L - HABAKI_L  # the shoulder the guard sits on

STATIONS_MAX_DZ = 3.0
BEND_REFINE = 4.0


# ---- blade cross-section ---------------------------------------------------------


def _tip_hexagon():
    a, t, e, xr = SPINE_T / 2, TIP_T / 2, EDGE_T / 2, RIDGE * TIP_W
    return np.array([(0, -a), (xr, -t), (TIP_W, -e), (TIP_W, e), (xr, t), (0, a)], float)


def _miter_vectors(p):
    """Per-vertex offset directions: vertex(g) = p + g * m keeps every edge parallel."""
    d = np.roll(p, -1, 0) - p
    n = np.column_stack([d[:, 1], -d[:, 0]])
    n /= np.linalg.norm(n, axis=1)[:, None]
    prev = np.roll(n, 1, 0)
    return (prev + n) / (1 + (prev * n).sum(1))[:, None]


P0 = _tip_hexagon()
M0 = _miter_vectors(P0)


def blade_profile(g):
    """The blade cross-section grown outward by g on every side (sharp corners kept)."""
    return P0 + g * M0


def blade_cs(g):
    return CrossSection([blade_profile(g)])


# ---- solid builders --------------------------------------------------------------


def loft(stations, profile=blade_profile):
    """Solid swept along z through (z, g) stations, linear in between."""
    zs, gs = [], []
    for (z0, g0), (z1, g1) in zip(stations, stations[1:]):
        n = max(1, math.ceil((z1 - z0) / STATIONS_MAX_DZ))
        for i in range(n):
            f = i / n
            zs.append(z0 + f * (z1 - z0))
            gs.append(g0 + f * (g1 - g0))
    zs.append(stations[-1][0])
    gs.append(stations[-1][1])

    k = len(P0)
    verts = np.vstack([np.column_stack([profile(g), np.full(k, z)]) for z, g in zip(zs, gs)])
    tris = []
    for r in range(len(zs) - 1):
        for j in range(k):
            a, b = r * k + j, r * k + (j + 1) % k
            c, d = b + k, a + k
            tris += [(a, b, c), (a, c, d)]
    top = (len(zs) - 1) * k
    for j in range(1, k - 1):
        tris.append((0, j + 1, j))
        tris.append((top, top + j, top + j + 1))
    m = Manifold(Mesh(vert_properties=verts.astype(np.float32), tri_verts=np.array(tris, np.uint32)))
    assert m.status().name == "NoError", m.status()
    return m


def convex_loft(cs, stations):
    """Convex outline swept through (z, inset) stations; the outline must be convex."""
    out = None
    for (z0, o0), (z1, o1) in zip(stations, stations[1:]):
        pts = []
        for z, o in ((z0, o0), (z1, o1)):
            ring = cs.offset(o, JoinType.Round) if o else cs
            for poly in ring.to_polygons():
                pts.append(np.column_stack([poly, np.full(len(poly), z)]))
        piece = Manifold.hull_points(np.vstack(pts))
        out = piece if out is None else out + piece
    return out


def extrude_xz(cs, y0, y1):
    """Extrude a CrossSection drawn in (x, z) along y."""
    m = Manifold.extrude(cs, y1 - y0)  # (X, Y, Z) with Z along the extrusion
    return m.warp_batch(lambda p: np.column_stack([p[:, 0], -p[:, 2], p[:, 1]])).translate([0, y1, 0])


def extrude_yz(cs, x0, x1):
    """Extrude a CrossSection drawn in (y, z) along x."""
    m = Manifold.extrude(cs, x1 - x0)
    return m.warp_batch(lambda p: np.column_stack([p[:, 2], p[:, 0], p[:, 1]])).translate([x0, 0, 0])


def ellipse(cx, cy, rx, ry, n=96):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return CrossSection([np.column_stack([cx + rx * np.cos(t), cy + ry * np.sin(t)])])


def bend(m):
    """Bend a straight part onto the blade arc (centre on the spine side)."""

    def f(p):
        rad = R + p[:, 0]
        a = p[:, 2] / R
        return np.column_stack([rad * np.cos(a) - R, p[:, 1], rad * np.sin(a)])

    return m.refine_to_length(BEND_REFINE).warp_batch(f)


# ---- telescoping interface ------------------------------------------------------


def outer_stations(length, g):
    """Outside of a sliding segment: base collar + wedge, then the plain body."""
    return [
        (0.0, g + LIP - 0.5),  # chamfer eats elephant's foot on the first layers
        (0.5, g + LIP),
        (COLLAR, g + LIP),
        (COLLAR + WEDGE, g),
        (length - 0.4, g),
        (length, g - 0.4),
    ]


def cavity_stations(length, g_inner):
    """Inside of a part that holds a segment of body size g_inner."""
    gc, gt = g_inner + LIP + CLEAR, g_inner + CLEAR
    return [
        (-1.0, gc + 1.8),  # lead-in at the open bottom
        (0.8, gc),
        (length - LAND - WEDGE, gc),  # seat: tapers in to the throat
        (length - LAND, gt),
        (length - 0.4, gt),
        (length + 1.0, gt + 1.4),
    ]


# Where the inner segment's collar jams in the seat, measured from the outer part's top.
WEDGE_TRAVEL = CLEAR * WEDGE / LIP
OVERLAP = LAND + WEDGE + COLLAR - WEDGE_TRAVEL


# ---- parts ----------------------------------------------------------------------


def blade_segment(g, g_inner):
    return loft(outer_stations(BLADE_L, g)) - loft(cavity_stations(BLADE_L, g_inner))


def kissaki_outline():
    """Side view of the tip (x across the blade, z along it)."""
    L, zk = TIP_L, TIP_L - KISSAKI_L
    xp = 0.17 * TIP_W  # the point sits near the spine, like a real kissaki
    p0, p1 = np.array([TIP_W, zk]), np.array([TIP_W, zk + 0.6 * KISSAKI_L])
    p2, p3 = np.array([xp + 0.5 * (TIP_W - xp), L - 4.5]), np.array([xp, L])
    t = np.linspace(0, 1, 40)[:, None]
    fukura = (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t**2 * p2 + t**3 * p3
    drop = 7.0  # the spine line falls slightly toward the point
    slope = drop / xp
    pts = [(-5, -5), (TIP_W + 5, -5), (TIP_W + 5, zk)] + [tuple(q) for q in fukura]
    pts += [(0, L - drop), (-5, L - drop - 5 * slope)]
    cs = CrossSection([np.array(pts)])
    return cs.offset(-2.0, JoinType.Round).offset(2.0, JoinType.Round)  # blunt, rounded point


def tip_segment():
    body = loft(outer_stations(TIP_L, G_TIP))
    L, zk = TIP_L, TIP_L - KISSAKI_L
    side = extrude_xz(kissaki_outline(), -20, 20)
    # Flat facets thin the tip toward the point; where they start reads as the yokote line.
    t0, t1 = TIP_T / 2, 1.1
    yk = t0 - (t0 - t1) * (L + 2 - zk) / (L - zk)
    facets = CrossSection(
        [np.array([(-20, -5), (20, -5), (20, zk), (t0, zk), (yk, L + 2), (-yk, L + 2), (-t0, zk), (-20, zk)])]
    )
    return body ^ side ^ extrude_yz(facets, -20, TIP_W + 20)


def tsuka_cs():
    cavity = blade_cs(G_BASE + LIP + CLEAR).offset(TSUKA_WALL, JoinType.Round)
    return CrossSection.batch_hull([cavity, ellipse(TIP_W / 2, 0, TSUKA_W / 2, TSUKA_T / 2)])


def _thickest_x(cs):
    poly = np.vstack(cs.to_polygons())
    return float(poly[np.argmax(poly[:, 1]), 0])


TSUKA = tsuka_cs()
PIN_X = _thickest_x(TSUKA)


def tapered_octagon(axis_pts, sizes):
    """Hull of flat-bottomed octagons; axis_pts are (x, y, z_bottom), the bar runs along y or x."""
    pts = []
    for (x, y, zb, along), af in zip(axis_pts, sizes):
        r = af / 2 / math.cos(math.pi / 8)
        for a in np.radians(22.5 + 45 * np.arange(8)):
            u, w = r * math.cos(a), zb + af / 2 + r * math.sin(a)
            pts.append((x + u, y, w) if along == "y" else (x, y + u, w))
    return Manifold.hull_points(np.array(pts))


def _pin_hole(z):
    """Through the handle along y, wider on the +y side. Flat bottom at z - PIN_AF/2."""
    y = 40.0
    zb = z - PIN_AF / 2
    return tapered_octagon([(PIN_X, -y, zb, "y"), (PIN_X, y, zb, "y")], [PIN_AF - PIN_TAPER * y, PIN_AF + PIN_TAPER * y])


def _v_groove(cs, z, depth=0.7, up=4.5, down=2.7):
    """Groove ring round the handle; the upper flank is steep so it prints standing up."""
    inner = cs.offset(-depth, JoinType.Round)
    outer = cs.offset(2.0, JoinType.Round)

    def slab(c, zz):
        return np.vstack([np.column_stack([p, np.full(len(p), zz)]) for p in c.to_polygons()])

    waist = Manifold.hull_points(np.vstack([slab(inner, z), slab(outer, z + up)]))
    waist += Manifold.hull_points(np.vstack([slab(inner, z), slab(outer, z - down)]))
    band = Manifold.extrude(cs.offset(3.0, JoinType.Round), up + down).translate([0, 0, z - down])
    return band - waist


def _diamond_pockets():
    """Shallow diamond windows on both faces: the look of a wrapped tsuka."""
    polys = np.vstack(TSUKA.to_polygons())
    half_t = polys[:, 1].max()
    hx, hz, depth, pitch = 10.0, 11.5, 1.2, 25.0
    xc = TIP_W / 2  # centre of the handle oval
    z_lo, z_hi = 24.0, S_FUCHI - 15.0
    count = int((z_hi - z_lo) // pitch)
    z_first = (z_lo + z_hi) / 2 - (count - 1) * pitch / 2
    cutters = []
    for i in range(count):
        zc = z_first + i * pitch
        for sgn in (1, -1):
            pts = []
            for y, grow in ((half_t - depth, 0.0), (half_t + 3.0, 3.0 + depth)):
                ax, az = hx + grow, hz + grow * hz / hx
                for dx, dz in ((ax, 0), (0, az), (-ax, 0), (0, -az)):
                    pts.append((xc + dx, sgn * y, zc + dz))
            cutters.append(Manifold.hull_points(np.array(pts)))
    return Manifold.batch_boolean(cutters, OpType.Add)


def handle():
    tsuka = convex_loft(TSUKA, [(0.0, -0.6), (0.6, 0), (S_FUCHI - 0.5, 0), (S_FUCHI, -0.5)])
    habaki = loft([(S_FUCHI - 1, habaki_g(S_FUCHI - 1)), (HANDLE_L - 0.5, habaki_g(HANDLE_L - 0.5)), (HANDLE_L, HABAKI_G1 - 0.5)])
    body = tsuka + habaki
    body -= loft(cavity_stations(HANDLE_L, G_BASE))
    body -= _pin_hole(PLUG / 2)
    body -= _v_groove(TSUKA, S_FUCHI - 10)
    body -= _diamond_pockets()
    return body


def pommel_cap():
    flange = convex_loft(TSUKA, [(0.0, -1.0), (1.0, 0), (KASHIRA_T - 0.6, 0), (KASHIRA_T, -0.6)])
    g = G_BASE + LIP + CLEAR - PLUG_FIT
    plug = loft([(KASHIRA_T - 0.5, g), (KASHIRA_T + PLUG - 0.6, g), (KASHIRA_T + PLUG, g - 0.6)])
    # Straight hole here (the handle walls carry the taper), so the cap fits either way round.
    af, zb = PIN_AF + PIN_TAPER * 10 + 0.1, KASHIRA_T + PLUG / 2 - PIN_AF / 2
    hole = tapered_octagon([(PIN_X, -40, zb, "y"), (PIN_X, 40, zb, "y")], [af, af])
    return flange + plug - hole


def habaki_g(z):
    return HABAKI_G0 - (HABAKI_G0 - HABAKI_G1) * (z - S_FUCHI) / HABAKI_L


KEEPER_Z = S_FUCHI + TSUBA_T + 1.0  # where the keeper's open end sits, just above the guard


def keeper():
    """Optional cap that pushes onto the habaki and stops the blade sliding out while carried.
    Modelled from its open end (z=0); pull it off before flicking the blade out."""
    top = PLUG + TIP_L + 1.5 - KEEPER_Z  # inside length: covers the habaki and the tip
    g0, g1 = habaki_g(KEEPER_Z) + KEEPER_FIT, habaki_g(HANDLE_L) + KEEPER_FIT
    cav = loft([(-1.0, g0 + 1.0), (0.6, g0), (HANDLE_L - KEEPER_Z, g1), (top, g1)])
    wall = g0 + 1.8
    shell = loft([(0.0, wall - 0.5), (0.5, wall), (top + 1.8, wall), (top + 2.4, wall - 0.6)])
    return shell - cav


def pin():
    """Tapered octagonal peg (mekugi), printed lying on a flat. Same taper as its hole."""
    h = PIN_L / 2
    return tapered_octagon([(0.0, 0.0, 0.0, "x"), (PIN_L, 0.0, 0.0, "x")], [PIN_AF - PIN_TAPER * h, PIN_AF + PIN_TAPER * h])


def tsuba():
    cx = TIP_W / 2
    outline = ellipse(cx, 0, TSUBA_W / 2, TSUBA_H / 2, 160)
    body = convex_loft(outline, [(0.0, -0.5), (0.5, 0), (TSUBA_T - 0.9, 0), (TSUBA_T, -0.9)])
    g = HABAKI_G0 + TSUBA_FIT
    body -= loft([(-1, g + 1.5), (0.5, g), (TSUBA_T - 0.4, g), (TSUBA_T + 1, g + 1.4)])
    # Hitsu-ana: the two half-moon openings either side of the blade.
    hab_t = blade_profile(HABAKI_G0)[:, 1].max()
    for sgn in (1, -1):
        yc = sgn * (hab_t + 8.5)
        moon = ellipse(cx, yc, 6.5, 4.5, 64) - CrossSection.square([40, 10]).translate([cx - 20, yc - 10 if sgn > 0 else yc])
        body -= Manifold.extrude(moon, TSUBA_T + 2).translate([0, 0, -1])
    # A raised-looking rim (mimi): a V-groove ring on the face that shows toward the blade.
    ring_o = ellipse(cx, 0, TSUBA_W / 2 - 3.2, TSUBA_H / 2 - 3.2, 160)
    ring_i = ellipse(cx, 0, TSUBA_W / 2 - 4.4, TSUBA_H / 2 - 4.4, 160)
    body -= Manifold.extrude(ring_o - ring_i, 1.0).translate([0, 0, TSUBA_T - 0.6])
    return body


def fit_test():
    """Short stand-ins for one joint: print these first to check the slide and lock."""
    L = 45.0
    outer = loft(outer_stations(L, G_MID)) - loft(cavity_stations(L, G_TIP))
    inner = loft(outer_stations(60.0, G_TIP))
    return outer, inner


# ---- assembly -------------------------------------------------------------------


def straight_parts():
    return {
        "handle": handle(),
        "blade_1_base": blade_segment(G_BASE, G_MID),
        "blade_2_middle": blade_segment(G_MID, G_TIP),
        "blade_3_tip": tip_segment(),
        "pommel_cap": pommel_cap(),
        "tsuba_guard": tsuba(),
        "pin": pin(),
        "keeper_cap_optional": keeper(),
    }


BENT = {"handle", "blade_1_base", "blade_2_middle", "blade_3_tip"}


def lock_positions():
    """Arc position of each segment's base when fully extended (handle base = 0)."""
    s1 = HANDLE_L - OVERLAP
    s2 = s1 + BLADE_L - OVERLAP
    s3 = s2 + BLADE_L - OVERLAP
    return {"blade_1_base": s1, "blade_2_middle": s2, "blade_3_tip": s3}


def ride(m, s):
    """Carry a rigid (unbent) part to arc position s, keeping it square to the curve."""
    a = s / R
    c, n = math.cos(a), math.sin(a)

    def f(p):
        rad = R + p[:, 0]
        return np.column_stack([rad * c - R - p[:, 2] * n, p[:, 1], rad * n + p[:, 2] * c])

    return m.warp_batch(f)


def place(parts, positions):
    """Put straight parts at arc positions along the shared curve."""
    out = {}
    for name, m in parts.items():
        s = positions.get(name, 0.0)
        if name in BENT:
            out[name] = bend(m.translate([0, 0, s]))
        elif name == "pin":  # printed lying down; stand it in its hole
            m = m.rotate([0, 0, 90]).translate([PIN_X, -PIN_L / 2, PLUG / 2 - PIN_AF / 2])
            out[name] = ride(m, s)
        else:
            d = SEAT_FACE.get(name, 0.0)  # square the part to the curve where it seats
            out[name] = ride(m.translate([0, 0, -d]), s + d)
    return out


SEAT_FACE = {"pommel_cap": KASHIRA_T}


def collapsed_positions():
    return {
        "pommel_cap": -KASHIRA_T,
        "blade_1_base": PLUG,
        "blade_2_middle": PLUG,
        "blade_3_tip": PLUG,
        "tsuba_guard": S_FUCHI,
        "keeper_cap_optional": KEEPER_Z,
    }


def extended_positions():
    pos = collapsed_positions()
    pos.update(lock_positions())
    return pos


# ---- output ---------------------------------------------------------------------


def write_stl(m, path):
    mesh = m.to_mesh()
    v = np.asarray(mesh.vert_properties)[:, :3].astype(np.float64)
    t = np.asarray(mesh.tri_verts)
    tri = v[t]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1), 1e-12)[:, None]
    rec = np.zeros(len(t), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
    rec["n"], rec["v"] = n, tri
    with open(path, "wb") as f:
        f.write(b"collapsible katana".ljust(80, b"\0"))
        f.write(np.uint32(len(t)).tobytes())
        f.write(rec.tobytes())


def to_bed(m):
    """Drop a part onto the bed and centre it."""
    lo = np.array(m.bounding_box()[:3])
    hi = np.array(m.bounding_box()[3:])
    return m.translate([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])


def print_parts(parts):
    out = {}
    for name, m in parts.items():
        if name in BENT:
            m = bend(m)
        elif name == "keeper_cap_optional":
            m = m.rotate([180, 0, 0])  # closed end on the bed
        out[name] = to_bed(m)
    return out


# ---- checks ---------------------------------------------------------------------


def check(parts):
    ok = True

    def report(cond, msg):
        nonlocal ok
        ok &= bool(cond)
        print(("  ok   " if cond else "  FAIL ") + msg)

    print("printability")
    for name, m in print_parts(parts).items():
        lo, hi = np.array(m.bounding_box()[:3]), np.array(m.bounding_box()[3:])
        size = hi - lo
        report(
            m.status().name == "NoError" and m.genus() >= 0 and size[2] <= MAX_PRINT_HEIGHT and max(size[:2]) <= BED,
            f"{name:15s} {size[0]:6.1f} x {size[1]:5.1f} x {size[2]:6.1f} mm, {m.volume() / 1000:6.1f} cm3",
        )

    pairs = [
        ("handle", "blade_1_base"),
        ("blade_1_base", "blade_2_middle"),
        ("blade_2_middle", "blade_3_tip"),
        ("handle", "blade_2_middle"),
        ("handle", "blade_3_tip"),
        ("blade_1_base", "blade_3_tip"),
        ("handle", "pommel_cap"),
        ("handle", "tsuba_guard"),
        ("handle", "keeper_cap_optional"),
        ("blade_3_tip", "keeper_cap_optional"),
    ]

    print("collapsed: every nested pair clears")
    pos = collapsed_positions()
    pos["pommel_cap"] -= 0.05  # these two seat against the handle; lift them off to see the side clearance
    pos["tsuba_guard"] += 0.05
    a = place(parts, pos)
    for p, q in pairs:
        gap = a[p].min_gap(a[q], 2.0)
        need = 0.04 if q in ("pommel_cap", "tsuba_guard", "keeper_cap_optional") else CLEAR - 0.02
        report(gap >= need, f"{p} / {q}: gap {gap:.3f} mm")

    print("sliding out: each segment clears its outer part all the way to the lock")
    chain = [("handle", "blade_1_base"), ("blade_1_base", "blade_2_middle"), ("blade_2_middle", "blade_3_tip")]
    lock = lock_positions()
    for outer, inner in chain:
        o_base = 0.0 if outer == "handle" else lock[outer]
        o = bend(parts[outer].translate([0, 0, o_base]))
        start = o_base + PLUG if outer == "handle" else o_base
        worst = 9.0
        for s in np.linspace(start, lock[inner] - WEDGE_TRAVEL - 0.2, 12):
            worst = min(worst, o.min_gap(bend(parts[inner].translate([0, 0, s])), 2.0))
        report(worst >= CLEAR - 0.02, f"{inner} inside {outer}: smallest gap on the way out {worst:.3f} mm")
        near = o.min_gap(bend(parts[inner].translate([0, 0, lock[inner] - 0.3])), 2.0)
        report(0 < near < 0.1, f"{inner}: 0.3 mm before the lock the wedge gap is {near:.3f} mm")
        jam = (o ^ bend(parts[inner].translate([0, 0, lock[inner] + 1.5]))).volume()
        report(jam > 1.0, f"{inner}: 1.5 mm past the lock the collar is blocked ({jam:.1f} mm3 overlap)")

    print("pin")
    plug = blade_profile(G_BASE + LIP + CLEAR - PLUG_FIT)
    side = min(PIN_X - plug[:, 0].min(), plug[:, 0].max() - PIN_X) - PIN_AF / 2
    report(side > 3, f"plug material beside the pin hole {side:.1f} mm, above/below {(PLUG - PIN_AF) / 2:.1f} mm")
    shell = TSUKA_T / 2 - plug[:, 1].max() - PLUG_FIT
    report(shell > 2.5, f"handle wall the pin passes through {shell:.1f} mm")
    return ok


def dims():
    print("cross-sections (width x thickness at the ridge):")
    for name, g in (("tip segment", G_TIP), ("middle segment", G_MID), ("base segment", G_BASE)):
        p = blade_profile(g)
        print(f"  {name:15s} {np.ptp(p[:, 0]):5.1f} x {np.ptp(p[:, 1]):5.1f} mm")
    lock = lock_positions()
    blade = lock["blade_3_tip"] + TIP_L - HANDLE_L
    print(f"  overlap at each joint {OVERLAP:.1f} mm")
    print(f"  extended: blade {blade:.0f} mm past the habaki, overall {lock['blade_3_tip'] + TIP_L + KASHIRA_T:.0f} mm")
    print(f"  collapsed: overall {KASHIRA_T + PLUG + TIP_L:.0f} mm")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="verify fits and printability")
    ap.add_argument("--out", default=str(HERE / "stl"))
    args = ap.parse_args()

    parts = straight_parts()
    dims()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for name, m in print_parts(parts).items():
        write_stl(m, out / f"{name}.stl")
    fo, fi = fit_test()
    write_stl(to_bed(fo), out / "fit_test_outer.stl")
    write_stl(to_bed(fi), out / "fit_test_inner.stl")
    print(f"wrote STLs to {out}")
    if args.check and not check(parts):
        sys.exit(1)


if __name__ == "__main__":
    main()
