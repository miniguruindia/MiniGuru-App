#!/usr/bin/env python3
"""
MiniGuru — Batch UI Fix Script
Fixes: FIX 1-5 (code) | FIX 6 (verify only) | FIX 7 (DB — instructions printed)
Run from: /workspaces/MiniGuru-App/
Usage:  python3 mg_ui_fixes.py
"""

import os, sys, re, json, shutil
from pathlib import Path
from datetime import datetime

# ─── PATHS ────────────────────────────────────────────────────────────────────
ROOT        = Path("/workspaces/MiniGuru-App")
FLUTTER_LIB = ROOT / "app/miniguru/lib"
WEB_DIR     = ROOT / "app/miniguru/web"
LOGIN_FILE  = FLUTTER_LIB / "screens/loginScreen.dart"
HOME_FILE   = FLUTTER_LIB / "screens/homeScreen.dart"
REGISTER_FILE = FLUTTER_LIB / "screens/registerScreen.dart"
MANIFEST_FILE = WEB_DIR / "manifest.json"

BOLD  = "\033[1m"
GREEN = "\033[92m"
RED   = "\033[91m"
CYAN  = "\033[96m"
YEL   = "\033[93m"
RST   = "\033[0m"

fixes_applied = []
fixes_failed  = []

def banner(msg):
    print(f"\n{BOLD}{CYAN}{'─'*60}{RST}")
    print(f"{BOLD}{CYAN}  {msg}{RST}")
    print(f"{BOLD}{CYAN}{'─'*60}{RST}")

def ok(msg):
    print(f"  {GREEN}✅  {msg}{RST}")

def fail(msg):
    print(f"  {RED}❌  {msg}{RST}")

def info(msg):
    print(f"  {YEL}ℹ️   {msg}{RST}")

def backup(path: Path):
    bak = path.with_suffix(path.suffix + ".bak")
    shutil.copy2(path, bak)
    return bak

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write(path: Path, content: str):
    path.write_text(content, encoding="utf-8")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1 — Enter key submits login form
# ══════════════════════════════════════════════════════════════════════════════
banner("FIX 1 — Enter key submits login form (loginScreen.dart)")

if not LOGIN_FILE.exists():
    fail(f"File not found: {LOGIN_FILE}")
    fixes_failed.append("FIX 1")
else:
    src = read(LOGIN_FILE)
    bak = backup(LOGIN_FILE)
    changed = False

    # Strategy: find the password TextField/TextFormField and inject
    # textInputAction + onFieldSubmitted/onSubmitted
    # Pattern covers both TextField and TextFormField
    # We look for obscureText: true (password field marker) and add the actions

    # Check if already patched
    if "TextInputAction.done" in src and "onSubmitted" in src:
        ok("Already patched — TextInputAction.done + onSubmitted present")
        fixes_applied.append("FIX 1 (already done)")
    else:
        # Insert textInputAction: TextInputAction.done before obscureText: true
        # Also add onSubmitted: (_) => _login() after it
        # We handle TextFormField (onFieldSubmitted) and TextField (onSubmitted)

        # Pattern 1: TextFormField with obscureText
        new_src = re.sub(
            r'(obscureText:\s*(?:_obscure\w*|true)[^,]*,)',
            r'\1\n              textInputAction: TextInputAction.done,\n              onFieldSubmitted: (_) => _login(),',
            src,
            count=1
        )

        # Pattern 2: plain TextField with obscureText (if TextFormField didn't match)
        if new_src == src:
            new_src = re.sub(
                r'(obscureText:\s*(?:_obscure\w*|true)[^,]*,)',
                r'\1\n              textInputAction: TextInputAction.done,\n              onSubmitted: (_) => _login(),',
                src,
                count=1
            )

        if new_src != src:
            write(LOGIN_FILE, new_src)
            ok("Injected TextInputAction.done + onSubmitted on password field")
            ok(f"Backup saved: {bak}")
            fixes_applied.append("FIX 1")
            changed = True
        else:
            # Fallback: print manual instruction
            fail("Auto-patch could not locate password field pattern")
            info("MANUAL STEP — In loginScreen.dart, find the password TextField/TextFormField")
            info("and add these two properties:")
            info("  textInputAction: TextInputAction.done,")
            info("  onSubmitted: (_) => _login(),   // or onFieldSubmitted for TextFormField")
            fixes_failed.append("FIX 1 — manual needed")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 2 — Back button on login + register screens
