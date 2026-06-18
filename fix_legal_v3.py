#!/usr/bin/env python3
"""
Fix legalScreen.dart:
1. _extractString reads sections array from CMS parsed map
2. Updates wrong emails and company name in hardcoded fallbacks
3. Fixes FAQ to use correct shop/Goins description
Uses string concatenation instead of f-strings to avoid Dart quote issues.
"""
import shutil

TARGET = '/workspaces/MiniGuru-App/app/miniguru/lib/screens/legalScreen.dart'
with open(TARGET, 'r') as f:
    content = f.read()

shutil.copy(TARGET, TARGET + '.bak')
changes = 0

# ── Fix 1: _extractString — read sections from parsed map ─────────────
OLD = """  String _extractString(Map<String, dynamic>? data, String fallback) {
    if (data == null) return fallback;
    if (data['content'] is String) return data['content'] as String;
    return fallback;
  }"""

NEW = (
    "  String _extractString(Map<String, dynamic>? data, String fallback) {\n"
    "    if (data == null) return fallback;\n"
    "    if (data['content'] is String) return data['content'] as String;\n"
    "    // CMS returns parsed map with title + sections array\n"
    "    try {\n"
    "      final sections = data['sections'] as List<dynamic>?;\n"
    "      if (sections != null && sections.isNotEmpty) {\n"
    "        final sb = StringBuffer();\n"
    "        final title = data['title']?.toString() ?? '';\n"
    "        final updated = data['lastUpdated']?.toString() ?? '';\n"
    "        if (title.isNotEmpty) { sb.writeln('# ' + title); }\n"
    "        if (updated.isNotEmpty) { sb.writeln('Last updated: ' + updated); sb.writeln(); }\n"
    "        for (final s in sections) {\n"
    "          final m = s as Map<String, dynamic>;\n"
    "          final heading = m['heading']?.toString() ?? '';\n"
    "          final body    = m['body']?.toString() ?? '';\n"
    "          if (heading.isNotEmpty) sb.writeln('## ' + heading);\n"
    "          if (body.isNotEmpty)    sb.writeln(body);\n"
    "          sb.writeln();\n"
    "        }\n"
    "        return sb.toString();\n"
    "      }\n"
    "    } catch (_) {}\n"
    "    return fallback;\n"
    "  }"
)

if OLD in content:
    content = content.replace(OLD, NEW)
    print('✅ Fix 1: _extractString updated')
    changes += 1
else:
    print('ERROR: Could not find _extractString')

# ── Fix 2: wrong emails in fallbacks ──────────────────────────────────
replacements = [
    ('privacy@miniguru.in', 'connect@miniguru.in'),
    ('legal@miniguru.in', 'connect@miniguru.in'),
    ('hello@miniguru.in', 'connect@miniguru.in'),
    ('orders@miniguru.in', 'connect@miniguru.in'),
    ('MiniGuru India Private Limited', 'MiniGuru Innovation Private Limited'),
    ('March 2025', 'June 2026'),
]
for old, new in replacements:
    n = content.count(old)
    if n:
        content = content.replace(old, new)
        print(f'✅ Fix 2: {n}x "{old}" → "{new}"')
        changes += 1

# ── Fix 3: FAQ — remove wallet/Razorpay references ─────────────────────
OLD_FAQ = (
    "    {\n"
    "      'question': 'How does a parent top up the wallet?',\n"
    "      'answer':   'Go to your child\\'s Profile → Wallet → Add Money. You can add any amount via Razorpay (UPI, card, or net banking). The balance is then available for your child to spend in the shop.',\n"
    "    },\n"
    "    {\n"
    "      'question': 'How does ordering from the shop work?',\n"
    "      'answer':   'Your child browses the shop, adds items to cart, and checks out using their wallet balance. You receive a confirmation and the materials are physically dispatched to your delivery address.',\n"
    "    },"
)

NEW_FAQ = (
    "    {\n"
    "      'question': 'How does the shop work?',\n"
    "      'answer':   'Your child browses 200+ STEAM materials and adds them to a kit. They tap \"Send to Parent\" and you receive an email with the full list and a one-tap Amazon buy link. No MiniGuru account needed to buy.',\n"
    "    },\n"
    "    {\n"
    "      'question': 'What are Goins?',\n"
    "      'answer':   'Goins are earned by completing projects and uploading videos. They are a motivation tracker showing your child\\'s progress. Goins are never deducted and cannot be used to buy anything.',\n"
    "    },"
)

if OLD_FAQ in content:
    content = content.replace(OLD_FAQ, NEW_FAQ)
    print('✅ Fix 3: FAQ updated — removed wallet/Razorpay')
    changes += 1
else:
    print('⚠️  Fix 3: FAQ pattern not found')

# ── Fix 4: also update Goins description in Terms fallback ─────────────
OLD_GOINS = (
    "- Goins have **no real monetary value** and cannot be exchanged for cash.\n"
    "- Goins can be spent in the MiniGuru shop on STEAM materials.\n"
    "- Parents top up the wallet balance via Razorpay for shop purchases."
)
NEW_GOINS = (
    "- Goins have **no real monetary value** and cannot be exchanged for cash.\n"
    "- Goins are a motivation tracker — earned by building, never deducted.\n"
    "- Materials are purchased via Amazon affiliate links — no MiniGuru payment needed."
)
if OLD_GOINS in content:
    content = content.replace(OLD_GOINS, NEW_GOINS)
    print('✅ Fix 4: Goins description in Terms updated')
    changes += 1

with open(TARGET, 'w') as f:
    f.write(content)

print(f'\n✅ {changes} fix(es) applied to legalScreen.dart')
