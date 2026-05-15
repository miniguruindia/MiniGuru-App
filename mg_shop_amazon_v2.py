#!/usr/bin/env python3
"""
mg_shop_amazon_v2.py
Run from /workspaces/MiniGuru-App/

Clean Amazon cart integration using exact anchors from actual file.
Uses FAB for Amazon cart button — avoids touching complex AppBar nesting.

Changes:
  1. Add _amazonList + _amazonCount state fields
  2. Add Amazon helper methods (_extractAsin, _buildAmazonCartUrl,
     _addToAmazonList, _removeFromAmazonList, _showAmazonCheckout)
  3. Add FAB to Scaffold (orange bag icon when Amazon items selected)
  4. Grid builder passes amazonQty to _ProductTile
  5. _ProductTile gets amazonQty field + replaces _AffiliateButton
     with qty stepper for Amazon items
  6. _stepBtn gets optional color param
  7. Append _AmazonCheckoutSheet widget at end of file
"""

import os, sys

FILE    = 'app/miniguru/lib/screens/navScreen/shop.dart'

if not os.path.exists(FILE):
    sys.exit(f'ERROR: {FILE} not found. Run from /workspaces/MiniGuru-App/')

with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

patches = []

def apply(label, old, new):
    global src
    if old not in src:
        print(f'  SKIP (not found): {label}')
        return False
    src = src.replace(old, new, 1)
    patches.append(label)
    print(f'  OK: {label}')
    return True

print('\n=== mg_shop_amazon_v2.py ===\n')

# ── P1: Add Amazon state fields after _cartQty declaration ───────────────────
apply('P1: Amazon state fields',
    '  final Map<String, int>    _cartQty    = {};',
    '  final Map<String, int>    _cartQty    = {};\n\n'
    '  // Amazon shopping list — productId → {name, price, qty, asin, thumbUrl}\n'
    '  final Map<String, Map<String, dynamic>> _amazonList = {};\n'
    '  int _amazonCount = 0;'
)

# ── P2: Add Amazon helpers before _openDetail ─────────────────────────────────
apply('P2: Amazon helper methods',
    '  // ── Open detail page ───────────────────────────────────────────────────────',
    '  // ── Amazon helpers ────────────────────────────────────────────────────────\n'
    '  String? _extractAsin(String url) {\n'
    "    final re = RegExp(r'/dp/([A-Z0-9]{10})');\n"
    "    return re.firstMatch(url)?.group(1);\n"
    '  }\n\n'
    '  String _buildAmazonCartUrl() {\n'
    "    const tag = 'miniguru08-21';\n"
    "    final buf = StringBuffer('https://www.amazon.in/gp/aws/cart/add.html?');\n"
    '    int i = 1;\n'
    '    for (final item in _amazonList.values) {\n'
    "      buf.write('ASIN.$i=\${item[\"asin\"]}&Quantity.$i=\${item[\"qty\"]}&');\n"
    '      i++;\n'
    '    }\n'
    "    buf.write('tag=$tag');\n"
    '    return buf.toString();\n'
    '  }\n\n'
    '  void _addToAmazonList(Map<String, dynamic> p) {\n'
    "    final id   = p['id']?.toString() ?? '';\n"
    "    final asin = _extractAsin(p['amazonUrl']?.toString() ?? '');\n"
    '    if (asin == null) return;\n'
    '    setState(() {\n'
    '      if (_amazonList.containsKey(id)) {\n'
    "        _amazonList[id]!['qty'] = (_amazonList[id]!['qty'] as int) + 1;\n"
    '      } else {\n'
    '        _amazonList[id] = {\n'
    "          'name':     p['name']?.toString() ?? '',\n"
    "          'price':    double.tryParse(p['price']?.toString() ?? '0') ?? 0.0,\n"
    "          'qty':      1,\n"
    "          'asin':     asin,\n"
    "          'thumbUrl': _thumb(p['images']),\n"
    '        };\n'
    '      }\n'
    '      _amazonCount = _amazonList.values\n'
    '          .fold(0, (s, v) => s + (v[\'qty\'] as int));\n'
    '    });\n'
    '  }\n\n'
    '  void _removeFromAmazonList(Map<String, dynamic> p) {\n'
    "    final id = p['id']?.toString() ?? '';\n"
    '    if (!_amazonList.containsKey(id)) return;\n'
    '    setState(() {\n'
    "      final qty = (_amazonList[id]!['qty'] as int) - 1;\n"
    '      if (qty <= 0) _amazonList.remove(id);\n'
    "      else _amazonList[id]!['qty'] = qty;\n"
    '      _amazonCount = _amazonList.values\n'
    '          .fold(0, (s, v) => s + (v[\'qty\'] as int));\n'
    '    });\n'
    '  }\n\n'
    '  void _showAmazonCheckout() {\n'
    '    if (_amazonList.isEmpty) return;\n'
    '    showModalBottomSheet(\n'
    '      context: context,\n'
    '      isScrollControlled: true,\n'
    '      backgroundColor: Colors.transparent,\n'
    '      builder: (_) => _AmazonCheckoutSheet(\n'
    '        amazonList: _amazonList,\n'
    '        cartUrl:    _buildAmazonCartUrl(),\n'
    '        onRemove: (id) {\n'
    '          setState(() {\n'
    '            _amazonList.remove(id);\n'
    '            _amazonCount = _amazonList.values\n'
    '                .fold(0, (s, v) => s + (v[\'qty\'] as int));\n'
    '          });\n'
    '          if (_amazonList.isEmpty) Navigator.pop(context);\n'
    '        },\n'
    '        onClearAll: () {\n'
    '          setState(() { _amazonList.clear(); _amazonCount = 0; });\n'
    '          Navigator.pop(context);\n'
    '        },\n'
    '      ),\n'
    '    );\n'
    '  }\n\n'
    '  // ── Open detail page ───────────────────────────────────────────────────────'
)