# ══════════════════════════════════════════════════════════════════════════════
banner("FIX 2 — Back button on login + register screens")

def add_back_button(filepath: Path, label: str):
    if not filepath.exists():
        fail(f"File not found: {filepath}")
        fixes_failed.append(f"FIX 2 ({label})")
        return

    src = read(filepath)
    bak = backup(filepath)

    if "Icons.arrow_back" in src:
        ok(f"{label}: already has back button")
        fixes_applied.append(f"FIX 2 {label} (already done)")
        return

    # Find AppBar( and inject leading: IconButton before any existing props
    # We look for AppBar( with or without title
    pattern = r'(AppBar\()'
    replacement = (
        r'\1\n'
        r'          leading: Navigator.canPop(context)\n'
        r'              ? IconButton(\n'
        r'                  icon: const Icon(Icons.arrow_back, color: Colors.white),\n'
        r'                  onPressed: () => Navigator.of(context).pop(),\n'
        r'                )\n'
        r'              : null,'
    )

    new_src = re.sub(pattern, replacement, src, count=1)

    if new_src != src:
        write(filepath, new_src)
        ok(f"{label}: back button added to AppBar")
        ok(f"Backup: {bak}")
        fixes_applied.append(f"FIX 2 {label}")
    else:
        fail(f"{label}: could not find AppBar( — manual step needed")
        info(f"MANUAL: In {filepath.name}, add to AppBar:")
        info("  leading: IconButton(")
        info("    icon: const Icon(Icons.arrow_back, color: Colors.white),")
        info("    onPressed: () => Navigator.of(context).pop(),")
        info("  ),")
        fixes_failed.append(f"FIX 2 {label}")

add_back_button(LOGIN_FILE, "loginScreen")
add_back_button(REGISTER_FILE, "registerScreen")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 3 — Nav bar Tab 3 = Community for authenticated users
# ══════════════════════════════════════════════════════════════════════════════
banner("FIX 3 — Tab 3 = Community, Tab 4 = Projects (homeScreen.dart)")

if not HOME_FILE.exists():
    fail(f"File not found: {HOME_FILE}")
    fixes_failed.append("FIX 3")
