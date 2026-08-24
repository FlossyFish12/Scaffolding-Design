#!/usr/bin/env python3
"""
scaffold_density.py  —  Scaffold Material & Component Density Calculator
TG:20 / BS EN 12811-1 compliant

Retro terminal GUI (curses).  Zero pip dependencies.
"""

import curses
import json
import os
import sys
import math
import pathlib
import csv
import io
import datetime

# ═══════════════════════════════════════════════════════════
#  DATA TABLES
# ═══════════════════════════════════════════════════════════

TUBE_SPECS = [
    {"label": "48.3mm std (4.0mm)",       "kg_m": 4.37},
    {"label": "48.3mm hi-yield (3.2mm)",  "kg_m": 3.56},
    {"label": "38mm std (4.0mm)",         "kg_m": 3.35},
    {"label": "38mm light (3.2mm)",       "kg_m": 2.75},
    {"label": "48.3mm aluminium",         "kg_m": 1.50},
    {"label": "38mm aluminium",           "kg_m": 0.95},
]

BOARD_SPECS = [
    {"label": "Timber", "kg_m": 4.275},
    {"label": "LVL",    "kg_m": 5.13},
    {"label": "Steel",  "kg_m": 6.67},
]

BOARD_LENGTHS = [2.4, 3.0, 3.9, 4.9]
SCAFFOLD_TYPES = ["Independent", "Putlog", "Birdcage"]
THEMES = ["white", "green", "amber"]
THEME_NAMES = {"white": "White", "green": "Green Phosphor", "amber": "Amber Phosphor"}

LOAD_CLASSES = [
    (1, 0.75, "Inspection / very light"),
    (2, 1.50, "Light"),
    (3, 2.00, "General construction"),
    (4, 3.00, "Masonry"),
    (5, 4.50, "Heavy masonry"),
    (6, 6.00, "Special heavy"),
]

BOARD_WIDTH = 0.225
TIE_SPACING = 4.0
MAX_HBR = 3.5
MAX_TG20_HEIGHT = 50.0

DEFAULT_INPUTS = {
    "zone_name": "Zone 1",
    "bay_length": 2.0,
    "lift_height": 2.0,
    "num_bays": 5,
    "num_lifts": 6,
    "boarded_lifts": 3,
    "boards_wide": 5,
    "board_length": 2.4,
    "tube_idx": 0,
    "board_idx": 0,
    "scaffold_idx": 0,
    "load_class": 3,
    "include_couplers": True,
    "include_boards": True,
    "imperial": False,
}

CONFIG_DIR = pathlib.Path.home() / ".config" / "scaffold_density"
CONFIG_PATH = CONFIG_DIR / "config.json"

# ═══════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════

def load_config():
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text())
        except Exception:
            pass
    return None

def save_config(cfg):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2) + "\n")

# ═══════════════════════════════════════════════════════════
#  THEME
# ═══════════════════════════════════════════════════════════

THEME_COLORS = {
    "white": curses.COLOR_WHITE,
    "green": curses.COLOR_GREEN,
    "amber": curses.COLOR_YELLOW,
}

def apply_theme(stdscr, theme_name):
    curses.start_color()
    curses.use_default_colors()
    c = THEME_COLORS.get(theme_name, curses.COLOR_WHITE)
    curses.init_pair(1, c, -1)   # normal
    curses.init_pair(2, c, -1)   # bold
    curses.init_pair(3, c, -1)   # dim
    bg = 0
    if c == curses.COLOR_WHITE:
        curses.init_pair(4, curses.COLOR_BLACK, -1)  # for scanline effect
    else:
        curses.init_pair(4, c, -1)

def next_theme(current):
    i = THEMES.index(current)
    return THEMES[(i + 1) % len(THEMES)]

# ═══════════════════════════════════════════════════════════
#  UI HELPERS
# ═══════════════════════════════════════════════════════════

def cp(attr=0):
    """color pair 1 with optional attribute."""
    return curses.color_pair(1) | attr

def safe_addstr(win, y, x, text, *fmt):
    h, w = win.getmaxyx()
    if y < 0 or y >= h or x < 0 or x >= w:
        return
    text = text[:w - x - 1]
    if not text:
        return
    try:
        win.addstr(y, x, text, *fmt)
    except curses.error:
        pass

def fill_bg(win):
    """Fill screen with background pattern."""
    h, w = win.getmaxyx()
    for y in range(h):
        for x in range(w):
            try:
                win.addch(y, x, ord(" "), cp(curses.A_NORMAL))
            except curses.error:
                pass

def draw_hline(win, y, x, wlen, attr=0):
    for i in range(wlen):
        try:
            win.addch(y, x + i, curses.ACS_HLINE, cp(attr))
        except curses.error:
            break

def draw_vline(win, y, x, hlen, attr=0):
    for i in range(hlen):
        try:
            win.addch(y + i, x, curses.ACS_VLINE, cp(attr))
        except curses.error:
            break

