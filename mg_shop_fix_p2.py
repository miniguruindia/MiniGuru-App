#!/usr/bin/env python3
"""
mg_shop_fix_p2.py
Run from /workspaces/MiniGuru-App/
Inserts the missing Amazon helper methods before _openDetail().
Also fixes any \$ sequences left by previous patchers.
"""

import os, sys

FILE = 'app/miniguru/lib/screens/navScreen/shop.dart'
if not os.path.exists(FILE):
    sys.exit('ERROR: Run from /workspaces/MiniGuru-App/')

with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

print('\n=== mg_shop_fix_p2.py ===\n')

# ── Fix 1: backslash-dollar cleanup ──────────────────────────────────────────
bad = src.count('\\$')
if bad:
    src = src.replace('\\$', '$')
    print(f'  Fixed {bad} backslash-dollar(s)')
else:
    print('  No backslash-dollar issues')

# ── Fix 2: Insert helpers before _openDetail ─────────────────────────────────
ANCHOR = '  void _openDetail('

HELPERS = '''\
  // ── Amazon helpers ────────────────────────────────────────────────────────
  String? _extractAsin(String url) {
    final re = RegExp(r'/dp/([A-Z0-9]{10})');
    return re.firstMatch(url)?.group(1);
  }

  String _buildAmazonCartUrl() {
    const tag = 'miniguru08-21';
    final parts = <String>[];
    int i = 1;
    for (final item in _amazonList.values) {
      parts.add('ASIN.$i=${item["asin"]}&Quantity.$i=${item["qty"]}');
      i++;
    }
    return 'https://www.amazon.in/gp/aws/cart/add.html?'
        '${parts.join("&")}&tag=$tag';
  }

  void _addToAmazonList(Map<String, dynamic> p) {
    final id   = p['id']?.toString() ?? '';
    final asin = _extractAsin(p['amazonUrl']?.toString() ?? '');
    if (asin == null) return;
    setState(() {
      if (_amazonList.containsKey(id)) {
        _amazonList[id]!['qty'] = (_amazonList[id]!['qty'] as int) + 1;
      } else {
        _amazonList[id] = {
          'name':     p['name']?.toString() ?? '',
          'price':    double.tryParse(p['price']?.toString() ?? '0') ?? 0.0,
          'qty':      1,
          'asin':     asin,
          'thumbUrl': _thumb(p['images']),
        };
      }
      _amazonCount = _amazonList.values
          .fold(0, (s, v) => s + (v['qty'] as int));
    });
  }

  void _removeFromAmazonList(Map<String, dynamic> p) {
    final id = p['id']?.toString() ?? '';
    if (!_amazonList.containsKey(id)) return;
    setState(() {
      final qty = (_amazonList[id]!['qty'] as int) - 1;
      if (qty <= 0) _amazonList.remove(id);
      else _amazonList[id]!['qty'] = qty;
      _amazonCount = _amazonList.values
          .fold(0, (s, v) => s + (v['qty'] as int));
    });
  }

  void _showAmazonCheckout() {
    if (_amazonList.isEmpty) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AmazonCheckoutSheet(
        amazonList: _amazonList,
        cartUrl:    _buildAmazonCartUrl(),
        onRemove: (id) {
          setState(() {
            _amazonList.remove(id);
            _amazonCount = _amazonList.values
                .fold(0, (s, v) => s + (v['qty'] as int));
          });
          if (_amazonList.isEmpty) Navigator.pop(context);
        },
        onClearAll: () {
          setState(() { _amazonList.clear(); _amazonCount = 0; });
          Navigator.pop(context);
        },
      ),
    );
  }

'''

if ANCHOR not in src:
    sys.exit('ERROR: "void _openDetail(" not found in file. Check the file state.')

if '_buildAmazonCartUrl' in src:
    print('  Amazon helpers already present — skipping insert')
else:
    src = src.replace(ANCHOR, HELPERS + ANCHOR, 1)
    print('  Inserted Amazon helpers before _openDetail()')

# ── Write ─────────────────────────────────────────────────────────────────────
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)

# ── Verify ────────────────────────────────────────────────────────────────────
checks = [
    ('_amazonList declared',        '_amazonList = {}' in src),
    ('_addToAmazonList defined',    'void _addToAmazonList(' in src),
    ('_removeFromAmazonList defined','void _removeFromAmazonList(' in src),
    ('_showAmazonCheckout defined', 'void _showAmazonCheckout(' in src),
    ('_buildAmazonCartUrl defined', 'String _buildAmazonCartUrl(' in src),
    ('FAB references checkout',     '_showAmazonCheckout' in src),
    ('amazonQty in _ProductTile',   'amazonQty' in src),
    ('_AmazonCheckoutSheet exists', 'class _AmazonCheckoutSheet' in src),
    ('No backslash-dollars left',   '\\$' not in src),
]

print('\n--- Verification ---')
all_ok = True
for label, ok in checks:
    icon = '✓' if ok else '✗ FAIL'
    if not ok: all_ok = False
    print(f'  {icon}  {label}')

print()
if all_ok:
    print('All checks passed. Build now:')
    print('  cd app/miniguru && flutter build web --release --no-tree-shake-icons')
else:
    print('Some checks failed — paste this output.')