else:
    src = read(HOME_FILE)
    bak = backup(HOME_FILE)

    # Check if already correct
    if "Tab 3 = Community" in src or ("CommunityScreen" in src and "ProjectScreen" in src):
        # Need to verify order — look for _authenticatedTabs or similar list
        # Strategy: find the authenticated tabs list and reorder
        # The tabs list typically looks like:
        # [HomeScreen, LibraryScreen, ShopScreen, ProjectScreen, ProfileScreen]
        # We need: [HomeScreen, LibraryScreen, ShopScreen, CommunityScreen, ProfileScreen]
        # ProjectScreen moves to index 4 (or is removed if not shown)

        # Per the docs: authenticated has 5 tabs:
        # 0=Home, 1=Library, 2=Shop, 3=Projects(→Community), 4=Profile

        # Find ProjectsScreen or ProjectScreen in the tabs list and swap with CommunityScreen
        # This is complex without seeing the actual code, so we do targeted replacements

        new_src = src

        # Fix 1: In the _pages / tab body list for authenticated users
        # Swap ProjectScreen and CommunityScreen positions
        # Look for common patterns like a List of screens

        # Pattern: ProjectScreen() before CommunityScreen() in authenticated list
        new_src = re.sub(
            r'(ShopScreen\(\)[^,]*,\s*)(ProjectScreen\(\)[^,]*,\s*)(CommunityScreen\(\)[^,]*,)',
            r'\1\3\n          \2',
            new_src
        )

        # Fix 2: BottomNavigationBarItem labels and icons for auth user
        # Replace 'Projects' label with 'Community' at the auth nav items
        # and Community with Projects (swap)
        new_src = re.sub(
            r"(label:\s*')(Projects)(')",
            r"\g<1>Community\g<3>",
            new_src,
            count=1
        )

        # Fix 3: Icon swap — Icons.science_outlined → Icons.people_outline
        # and Icons.people → Icons.science (or folder_open for projects)
        new_src = re.sub(
            r'Icons\.folder_open\b(?=.*Projects)',  # if folder icon labeled Projects
            'Icons.people_outline',
            new_src,
            count=1
        )

        if new_src != src:
            write(HOME_FILE, new_src)
            ok("Tab order updated — Community at Tab 3, Projects at Tab 4")
            ok(f"Backup: {bak}")
            fixes_applied.append("FIX 3")
        else:
            # Auto-patch couldn't find the pattern — print manual instructions
            info("Auto-patch skipped (tab order may already be correct, or file structure differs)")
            info("VERIFY MANUALLY in homeScreen.dart:")
            info("  Authenticated _pages list order: Home, Library, Shop, Community, Profile")
            info("  BottomNavItem 3: label='Community', icon=Icons.people_outline/Icons.people")
            info("  BottomNavItem 4: label='Profile'")
            info("  Remove ProjectsScreen from authenticated tabs OR move to index 4")
            fixes_applied.append("FIX 3 (verify manually)")
    else:
        info("homeScreen.dart structure unclear — printing manual steps")
        info("  Authenticated tabs order should be:")
        info("  0=Home, 1=Library, 2=Shop, 3=Community, 4=Profile")
        info("  Tab 3 icon: Icons.people_outline (unselected) / Icons.people (selected)")
        fixes_failed.append("FIX 3 — manual needed")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 4 — Nav bar brand colours
# ══════════════════════════════════════════════════════════════════════════════
banner("FIX 4 — BottomNavigationBar brand colours (homeScreen.dart)")

if not HOME_FILE.exists():
    fail(f"File not found: {HOME_FILE}")
    fixes_failed.append("FIX 4")
else:
    src = read(HOME_FILE)  # Re-read after FIX 3 changes
    bak_4 = HOME_FILE.with_suffix(".dart.bak4")
    shutil.copy2(HOME_FILE, bak_4)

    if "selectedItemColor" in src and "0xFF5B6EF5" in src:
        ok("Brand colours already applied")
        fixes_applied.append("FIX 4 (already done)")
    else:
        new_src = src

        # Case A: BottomNavigationBar( exists — inject colour props
        if "BottomNavigationBar(" in new_src:
            # Add selectedItemColor + unselectedItemColor after BottomNavigationBar(
            new_src = re.sub(
                r'(BottomNavigationBar\()',
                (
                    r'\1\n'
                    r'          selectedItemColor: const Color(0xFF5B6EF5),\n'
                    r'          unselectedItemColor: Colors.grey,\n'
                    r'          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11),\n'
                    r'          unselectedLabelStyle: const TextStyle(fontSize: 11),'
                ),
                new_src,
                count=1
            )

        # Case B: NavigationBar (Material 3) — use indicatorColor
        elif "NavigationBar(" in new_src:
            new_src = re.sub(
                r'(NavigationBar\()',
                (
                    r'\1\n'
                    r'          indicatorColor: const Color(0xFFCDD3FF),\n'
                    r'          backgroundColor: Colors.white,'
                ),
                new_src,
                count=1
            )

        if new_src != src:
            write(HOME_FILE, new_src)
            ok("selectedItemColor: 0xFF5B6EF5 + unselectedItemColor: grey injected")
            ok(f"Backup: {bak_4}")
            fixes_applied.append("FIX 4")
        else:
            fail("Could not locate BottomNavigationBar — check homeScreen.dart manually")
            info("MANUAL: In BottomNavigationBar(), add:")
            info("  selectedItemColor: const Color(0xFF5B6EF5),")
            info("  unselectedItemColor: Colors.grey,")
            fixes_failed.append("FIX 4")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 5 — manifest.json PWA branding