def box_win(win, y, x, h, w, attr=0):
    """Draw a box using ACS chars."""
    for j in range(w):
        try:
            win.addch(y, x + j, " " if j == 0 or j == w - 1 else curses.ACS_HLINE, cp(attr))
            win.addch(y + h - 1, x + j, " " if j == 0 or j == w - 1 else curses.ACS_HLINE, cp(attr))
        except curses.error:
            break
    for i in range(1, h - 1):
        try:
            win.addch(y + i, x, curses.ACS_VLINE, cp(attr))
            win.addch(y + i, x + w - 1, curses.ACS_VLINE, cp(attr))
        except curses.error:
            break
    try:
        win.addch(y, x, curses.ACS_ULCORNER, cp(attr))
        win.addch(y, x + w - 1, curses.ACS_URCORNER, cp(attr))
        win.addch(y + h - 1, x, curses.ACS_LLCORNER, cp(attr))
        win.addch(y + h - 1, x + w - 1, curses.ACS_LRCORNER, cp(attr))
    except curses.error:
        pass

def draw_separator(win, y, attr=0):
    """Full-width horizontal separator."""
    h, w = win.getmaxyx()
    draw_hline(win, y, 1, w - 2, attr)

# ═══════════════════════════════════════════════════════════
#  INPUT FIELD HANDLING
# ═══════════════════════════════════════════════════════════

def prompt_float(win, label, default, y, x, prompt_w=50):
    """Prompt for a float value.  Returns value or None on quit."""
    h, w = win.getmaxyx()
    text = f"  {label} [{default}] : "
    buf = ""
    while True:
        win.move(y, x)
        safe_addstr(win, y, x, text + buf + " ", cp())
        safe_addstr(win, y, x, text, cp())
        # draw cursor
        cx = x + len(text) + len(buf)
        try:
            win.addch(y, cx, ord(" "), cp() | curses.A_REVERSE)
        except:
            pass
        win.move(y, cx)
        win.refresh()
        key = win.getch()
        if key == curses.KEY_ENTER or key == 10 or key == 13:
            if buf.strip():
                try:
                    return float(buf.strip())
                except ValueError:
                    pass
            return default
        elif key == 27:  # ESC
            return None
        elif key == curses.KEY_BACKSPACE or key == 127 or key == 8:
            buf = buf[:-1]
        elif key == ord("q") or key == ord("Q"):
            if not buf:
                return None
            buf = buf[:-1]
        elif key == ord(".") and "." not in buf:
            buf += "."
        elif 48 <= key <= 57:  # 0-9
            buf += chr(key)
        elif key == ord("-") and not buf:
            buf += "-"

def prompt_int(win, label, default, y, x, lo=None, hi=None, prompt_w=50):
    h, w = win.getmaxyx()
    text = f"  {label} [{default}] : "
    buf = ""
    while True:
        safe_addstr(win, y, x, text + buf + " ", cp())
        safe_addstr(win, y, x, text, cp())
        cx = x + len(text) + len(buf)
        try:
            win.addch(y, cx, ord(" "), cp() | curses.A_REVERSE)
        except:
            pass
        win.move(y, cx)
        win.refresh()
        key = win.getch()
        if key == curses.KEY_ENTER or key == 10 or key == 13:
            if buf.strip():
                try:
                    v = int(buf.strip())
                    if lo is not None and v < lo:
                        v = lo
                    if hi is not None and v > hi:
                        v = hi
                    return v
                except ValueError:
                    pass
            return default
        elif key == 27:
            return None
        elif key == curses.KEY_BACKSPACE or key == 127 or key == 8:
            buf = buf[:-1]
        elif key == ord("q") or key == ord("Q"):
            if not buf:
                return None
            buf = buf[:-1]
        elif 48 <= key <= 57:
            buf += chr(key)

def prompt_bool(win, label, default, y, x, prompt_w=50):
    """Y/n prompt.  Returns bool or None."""
    text = f"  {label} [{'Y' if default else 'N'}] : "
    while True:
        safe_addstr(win, y, x, text, cp())
        safe_addstr(win, y, x + len(text) - 1, " ", cp() | curses.A_REVERSE)
        win.refresh()
        key = win.getch()
        if key == curses.KEY_ENTER or key == 10 or key == 13:
            return default
        elif key == ord("y") or key == ord("Y"):
            return True
        elif key == ord("n") or key == ord("N"):
            return False
        elif key == 27:
            return None

def prompt_cycle(win, label, options, current_idx, y, x, prompt_w=50):
    """Cycle through options with Space, accept with Enter. Returns (new_idx, None) or None."""
    idx = current_idx
    text = f"  {label} "
    while True:
        opt_text = options[idx] if idx < len(options) else "?"
        line = text + f"[{opt_text}] Space=cycle Enter=accept"
        safe_addstr(win, y, x, line, cp())
        # highlight the option value
        val_start = x + len(text)
        safe_addstr(win, y, val_start, f"[{opt_text}]", cp() | curses.A_BOLD)
        # put cursor after
        try:
            win.addch(y, x + len(line), ord(" "), cp() | curses.A_REVERSE)
        except:
            pass
        win.refresh()
        key = win.getch()
        if key == curses.KEY_ENTER or key == 10 or key == 13:
            return idx
        elif key == ord(" "):
            idx = (idx + 1) % len(options)
        elif key == 27:
            return None

def prompt_str(win, label, default, y, x, prompt_w=50):
    """Free-text string input."""
    text = f"  {label} [{default}] : "
    buf = ""
    while True:
        safe_addstr(win, y, x, text + buf + " ", cp())
        safe_addstr(win, y, x, text, cp())
        cx = x + len(text) + len(buf)
        try:
            win.addch(y, cx, ord(" "), cp() | curses.A_REVERSE)
        except:
            pass
        win.move(y, cx)
        win.refresh()
        key = win.getch()
        if key == curses.KEY_ENTER or key == 10 or key == 13:
            if buf.strip():
                return buf.strip()
            return default
        elif key == 27:
            return None
        elif key == curses.KEY_BACKSPACE or key == 127 or key == 8:
            buf = buf[:-1]
        elif 32 <= key <= 126:
            buf += chr(key)

