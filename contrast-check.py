#!/usr/bin/env python3
"""Re-run after adding or changing colour palettes:  python3 contrast-check.py index.html
Checks WCAG contrast (4.5:1 for text, 3:1 for focus rings) for every palette in light and dark mode,
for the header/gradient buttons (white text over a 34% dark overlay), and for the fixed colours."""
import re, sys
src = open(sys.argv[1] if len(sys.argv) > 1 else "index.html").read()
def rgb(h):
    h = h.lstrip("#"); h = "".join(c * 2 for c in h) if len(h) == 3 else h
    return [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
def lum(h):
    f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    r, g, b = map(f, rgb(h)); return .2126 * r + .7152 * g + .0722 * b
def cr(a, b):
    x, y = lum(a), lum(b); return (max(x, y) + .05) / (min(x, y) + .05)
def dim(h, a=.34): return "#%02x%02x%02x" % tuple(int(c * 255 * (1 - a)) for c in rgb(h))
LB, LC, DB, DC = "#f6f7fb", "#ffffff", "#12141f", "#1b1e2e"
fails, checks = [], 0
def chk(name, ratio, need=4.5):
    global checks; checks += 1
    if ratio < need: fails.append(f"{name}: {ratio:.2f}:1 (needs {need})")
pals = re.findall(r'(\w+):\{n:"\w+",b:\["(#\w+)","(#\w+)"\],g:\["(#\w+)","(#\w+)","(#\w+)"\]\}', src)
for id, b0, b1, *g in pals:
    for mode, b, bg, card in (("light", b0, LB, LC), ("dark", b1, DB, DC)):
        onb = "#ffffff" if cr("#ffffff", b) >= cr("#0b0d17", b) else "#0b0d17"
        chk(f"{id}/{mode} text on brand", cr(onb, b))
        chk(f"{id}/{mode} brand text on card", cr(b, card))
        chk(f"{id}/{mode} focus ring vs page", cr(b, bg), 3)
    for x in g: chk(f"{id} white on gradient {x}", cr("#ffffff", dim(x)))
for name, fg, bg in [("mute/light page", "#68708a", LB), ("mute/light card", "#68708a", LC), ("mute/dark card", "#9aa2bf", DC),
    ("ok text light", "#0f7a43", LC), ("bad text light", "#b91c1c", LC), ("ok text dark", "#4ade80", DC), ("bad text dark", "#f87171", DC),
    ("white on ok", "#ffffff", "#0f7a43"), ("white on bad", "#ffffff", "#b91c1c"), ("dark on ok(dark)", "#0b1f12", "#4ade80"), ("dark on bad(dark)", "#0b1f12", "#f87171"),
    ("amber text light", "#92400e", LC), ("amber text dark", "#fbbf24", DC), ("green text light", "#047857", LC), ("red text light", "#b91c1c", LC)]:
    chk(name, cr(fg, bg))
for c in re.search(r'const COL=\[(.*?)\]', src).group(1).replace('"', "").split(","): chk(f"white on COL {c}", cr("#ffffff", c))
for c in re.findall(r'(?:concept|process|example|term):\["(#\w+)"', src): chk(f"white on map colour {c}", cr("#ffffff", c))
for nm, fg, bg in [("high contrast ink", "#000000", "#ffffff"), ("high contrast brand", "#0000cc", "#ffffff"), ("hc mute", "#333333", "#ffffff")]: chk(nm, cr(fg, bg), 7)
print(f"{checks} checks, {len(fails)} failures"); [print(" FAIL", f) for f in fails]; sys.exit(1 if fails else 0)