# ── P3: Add FAB to Scaffold ───────────────────────────────────────────────────
apply('P3: FAB for Amazon cart',
    '      backgroundColor: _bg,\n'
    '      body: NestedScrollView(',
    '      backgroundColor: _bg,\n'
    '      floatingActionButton: _amazonCount > 0\n'
    '          ? FloatingActionButton.extended(\n'
    '              onPressed: _showAmazonCheckout,\n'
    '              backgroundColor: const Color(0xFFFF9900),\n'
    "              icon: const Icon(Icons.shopping_bag_outlined, color: Colors.white),\n"
    "              label: Text('Amazon List ($_amazonCount)',\n"
    '                  style: GoogleFonts.nunito(\n'
    '                      fontWeight: FontWeight.w900,\n'
    '                      color: Colors.white, fontSize: 13)),\n'
    '            )\n'
    '          : null,\n'
    '      body: NestedScrollView('
)

# ── P4: Grid builder — pass amazonQty to _ProductTile ────────────────────────
apply('P4: Grid passes amazonQty',
    "            final p   = _filtered[i];\n"
    "            final id  = p['id']?.toString() ?? '';\n"
    "            final qty = _cartQty[id] ?? 0;\n"
    "            return _ProductTile(\n"
    "              product:     p,\n"
    "              thumbUrl:    _thumb(p['images']),\n"
    "              cartQty:     qty,\n"
    "              onTap:       () => _openDetail(p),\n"
    "              onAddCart:   () => _addToCart(p),\n"
    "              onIncrement: () => _increment(p),\n"
    "              onDecrement: () => _decrement(p),\n"
    "            );",
    "            final p      = _filtered[i];\n"
    "            final id     = p['id']?.toString() ?? '';\n"
    "            final qty    = _cartQty[id] ?? 0;\n"
    "            final isAmz  = (p['sourceType']?.toString() ?? 'OWN') == 'AMAZON' &&\n"
    "                           (p['amazonUrl']?.toString() ?? '').isNotEmpty;\n"
    "            final amzQty = isAmz\n"
    "                ? ((_amazonList[id]?['qty'] as int?) ?? 0) : 0;\n"
    "            return _ProductTile(\n"
    "              product:     p,\n"
    "              thumbUrl:    _thumb(p['images']),\n"
    "              cartQty:     qty,\n"
    "              amazonQty:   amzQty,\n"
    "              onTap:       () => _openDetail(p),\n"
    "              onAddCart:   isAmz ? () => _addToAmazonList(p) : () => _addToCart(p),\n"
    "              onIncrement: isAmz ? () => _addToAmazonList(p) : () => _increment(p),\n"
    "              onDecrement: isAmz ? () => _removeFromAmazonList(p) : () => _decrement(p),\n"
    "            );"
)