# ═══════════════════════════════════════════════════════════
#  CALCULATION ENGINE
# ═══════════════════════════════════════════════════════════

def calculate_zone(inp):
    """Run component count and mass calculations for one zone.
    Returns a dict of results."""
    L = inp["num_bays"] * inp["bay_length"]          # scaffold length
    W = inp["boards_wide"] * BOARD_WIDTH              # scaffold width
    H = inp["num_lifts"] * inp["lift_height"]         # total height
    V = L * W * H                                     # envelope volume

    tube = TUBE_SPECS[inp["tube_idx"]]
    board = BOARD_SPECS[inp["board_idx"]]
    lh = inp["lift_height"]
    bl = inp["bay_length"]
    nb = inp["num_bays"]
    nl = inp["num_lifts"]
    blf = inp["boarded_lifts"]
    bw = inp["boards_wide"]

    # ── Standards (vertical) ──
    if inp["scaffold_idx"] == 0:   # Independent
        n_std = (nb + 1) * 2
    elif inp["scaffold_idx"] == 1:  # Putlog
        n_std = (nb + 1) * 1
    else:                           # Birdcage
        grid_rows = max(2, int(W / bl) + 1)
        n_std = (nb + 1) * grid_rows

    std_len = n_std * H

    # ── Ledgers (horizontal long) ──
    n_lev = nl + 1  # ledger levels
    if inp["scaffold_idx"] == 0:   # Independent
        n_leg = nb * 2 * n_lev
        leg_len = n_leg * bl
    elif inp["scaffold_idx"] == 1:  # Putlog
        n_leg = nb * 1 * n_lev
        leg_len = n_leg * bl
    else:                           # Birdcage
        grid_rows = max(2, int(W / bl) + 1)
        # long ledgers (along length)
        n_leg_long = nb * grid_rows * n_lev
        # short ledgers (along width)
        n_leg_short = (grid_rows - 1) * (nb + 1) * n_lev
        n_leg = n_leg_long + n_leg_short
        leg_len = n_leg_long * bl + n_leg_short * bl  # approx, both use bay_length

    # ── Transoms (horizontal short) ──
    n_trn = (nb + 1) * blf
    trn_len = n_trn * W

    # ── Diagonal braces ──
    main_tube_len = std_len + leg_len + trn_len
    brace_len = 0.08 * main_tube_len
    n_brace = max(4, int(brace_len / bl))

    # ── Mass ──
    mass_std  = std_len * tube["kg_m"]
    mass_leg  = leg_len * tube["kg_m"]
    mass_trn  = trn_len * tube["kg_m"]
    mass_brc  = brace_len * tube["kg_m"]
    mass_tube = mass_std + mass_leg + mass_trn + mass_brc

    # ── Couplers ──
    total_joints = n_std + n_leg + n_trn + n_brace
    n_coup = int(total_joints * 2.2)
    mass_coup = n_coup * 0.90  # average across types

    # ── Boards ──
    n_bds = nb * bw * blf
    mass_bds = n_bds * inp["board_length"] * board["kg_m"]

    # ── Ties ──
    ties_h = max(1, math.ceil(L / TIE_SPACING) + 1)
    ties_v = max(1, math.ceil(H / TIE_SPACING))
    n_ties = ties_h * ties_v

    # ── Totals ──
    inc_coup = bool(inp.get("include_couplers", True))
    inc_bds  = bool(inp.get("include_boards", True))
    total_mass = mass_tube
    total_components = n_std + n_leg + n_trn + n_brace
    if inc_coup:
        total_mass += mass_coup
        total_components += n_coup
    if inc_bds:
        total_mass += mass_bds
        total_components += n_bds

    mat_density = total_mass / V if V > 0 else 0
    comp_density = total_components / V if V > 0 else 0
    tie_density = n_ties / V if V > 0 else 0

    # Height-to-base ratio
    hbr = H / W if W > 0 else 99

    return {
        "L": L, "W": W, "H": H, "V": V,
        "tube_label": tube["label"],
        "board_label": board["label"],
        "scaffold_type": SCAFFOLD_TYPES[inp["scaffold_idx"]],
        "load_class": inp["load_class"],
        "load_class_udl": LOAD_CLASSES[inp["load_class"] - 1][1],
        "n_standards": n_std,       "mass_standards": round(mass_std, 1),
        "n_ledgers": n_leg,         "mass_ledgers": round(mass_leg, 1),
        "n_transoms": n_trn,        "mass_transoms": round(mass_trn, 1),
        "n_braces": n_brace,        "mass_braces": round(mass_brc, 1),
        "n_couplers": n_coup,       "mass_couplers": round(mass_coup, 1),
        "n_boards": n_bds,          "mass_boards": round(mass_bds, 1),
        "n_ties": n_ties,
        "total_mass": round(total_mass, 1),
        "total_components": total_components,
        "mat_density": round(mat_density, 2),
        "comp_density": round(comp_density, 2),
        "tie_density": round(tie_density, 2),
        "hbr": round(hbr, 1),
        "hbr_ok": hbr <= MAX_HBR,
        "height_ok": H <= MAX_TG20_HEIGHT,
        "bay_ok": bl <= 2.0,
        "lift_ok": lh <= 2.0,
    }