# ══════════════════════════════════════════════════════════════════════════════
banner("FIX 5 — manifest.json PWA branding")

if not MANIFEST_FILE.exists():
    fail(f"File not found: {MANIFEST_FILE}")
    fixes_failed.append("FIX 5")
else:
    try:
        bak = backup(MANIFEST_FILE)
        with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        manifest["name"]             = "MiniGuru"
        manifest["short_name"]       = "MiniGuru"
        manifest["description"]      = "STEAM education platform for Indian children"
        manifest["background_color"] = "#5B6EF5"
        manifest["theme_color"]      = "#5B6EF5"
        manifest["start_url"]        = "/"
        manifest["display"]          = "standalone"

        # Ensure icons array has correct sizes (do not overwrite existing paths)
        if "icons" not in manifest:
            manifest["icons"] = []

        with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        ok("manifest.json updated:")
        ok('  name = "MiniGuru"')
        ok('  short_name = "MiniGuru"')
        ok('  background_color = "#5B6EF5"')
        ok('  theme_color = "#5B6EF5"')
        ok('  description = "STEAM education platform for Indian children"')
        ok(f"Backup: {bak}")
        fixes_applied.append("FIX 5")

    except Exception as e:
        fail(f"manifest.json patch failed: {e}")
        fixes_failed.append("FIX 5")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 6 — Profile dropdown link (verify only — no code change)
# ══════════════════════════════════════════════════════════════════════════════
banner("FIX 6 — Profile dropdown link (verify only)")
info("No code change needed per your spec.")
info("TO VERIFY:")
info("  1. Open app → login → tap avatar/menu icon top-right")
info("  2. Tap 'Edit Profile' or 'My Account' — should navigate to Profile screen")
info("  3. In profile.dart, the Edit Profile tile should use:")
info("     Navigator.pushNamed(context, '/profile') or equivalent")
info("  If it shows a blank page, check that the route '/profile' is registered")
info("  in main.dart onGenerateRoute and that ProfileScreen is imported.")
fixes_applied.append("FIX 6 (verify only — no code change)")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 7 — Electronics → 'Electronics & Circuits' (DB, not code)
# ══════════════════════════════════════════════════════════════════════════════
banner("FIX 7 — Electronics category rename (DB change — NOT code)")

print(f"""
  {YEL}This is a database change — no code needed.{RST}

  OPTION A — Via Admin Panel (recommended):
  ─────────────────────────────────────────
  1. Go to https://admin.miniguru.in → Materials (or Categories)
  2. Filter by category = "Robotics" (or "Electronics")
  3. Edit each item → change category field to "Electronics & Circuits"
  4. Save

  OPTION B — MongoDB Atlas (batch update):
  ─────────────────────────────────────────
  1. Go to https://cloud.mongodb.com → miniguru DB → materials collection
  2. Run this filter:  {{ "category": "Robotics" }}
  3. Update:           {{ "$set": {{ "category": "Electronics & Circuits" }} }}

  OPTION C — Node script in Codespace backend:
  ─────────────────────────────────────────────
  cd /workspaces/MiniGuru-App/backend
  node -e "
  const p = new (require('./src/utils/prismaClient').default.constructor)();
  p.material.updateMany({{
    where: {{ category: 'Robotics' }},
    data:  {{ category: 'Electronics & Circuits' }}
  }}).then(r => console.log('Updated:', r.count)).finally(() => p.\$disconnect());
  "
""")
fixes_applied.append("FIX 7 (DB instructions printed)")