# ── P5: Add amazonQty field to _ProductTile ───────────────────────────────────
apply('P5: _ProductTile amazonQty field',
    '  final VoidCallback         onTap;\n'
    '  final VoidCallback         onAddCart;\n'
    '  final VoidCallback         onIncrement;\n'
    '  final VoidCallback         onDecrement;\n'
    '\n'
    '  const _ProductTile({\n'
    '    required this.product,\n'
    '    required this.thumbUrl,\n'
    '    required this.cartQty,\n'
    '    required this.onTap,',
    '  final int                  amazonQty;\n'
    '  final VoidCallback         onTap;\n'
    '  final VoidCallback         onAddCart;\n'
    '  final VoidCallback         onIncrement;\n'
    '  final VoidCallback         onDecrement;\n'
    '\n'
    '  const _ProductTile({\n'
    '    required this.product,\n'
    '    required this.thumbUrl,\n'
    '    required this.cartQty,\n'
    '    this.amazonQty = 0,\n'
    '    required this.onTap,'
)

# ── P6: Replace _AffiliateButton with stepper for Amazon ─────────────────────
apply('P6: Amazon stepper in tile',
    "                        if (isAmazon)\n"
    "                          _AffiliateButton(\n"
    "                            label: 'Amazon',\n"
    "                            url: amazonUrl,\n"
    "                            color: const Color(0xFFFF9900),\n"
    "                          )",
    "                        if (isAmazon)\n"
    "                          amazonQty == 0\n"
    "                          ? GestureDetector(\n"
    "                              onTap: onAddCart,\n"
    "                              child: Container(\n"
    "                                padding: const EdgeInsets.symmetric(\n"
    "                                    horizontal: 8, vertical: 5),\n"
    "                                decoration: BoxDecoration(\n"
    "                                    color: const Color(0xFFFF9900),\n"
    "                                    borderRadius: BorderRadius.circular(8)),\n"
    "                                child: Row(mainAxisSize: MainAxisSize.min,\n"
    "                                    children: [\n"
    "                                  const Icon(Icons.add_shopping_cart_rounded,\n"
    "                                      size: 11, color: Colors.white),\n"
    "                                  const SizedBox(width: 3),\n"
    "                                  Text('Add', style: GoogleFonts.nunito(\n"
    "                                      fontSize: 10,\n"
    "                                      fontWeight: FontWeight.w900,\n"
    "                                      color: Colors.white)),\n"
    "                                ]),\n"
    "                              ),\n"
    "                            )\n"
    "                          : Row(mainAxisSize: MainAxisSize.min, children: [\n"
    "                              _stepBtn(Icons.remove_rounded, onDecrement,\n"
    "                                  color: const Color(0xFFFF9900)),\n"
    "                              Padding(\n"
    "                                padding:\n"
    "                                    const EdgeInsets.symmetric(horizontal: 5),\n"
    "                                child: Text('$amazonQty',\n"
    "                                    style: GoogleFonts.nunito(\n"
    "                                        fontSize: 13,\n"
    "                                        fontWeight: FontWeight.w900,\n"
    "                                        color: const Color(0xFFFF9900))),\n"
    "                              ),\n"
    "                              _stepBtn(Icons.add_rounded, onIncrement,\n"
    "                                  color: const Color(0xFFFF9900)),\n"
    "                            ])"
)