# ═══════════════════════════════════════════════════════════
#  DISPLAY HELPERS
# ═══════════════════════════════════════════════════════════

CMP_ROWS = [
    ("Standards",  "n_standards",  "mass_standards"),
    ("Ledgers",    "n_ledgers",    "mass_ledgers"),
    ("Transoms",   "n_transoms",   "mass_transoms"),
    ("Braces",     "n_braces",     "mass_braces"),
    ("Couplers",   "n_couplers",   "mass_couplers"),
    ("Boards",     "n_boards",     "mass_boards"),
]

def draw_results(win, r, imperial, theme_name):
    """Draw the per-zone results screen.  Returns next available y (or -1 for quit)."""
    h, w = win.getmaxyx()
    win.clear()

    y = draw_header_bar(win, theme_name)
    safe_addstr(win, y, 2, f"ZONE: {r.get('zone_name', 'Results')}", cp(curses.A_BOLD))
    y += 2

    # Dimensions summary
    dims = f"  {r['L']}m x {r['W']}m x {r['H']}m  =  {r['V']} m³"
    safe_addstr(win, y, 2, dims, cp())
    y += 1
    safe_addstr(win, y, 2, f"  Type: {r['scaffold_type']}  |  Tube: {r['tube_label']}  |  Boards: {r['board_label']}", cp())
    y += 1
    lc = r['load_class']
    safe_addstr(win, y, 2, f"  Load Class: {lc}  ({r['load_class_udl']} kN/m²)", cp())
    y += 2

    # Compliance warnings
    if not r["bay_ok"]:
        safe_addstr(win, y, 2, "  ! WARNING: Bay length exceeds TG20 max (2.0m)", cp(curses.A_BOLD))
        y += 1
    if not r["lift_ok"]:
        safe_addstr(win, y, 2, "  ! WARNING: Lift height exceeds TG20 max (2.0m)", cp(curses.A_BOLD))
        y += 1
    if not r["hbr_ok"]:
        safe_addstr(win, y, 2, f"  ! WARNING: Height-to-base ratio {r['hbr']} > {MAX_HBR} (TG20 limit)", cp(curses.A_BOLD))
        y += 1
    if not r["height_ok"]:
        safe_addstr(win, y, 2, f"  ! WARNING: Height {r['H']}m > 50m — bespoke design required", cp(curses.A_BOLD))
        y += 1
    if r["bay_ok"] and r["lift_ok"] and r["hbr_ok"] and r["height_ok"]:
        safe_addstr(win, y, 2, "  TG20 compliance check: PASS", cp())
        y += 1
    y += 1

    # Component table
    box_win(win, y, 2, 6 + len(CMP_ROWS), 58)
    safe_addstr(win, y + 1, 4, "Component", cp(curses.A_BOLD))
    safe_addstr(win, y + 1, 20, "Count", cp(curses.A_BOLD))
    safe_addstr(win, y + 1, 30, f"{'Mass (kg)' if not imperial else 'Mass (lb)'}", cp(curses.A_BOLD))
    safe_addstr(win, y + 1, 44, f"{'kg/m³' if not imperial else 'lb/ft³'}", cp(curses.A_BOLD))
    safe_addstr(win, y + 1, 54, "units/m³", cp(curses.A_BOLD))
    draw_separator(win, y + 2)

    for i, (label, count_key, mass_key) in enumerate(CMP_ROWS):
        row_y = y + 3 + i
        cnt = r[count_key]
        m = r[mass_key]
        if imperial:
            m_disp = round(m * 2.20462, 1)
            den_disp = round(m / r["V"] * 2.20462 / 35.3147, 2) if r["V"] > 0 else 0
        else:
            m_disp = m
            den_disp = round(m / r["V"], 2) if r["V"] > 0 else 0
        comp_den = round(cnt / r["V"], 2) if r["V"] > 0 else 0

        safe_addstr(win, row_y, 4, label, cp())
        safe_addstr(win, row_y, 20, str(cnt).rjust(6), cp())
        safe_addstr(win, row_y, 30, f"{m_disp:>8.1f}", cp())
        safe_addstr(win, row_y, 44, f"{den_disp:>7.2f}", cp())
        safe_addstr(win, row_y, 54, f"{comp_den:>7.2f}", cp())

    # Total row
    total_y = y + 3 + len(CMP_ROWS)
    draw_separator(win, total_y)
    safe_addstr(win, total_y + 1, 4, "TOTAL", cp(curses.A_BOLD))
    safe_addstr(win, total_y + 1, 20, str(r["total_components"]).rjust(6), cp(curses.A_BOLD))
    if imperial:
        m_tot = round(r["total_mass"] * 2.20462, 1)
        safe_addstr(win, total_y + 1, 30, f"{m_tot:>8.1f}", cp(curses.A_BOLD))
    else:
        safe_addstr(win, total_y + 1, 30, f"{r['total_mass']:>8.1f}", cp(curses.A_BOLD))

    # Key densities box
    box_y = total_y + 3
    box_win(win, box_y, 2, 5, 58)
    if imperial:
        mat_d = r["mat_density"] * 2.20462 / 35.3147
        comp_d = r["comp_density"]
        tie_d = r["tie_density"]
        unit = "lb/ft³"
    else:
        mat_d = r["mat_density"]
        comp_d = r["comp_density"]
        tie_d = r["tie_density"]
        unit = "kg/m³"
    safe_addstr(win, box_y + 1, 4, f"Material density:    {mat_d:>8.2f} {unit}", cp(curses.A_BOLD))
    safe_addstr(win, box_y + 2, 4, f"Component density:  {comp_d:>8.2f} units/m³", cp(curses.A_BOLD))
    safe_addstr(win, box_y + 3, 4, f"Tie density:        {tie_d:>8.2f} ties/m³", cp())

    # Controls hint
    ctrl_y = box_y + 6
    safe_addstr(win, ctrl_y, 2, "  F2=Theme  H=Help  I=Imperial  S=CSV  N=New zone  Q=Quit", cp(curses.A_DIM))

    return ctrl_y + 2