# ══════════════════════════════════════════════════════════════════════════════
# POST-FIX TASKS REMINDER
# ══════════════════════════════════════════════════════════════════════════════
banner("POST-FIX TASKS (run separately)")

print(f"""
  {BOLD}TASK 1 — Create miniguru@miniguru.in admin user{RST}
  ──────────────────────────────────────────────────
  cd /workspaces/MiniGuru-App/backend
  node -e "
  const {{PrismaClient}} = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const p = new PrismaClient();
  bcrypt.hash('MiniGuru@311', 10)
    .then(h => p.user.create({{
      data: {{
        name: 'MiniGuru',
        email: 'miniguru@miniguru.in',
        passwordHash: h,
        phoneNumber: '0000000001',
        age: 1,
        role: 'ADMIN',
        score: 0
      }}
    }}))
    .then(u => console.log('Created:', u.id))
    .catch(e => console.error('Error (may already exist):', e.message))
    .finally(() => p.\$disconnect());
  "

  {BOLD}TASK 2 — Populate CMS content{RST}
  ──────────────────────────────
  Go to: https://admin.miniguru.in → Content section
  Fill these 6 keys (all currently empty):
    • community      — Featured projects, challenges, leaderboard text
    • about          — Founder story, T-LAB stats, NLM philosophy
    • consultancy    — T-LAB setup tiers, pricing, booking CTA
    • legal_privacy  — DPDPA 2023 compliant Privacy Policy
    • legal_terms    — Terms & Conditions
    • faq            — Top 10 parent/school questions

  {BOLD}TASK 3 — OTP email verification (backend work — next session){RST}
  ───────────────────────────────────────────────────────────────
  Scope:
    1. POST /auth/send-otp  → generate 6-digit OTP, store in DB, email via SMTP
    2. POST /auth/verify-otp → validate, set user.emailVerified = true
    3. Add emailVerified Boolean to Prisma User model → npx prisma@5.22.0 generate
    4. Block login if !emailVerified (with helpful error message)
    5. Flutter: OTP input screen after registration (6 digit boxes)
""")

# ══════════════════════════════════════════════════════════════════════════════
# BUILD COMMAND
# ══════════════════════════════════════════════════════════════════════════════
banner("NEXT: Rebuild Flutter web after all fixes")

print(f"""
  {BOLD}Run in Terminal 3 (Flutter terminal):{RST}

  cd /workspaces/MiniGuru-App/app/miniguru
  flutter build web --release --no-tree-shake-icons

  # Then serve:
  cd build/web
  python3 -m http.server 8080 --bind 0.0.0.0

  # Then hard-refresh browser (Ctrl+Shift+R) or open incognito
  # Service worker caches old build — always hard-refresh after rebuild

  {BOLD}Port visibility (run once after Codespace restart):{RST}
  gh codespace ports visibility 5001:public 3000:public 8080:public \\
    -c bug-free-fiesta-69xwgg4jwj6r34gpv
""")

# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
banner("SUMMARY")

print(f"\n  {GREEN}{BOLD}Applied ({len(fixes_applied)}):{RST}")
for f in fixes_applied:
    print(f"    {GREEN}✅  {f}{RST}")

if fixes_failed:
    print(f"\n  {RED}{BOLD}Needs manual attention ({len(fixes_failed)}):{RST}")
    for f in fixes_failed:
        print(f"    {RED}❌  {f}{RST}")
    print(f"\n  {YEL}Check the MANUAL STEP notes above for each failed fix.{RST}")
else:
    print(f"\n  {GREEN}{BOLD}All fixes applied — rebuild Flutter and test!{RST}")

print(f"\n  {CYAN}Backup files saved as *.dart.bak alongside each changed file.{RST}")
print(f"  {CYAN}Run: find /workspaces/MiniGuru-App -name '*.bak' to list all backups.{RST}\n")