# ── P7: _stepBtn optional color ───────────────────────────────────────────────
apply('P7: _stepBtn optional color',
    '  Widget _stepBtn(IconData icon, VoidCallback fn) => GestureDetector(\n'
    '    onTap: fn,\n'
    '    child: Container(\n'
    '      padding: const EdgeInsets.all(4),\n'
    '      decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(6)),\n'
    '      child: Icon(icon, color: Colors.white, size: 13),\n'
    '    ),\n'
    '  );',
    '  Widget _stepBtn(IconData icon, VoidCallback fn, {Color? color}) =>\n'
    '    GestureDetector(\n'
    '      onTap: fn,\n'
    '      child: Container(\n'
    '        padding: const EdgeInsets.all(4),\n'
    '        decoration: BoxDecoration(\n'
    '            color: color ?? _accent,\n'
    '            borderRadius: BorderRadius.circular(6)),\n'
    '        child: Icon(icon, color: Colors.white, size: 13),\n'
    '      ),\n'
    '    );'
)

# ── Write file ────────────────────────────────────────────────────────────────
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)

# ── Append _AmazonCheckoutSheet ───────────────────────────────────────────────
SHEET = r'''

// ═══════════════════════════════════════════════════════════════════════════
//  AMAZON CHECKOUT SHEET
//  Pre-fills Amazon cart with all selected items via URL.
//  Email-to-parent opens device mail app with cart link pre-loaded.
// ═══════════════════════════════════════════════════════════════════════════

class _AmazonCheckoutSheet extends StatefulWidget {
  final Map<String, Map<String, dynamic>> amazonList;
  final String                            cartUrl;
  final void Function(String id)          onRemove;
  final VoidCallback                      onClearAll;

  const _AmazonCheckoutSheet({
    required this.amazonList,
    required this.cartUrl,
    required this.onRemove,
    required this.onClearAll,
  });

  @override
  State<_AmazonCheckoutSheet> createState() => _AmazonCheckoutSheetState();
}

class _AmazonCheckoutSheetState extends State<_AmazonCheckoutSheet> {
  final TextEditingController _emailCtrl = TextEditingController();
  bool _showEmail = false;

  double get _total => widget.amazonList.values
      .fold(0, (s, v) => s + ((v['price'] as double) * (v['qty'] as int)));

  Future<void> _openAmazon() async {
    final uri = Uri.parse(widget.cartUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _emailParent() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) return;
    final items = widget.amazonList.values
        .map((v) =>
            '• ${v['name']} × ${v['qty']} '
            '(₹${((v['price'] as double) * (v['qty'] as int)).toStringAsFixed(0)})')
        .join('\n');
    final subject =
        Uri.encodeComponent('Your child wants to buy STEAM materials on Amazon');
    final body = Uri.encodeComponent(
      'Hi,\n\n'
      'Your child has selected STEAM project materials on MiniGuru!\n\n'
      'Items:\n$items\n\n'
      'Estimated total: ₹${_total.toStringAsFixed(0)}\n\n'
      'Tap to open their Amazon cart (all items pre-loaded, COD available):\n'
      '${widget.cartUrl}\n\n'
      '— Sent via MiniGuru',
    );
    final mailto = Uri.parse('mailto:$email?subject=$subject&body=$body');
    if (await canLaunchUrl(mailto)) await launchUrl(mailto);
  }

  @override
  void dispose() { _emailCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    const orange = Color(0xFFFF9900);
    const indigo = Color(0xFF5B6EF5);
    const ink    = Color(0xFF1A1A2E);
    const muted  = Color(0xFF8888AA);

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2)),
            )),
            const SizedBox(height: 16),

            // Header
            Row(children: [
              const Text('🛍️', style: TextStyle(fontSize: 22)),
              const SizedBox(width: 8),
              Text('Amazon Shopping List',
                  style: GoogleFonts.nunito(
                      fontSize: 18, fontWeight: FontWeight.w900, color: ink)),
              const Spacer(),
              TextButton(
                onPressed: widget.onClearAll,
                child: Text('Clear all',
                    style: GoogleFonts.nunito(
                        color: Colors.red[400], fontWeight: FontWeight.w700)),
              ),
            ]),
            Text('Your parent pays on Amazon — COD & UPI available',
                style: GoogleFonts.nunito(fontSize: 11, color: muted)),
            const SizedBox(height: 14),

            // Items
            ...widget.amazonList.entries.map((e) {
              final id   = e.key;
              final item = e.value;
              final thumb = item['thumbUrl']?.toString() ?? '';
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 48, height: 48,
                      child: thumb.isNotEmpty
                          ? Image.network(thumb, fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => Container(
                                  color: const Color(0xFFF0F0FF),
                                  child: const Icon(Icons.image_not_supported_outlined,
                                      size: 20, color: muted)))
                          : Container(color: const Color(0xFFF0F0FF),
                              child: const Icon(Icons.inventory_2_outlined,
                                  size: 20, color: muted)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item['name']?.toString() ?? '',
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.nunito(
                              fontSize: 13, fontWeight: FontWeight.w800,
                              color: ink)),
                      Text(
                        'Qty: ${item['qty']}  •  '
                        '₹${((item['price'] as double) * (item['qty'] as int)).toStringAsFixed(0)}',
                        style: GoogleFonts.nunito(fontSize: 11, color: muted)),
                    ],
                  )),
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline_rounded,
                        size: 20, color: Colors.redAccent),
                    onPressed: () => widget.onRemove(id),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ]),
              );
            }),

            const Divider(),
            const SizedBox(height: 4),

            // Total
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('Estimated Total',
                  style: GoogleFonts.nunito(
                      fontSize: 14, fontWeight: FontWeight.w700, color: ink)),
              Text('₹${_total.toStringAsFixed(0)}',
                  style: GoogleFonts.nunito(
                      fontSize: 16, fontWeight: FontWeight.w900, color: orange)),
            ]),
            const SizedBox(height: 4),
            Text('* Final price on Amazon may vary.',
                style: GoogleFonts.nunito(fontSize: 10, color: muted)),
            const SizedBox(height: 16),

            // Open Amazon
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _openAmazon,
                icon: const Text('🛒', style: TextStyle(fontSize: 16)),
                label: Text('Open My Amazon Cart',
                    style: GoogleFonts.nunito(
                        fontSize: 15, fontWeight: FontWeight.w900,
                        color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: orange,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Email to parent toggle
            if (!_showEmail)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => setState(() => _showEmail = true),
                  icon: const Icon(Icons.email_outlined, size: 18, color: indigo),
                  label: Text('Send Cart Link to Parent / Guardian',
                      style: GoogleFonts.nunito(
                          fontSize: 13, fontWeight: FontWeight.w800,
                          color: indigo)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: const BorderSide(color: indigo),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),

            if (_showEmail) ...[
              TextField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  hintText: "Parent's email address",
                  hintStyle: GoogleFonts.nunito(color: Colors.grey[400]),
                  prefixIcon: const Icon(Icons.email_outlined,
                      color: muted, size: 20),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 12),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _emailParent,
                  icon: const Icon(Icons.send_rounded,
                      size: 18, color: Colors.white),
                  label: Text('Send via Email App',
                      style: GoogleFonts.nunito(
                          fontSize: 13, fontWeight: FontWeight.w900,
                          color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: indigo,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Opens your mail app with the Amazon cart link pre-filled. '
                'Parent taps the link — all items ready to buy.',
                style: GoogleFonts.nunito(fontSize: 10, color: muted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
'''

with open(FILE, 'a', encoding='utf-8') as f:
    f.write(SHEET)

print(f'\n{"="*50}')
print(f'Patches applied: {len(patches)}/7')
for p in patches:
    print(f'  ✓ {p}')
print('  ✓ Appended _AmazonCheckoutSheet')
print(f'\nFile: {FILE}')
print('\nNext:')
print('  cd app/miniguru && flutter build web --release --no-tree-shake-icons')