def draw_header_bar(win, theme_name):
    """Draw the persistent header. Returns y of next line."""
    h, w = win.getmaxyx()
    fill_bg(win)
    title = "SCAFFOLD DENSITY CALCULATOR"
    sub = f"TG:20  |  BS EN 12811-1  |  {THEME_NAMES.get(theme_name, theme_name)}"
    ver = "v1.0"
    y = 0
    draw_separator(win, y)
    safe_addstr(win, y + 1, (w - len(title)) // 2, title, cp(curses.A_BOLD))
    safe_addstr(win, y + 2, (w - len(sub)) // 2, sub, cp())
    safe_addstr(win, y + 1, w - len(ver) - 3, ver, cp())
    draw_separator(win, y + 3)
    return y + 4

def draw_help(win, theme_name):
    """Help overlay."""
    h, w = win.getmaxyx()
    win.clear()
    draw_header_bar(win, theme_name)
    y = 4
    lines = [
        "KEYBOARD CONTROLS",
        "",
        "  Enter      Accept current field / default",
        "  Space      Cycle through options (for choice fields)",
        "  F2         Cycle theme: white > green > amber",
        "  I          Toggle metric (kg/m³) / imperial (lb/ft³)",
        "  S          Save current zone results to CSV",
        "  Ctrl+S     Save project (all zones) to JSON",
        "  Ctrl+O     Load project from JSON file",
        "  N          New zone (from results screen)",
        "  H          Toggle this help screen",
        "  ESC        Cancel entry / back",
        "  Q          Quit",
        "",
        "INPUT FIELDS",
        "",
        "  Numeric:  type digits & decimal, Enter to confirm",
        "            Enter alone accepts the [default] value",
        "  Choice:   Space to cycle, Enter to accept",
        "  Y/n:      Y or N, Enter accepts default",
        "",
        "TG20 COMPLIANCE NOTES",
        "",
        "  Max bay length:  2.0 m",
        "  Max lift height: 2.0 m",
        "  Height-to-base ratio: 3.5:1",
        "  Max scaffold height:  50 m (beyond = bespoke design)",
        "  Tie spacing:   4.0 m max horizontally & vertically",
        "",
        "  Press any key to return",
    ]
    for line in lines:
        if y < h - 1:
            is_heading = bool(line) and line[0].isupper() and len(line) > 2 and line == line.upper()
            attr = cp(curses.A_BOLD) if is_heading else cp()
            safe_addstr(win, y, 4, line, attr)
            y += 1
    win.getch()
    return True

def draw_combined_project(win, zones, imperial, theme_name):
    """Draw the combined project report."""
    h, w = win.getmaxyx()
    win.clear()
    y = draw_header_bar(win, theme_name)
    safe_addstr(win, y, 2, "PROJECT COMBINED REPORT", cp(curses.A_BOLD))
    y += 2

    # Zone summary table
    n_zones = len(zones)
    table_h = n_zones + 4
    box_win(win, y, 2, table_h, 60)
    safe_addstr(win, y + 1, 4, "Zone", cp(curses.A_BOLD))
    safe_addstr(win, y + 1, 24, "Mass (kg)" if not imperial else "Mass (lb)", cp(curses.A_BOLD))
    safe_addstr(win, y + 1, 38, "Vol (m³)", cp(curses.A_BOLD))
    safe_addstr(win, y + 1, 50, "ρ (kg/m³)" if not imperial else "ρ (lb/ft³)", cp(curses.A_BOLD))
    draw_separator(win, y + 2)

    total_mass = 0
    total_vol = 0
    total_comp = 0
    for i, z in enumerate(zones):
        row_y = y + 3 + i
        nm = z.get("zone_name", f"Zone {i+1}")
        total_mass += z["total_mass"]
        total_vol += z["V"]
        total_comp += z["total_components"]
        if imperial:
            m = round(z["total_mass"] * 2.20462, 1)
            d = round(z["mat_density"] * 2.20462 / 35.3147, 2)
        else:
            m = z["total_mass"]
            d = z["mat_density"]
        safe_addstr(win, row_y, 4, nm, cp())
        safe_addstr(win, row_y, 24, f"{m:>10.1f}", cp())
        safe_addstr(win, row_y, 38, f"{z['V']:>8.1f}", cp())
        safe_addstr(win, row_y, 50, f"{d:>8.2f}", cp())

    # Total row
    total_row = y + 3 + n_zones
    draw_separator(win, total_row)
    if imperial:
        m_tot = round(total_mass * 2.20462, 1)
        d_tot = round(total_mass / total_vol * 2.20462 / 35.3147, 2) if total_vol > 0 else 0
    else:
        m_tot = round(total_mass, 1)
        d_tot = round(total_mass / total_vol, 2) if total_vol > 0 else 0
    safe_addstr(win, total_row + 1, 4, "PROJECT TOTAL", cp(curses.A_BOLD))
    safe_addstr(win, total_row + 1, 24, f"{m_tot:>10.1f}", cp(curses.A_BOLD))
    safe_addstr(win, total_row + 1, 38, f"{total_vol:>8.1f}", cp(curses.A_BOLD))
    safe_addstr(win, total_row + 1, 50, f"{d_tot:>8.2f}", cp(curses.A_BOLD))

    # Combined densities
    y2 = total_row + 4
    box_win(win, y2, 2, 5, 60)
    c_mat_d = total_mass / total_vol if total_vol > 0 else 0
    c_comp_d = total_comp / total_vol if total_vol > 0 else 0
    unit = "lb/ft³" if imperial else "kg/m³"
    safe_addstr(win, y2 + 1, 4, f"COMBINED MATERIAL DENSITY:   {c_mat_d:>8.2f} {unit}", cp(curses.A_BOLD))
    safe_addstr(win, y2 + 2, 4, f"COMBINED COMPONENT DENSITY: {c_comp_d:>8.2f} units/m³", cp(curses.A_BOLD))
    safe_addstr(win, y2 + 3, 4, f"COMBINED TIE DENSITY:       {sum(z['n_ties'] for z in zones) / total_vol:>8.2f} ties/m³", cp())

    ctrl_y = y2 + 6
    safe_addstr(win, ctrl_y, 2, "  F2=Theme  H=Help  I=Imperial  S=CSV  Ctrl+S=Save  Ctrl+O=Load  Q=Quit", cp(curses.A_DIM))

    return ctrl_y + 2

# ═══════════════════════════════════════════════════════════
#  CSV EXPORT
# ═══════════════════════════════════════════════════════════

def export_csv(win, zones, imperial):
    """Write zone results to CSV.  Returns path string or None."""
    fname = f"scaffold_density_{datetime.datetime.now():%Y%m%d_%H%M%S}.csv"
    path = pathlib.Path.cwd() / fname
    try:
        with open(path, "w", newline="") as f:
            wr = csv.writer(f)
            if imperial:
                wr.writerow(["Zone", "Type", "Mass (lb)", "Volume (ft³)", "Density (lb/ft³)",
                             "Standards", "Ledgers", "Transoms", "Braces", "Couplers", "Boards",
                             "Ties", "Component Density (units/ft³)"])
            else:
                wr.writerow(["Zone", "Type", "Mass (kg)", "Volume (m³)", "Density (kg/m³)",
                             "Standards", "Ledgers", "Transoms", "Braces", "Couplers", "Boards",
                             "Ties", "Component Density (units/m³)"])
            for z in zones:
                if imperial:
                    m = round(z["total_mass"] * 2.20462, 1)
                    v = round(z["V"] * 35.3147, 1)
                    d = round(z["mat_density"] * 2.20462 / 35.3147, 2)
                    cd = round(z["comp_density"] / 35.3147, 2)
                else:
                    m = z["total_mass"]
                    v = z["V"]
                    d = z["mat_density"]
                    cd = z["comp_density"]
                wr.writerow([
                    z.get("zone_name", ""), z["scaffold_type"],
                    m, v, d,
                    z["n_standards"], z["n_ledgers"], z["n_transoms"],
                    z["n_braces"], z["n_couplers"], z["n_boards"],
                    z["n_ties"], cd,
                ])
        return str(path)
    except Exception as e:
        return None

def export_project_json(zones, path):
    """Save project to JSON."""
    data = []
    for z in zones:
        data.append({k: v for k, v in z.items()})
    try:
        path.write_text(json.dumps(data, indent=2) + "\n")
        return True
    except:
        return False

def import_project_json(path):
    """Load project from JSON. Returns list of zone dicts or None."""
    try:
        data = json.loads(path.read_text())
        return data if isinstance(data, list) else None
    except:
        return None

# ═══════════════════════════════════════════════════════════
#  FIRST TIME SETUP
# ═══════════════════════════════════════════════════════════

def first_time_setup(win, config):
    """Theme selection on first run."""
    h, w = win.getmaxyx()
    fill_bg(win)
    theme_idx = 0
    while True:
        win.clear()
        fill_bg(win)
        y = draw_header_bar(win, "white")
        safe_addstr(win, y + 1, (w - 16) // 2, "FIRST TIME SETUP", cp(curses.A_BOLD))
        y += 3
        safe_addstr(win, y, 4, "Choose display theme:", cp())
        y += 2
        for i, t in enumerate(THEMES):
            marker = " >" if i == theme_idx else "  "
            nm = THEME_NAMES[t]
            safe_addstr(win, y, 6, f"{marker} [{i+1}] {nm}", cp())
            y += 1
        y += 2
        safe_addstr(win, y, 4, "(Can be changed anytime with F2)", cp(curses.A_DIM))
        y += 2
        safe_addstr(win, y, 4, "Theme [1]: ", cp())
        try:
            win.addch(y, 14, ord(" "), cp() | curses.A_REVERSE)
        except:
            pass
        win.refresh()
        key = win.getch()
        if key == curses.KEY_ENTER or key == 10 or key == 13:
            config["theme"] = THEMES[theme_idx]
            save_config(config)
            return config["theme"]
        elif 49 <= key <= 51:  # 1-3
            theme_idx = key - 49
        elif key == curses.KEY_UP and theme_idx > 0:
            theme_idx -= 1
        elif key == curses.KEY_DOWN and theme_idx < len(THEMES) - 1:
            theme_idx += 1

# ═══════════════════════════════════════════════════════════
#  MAIN INPUT LOOP — collect one zone's parameters
# ═══════════════════════════════════════════════════════════

def input_zone(win, defaults, theme_name):
    """Walk through all input fields, return dict of values or None."""
    apply_theme(win, theme_name)
    inp = dict(defaults)
    y_start = draw_header_bar(win, theme_name) + 1

    fields = [
        ("str",  "Zone name", "zone_name", None, None),
        ("float", "Bay length (m)", "bay_length", None, None),
        ("float", "Lift height (m)", "lift_height", None, None),
        ("int",   "Number of bays", "num_bays", 1, None),
        ("int",   "Number of lifts", "num_lifts", 1, None),
        ("int",   "Boarded lifts", "boarded_lifts", 0, None),
        ("int",   "Boards wide", "boards_wide", 1, None),
        ("float", "Board length (m)", "board_length", None, None),
        ("cycle_tube", "Tube type", "tube_idx", None, None),
        ("cycle_board", "Board type", "board_idx", None, None),
        ("cycle_scaffold", "Scaffold type", "scaffold_idx", None, None),
        ("int",   "Load class (1-6)", "load_class", 1, 6),
        ("bool",  "Include couplers?", "include_couplers", None, None),
        ("bool",  "Include boards?", "include_boards", None, None),
    ]

    for fi, (ftype, label, key, lo, hi) in enumerate(fields):
        win.clear()
        fill_bg(win)
        y = draw_header_bar(win, theme_name)
        safe_addstr(win, y, 2, f"Zone: {inp['zone_name']}  ({fi+1}/{len(fields)})", cp(curses.A_DIM))
        safe_addstr(win, y + 1, (w := win.getmaxyx()[1]) // 2 - 12,
                    "Enter=accept default  Esc=cancel", cp(curses.A_DIM))
        prompt_y = (win.getmaxyx()[0] // 2) - 2

        if ftype == "float":
            val = prompt_float(win, label, inp[key], prompt_y, 4)
            if val is None:
                return None
            inp[key] = val
        elif ftype == "int":
            val = prompt_int(win, label, inp[key], prompt_y, 4, lo, hi)
            if val is None:
                return None
            inp[key] = val
        elif ftype == "bool":
            val = prompt_bool(win, label, inp[key], prompt_y, 4)
            if val is None:
                return None
            inp[key] = val
        elif ftype == "str":
            val = prompt_str(win, label, inp[key], prompt_y, 4)
            if val is None:
                return None
            inp[key] = val
        elif ftype == "cycle_tube":
            opt = [t["label"] for t in TUBE_SPECS]
            val = prompt_cycle(win, label, opt, inp[key], prompt_y, 4)
            if val is None:
                return None
            inp[key] = val
        elif ftype == "cycle_board":
            opt = [b["label"] for b in BOARD_SPECS]
            val = prompt_cycle(win, label, opt, inp[key], prompt_y, 4)
            if val is None:
                return None
            inp[key] = val
        elif ftype == "cycle_scaffold":
            val = prompt_cycle(win, label, SCAFFOLD_TYPES, inp[key], prompt_y, 4)
            if val is None:
                return None
            inp[key] = val

    return inp

# ═══════════════════════════════════════════════════════════
#  SAVE / LOAD PROJECT
# ═══════════════════════════════════════════════════════════

def prompt_save_project(win, zones, theme_name):
    """Save project to JSON with filename prompt."""
    h, w = win.getmaxyx()
    win.clear()
    draw_header_bar(win, theme_name)
    default = f"scaffold_project_{datetime.datetime.now():%Y%m%d_%H%M%S}.json"
    y = 6
    safe_addstr(win, y, 4, "Save project as:", cp())
    fname = prompt_str(win, "Filename", default, y + 2, 4)
    if fname is None:
        return None
    path = pathlib.Path.cwd() / fname
    ok = export_project_json(zones, path)
    if ok:
        safe_addstr(win, y + 4, 4, f"Saved: {path.name}", cp(curses.A_BOLD))
    else:
        safe_addstr(win, y + 4, 4, "Save failed!", cp(curses.A_BOLD))
    win.refresh()
    curses.napms(1500)
    return path if ok else None

def prompt_load_project(win, theme_name):
    """Prompt for file to load. Returns list of zone results or None."""
    h, w = win.getmaxyx()
    win.clear()
    draw_header_bar(win, theme_name)
    y = 6
    safe_addstr(win, y, 4, "Load project file:", cp())
    default = "scaffold_project.json"
    fname = prompt_str(win, "Filename", default, y + 2, 4)
    if fname is None:
        return None
    path = pathlib.Path.cwd() / fname
    if not path.exists():
        safe_addstr(win, y + 4, 4, "File not found!", cp(curses.A_BOLD))
        win.refresh()
        curses.napms(1500)
        return None
    data = import_project_json(path)
    if data is None:
        safe_addstr(win, y + 4, 4, "Invalid file!", cp(curses.A_BOLD))
        win.refresh()
        curses.napms(1500)
    return data

# ═══════════════════════════════════════════════════════════
#  MAIN APPLICATION
# ═══════════════════════════════════════════════════════════

def main_app(stdscr):
    curses.cbreak()
    curses.noecho()
    stdscr.keypad(True)
    curses.curs_set(0)  # hide cursor during draws

    config = load_config()
    if config is None:
        config = {"theme": "white", "defaults": dict(DEFAULT_INPUTS)}
        first_run = True
    else:
        first_run = False
    theme_name = config.get("theme", "white")
    defaults = dict(DEFAULT_INPUTS)
    saved = config.get("defaults", {})
    for k in defaults:
        if k in saved:
            defaults[k] = saved[k]

    if first_run:
        theme_name = first_time_setup(stdscr, config)
        config["theme"] = theme_name
        save_config(config)
    else:
        # Quick boot screen
        h, w = stdscr.getmaxyx()
        fill_bg(stdscr)
        apply_theme(stdscr, theme_name)
        draw_header_bar(stdscr, theme_name)
        y = h // 2 - 2
        safe_addstr(stdscr, y, (w - 12) // 2, "Press any key", cp(curses.A_BOLD))
        stdscr.refresh()
        stdscr.getch()

    apply_theme(stdscr, theme_name)

    zones = []
    imperial = defaults.get("imperial", False)
    running = True

    while running:
        # ── Input phase ──
        inp = input_zone(stdscr, defaults, theme_name)
        if inp is None:
            if zones:
                break
            break

        # ── Calculate ──
        result = calculate_zone(inp)
        result["zone_name"] = inp.get("zone_name", "Zone")
        zones.append(result)

        # Update defaults for next zone
        d = {k: inp[k] for k in DEFAULT_INPUTS if k in inp}
        defaults.update(d)
        defaults["zone_name"] = f"Zone {len(zones) + 1}"
        # Save defaults
        config["defaults"] = {k: defaults[k] for k in DEFAULT_INPUTS if k in defaults}
        save_config(config)

        # ── Show results ──
        while True:
            apply_theme(stdscr, theme_name)
            draw_results(stdscr, result, imperial, theme_name)
            stdscr.refresh()

            # Wait for key
            key = stdscr.getch()
            if key == ord("n") or key == ord("N"):
                break  # next zone
            elif key == ord("q") or key == ord("Q"):
                running = False
                break
            elif key == curses.KEY_F2:
                theme_name = next_theme(theme_name)
                config["theme"] = theme_name
                save_config(config)
                apply_theme(stdscr, theme_name)
            elif key == ord("i") or key == ord("I"):
                imperial = not imperial
            elif key == ord("h") or key == ord("H"):
                draw_help(stdscr, theme_name)
                apply_theme(stdscr, theme_name)
            elif key == ord("s") or key == ord("S"):
                path = export_csv(stdscr, zones, imperial)
                if path:
                    # flash message
                    draw_results(stdscr, result, imperial, theme_name)
                    safe_addstr(stdscr, 1, 2, f"CSV saved: {path}", cp(curses.A_BOLD))
                    stdscr.refresh()
                    curses.napms(2000)
            elif key == 19:  # Ctrl+S
                prompt_save_project(stdscr, zones, theme_name)
                apply_theme(stdscr, theme_name)
            elif key == 15:  # Ctrl+O
                loaded = prompt_load_project(stdscr, theme_name)
                if loaded:
                    zones = loaded
                apply_theme(stdscr, theme_name)

            if key == ord("n") or key == ord("N"):
                break

        if not running:
            break

    # ── Show combined project if multiple zones ──
    if len(zones) > 1:
        while running:
            apply_theme(stdscr, theme_name)
            draw_combined_project(stdscr, zones, imperial, theme_name)
            stdscr.refresh()
            key = stdscr.getch()
            if key == ord("q") or key == ord("Q"):
                break
            elif key == curses.KEY_F2:
                theme_name = next_theme(theme_name)
                config["theme"] = theme_name
                save_config(config)
                apply_theme(stdscr, theme_name)
            elif key == ord("i") or key == ord("I"):
                imperial = not imperial
            elif key == ord("h") or key == ord("H"):
                draw_help(stdscr, theme_name)
                apply_theme(stdscr, theme_name)
            elif key == ord("s") or key == ord("S"):
                path = export_csv(stdscr, zones, imperial)
                if path:
                    draw_combined_project(stdscr, zones, imperial, theme_name)
                    safe_addstr(stdscr, 1, 2, f"CSV saved: {path}", cp(curses.A_BOLD))
                    stdscr.refresh()
                    curses.napms(2000)
            elif key == 19:
                prompt_save_project(stdscr, zones, theme_name)
                apply_theme(stdscr, theme_name)
            elif key == 15:
                loaded = prompt_load_project(stdscr, theme_name)
                if loaded:
                    zones = loaded
                apply_theme(stdscr, theme_name)
    elif len(zones) == 1 and running:
        # Just one zone, wait for key
        key = stdscr.getch()
        # allow navigation from single zone too

    # ── Finalize ──
    save_config(config)

def run():
    try:
        curses.wrapper(main_app)
    except KeyboardInterrupt:
        pass
    except Exception as e:
        # Terminal should be restored by wrapper
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run()
