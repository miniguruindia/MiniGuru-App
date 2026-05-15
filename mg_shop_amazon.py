#!/usr/bin/env python3
"""
mg_shop_amazon.py
Run from /workspaces/MiniGuru-App/

Adds Amazon affiliate integration to shop.dart:
  - OWN products: existing cart flow unchanged
  - AMAZON products: separate orange Amazon List, qty stepper, Amazon Cart button
  - Amazon Checkout bottom sheet: pre-fill cart URL + email-to-parent via mailto
  - Extracts ASIN from amazonUrl stored in DB
  - Amazon cart URL format: amazon.in/gp/aws/cart/add.html?ASIN.1=X&Quantity.1=N&tag=miniguru08-21
"""

import os, sys

FILE = 'app/miniguru/lib/screens/navScreen/shop.dart'
PUBSPEC = 'app/miniguru/pubspec.yaml'

for f in [FILE, PUBSPEC]:
    if not os.path.exists(f):
        sys.exit(f'ERROR: {f} not found. Run from /workspaces/MiniGuru-App/')

print('\n=== mg_shop_amazon.py ===\n')

# ── Check / add url_launcher to pubspec ──────────────────────────────────────
with open(PUBSPEC, 'r') as f:
    pub = f.read()

if 'url_launcher' not in pub:
    pub = pub.replace(
        '  http: 1.5.0',
        '  http: 1.5.0\n  url_launcher: ^6.3.0'
    )
    with open(PUBSPEC, 'w') as f:
        f.write(pub)
    print('  ✓ Added url_launcher: ^6.3.0 to pubspec.yaml')
    print('  ⚠ Run: flutter pub get  before building')
else:
    print('  ✓ url_launcher already in pubspec.yaml')

# ── Read shop.dart ────────────────────────────────────────────────────────────
with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

patches = []

def apply(label, old, new):
    global src
    if old not in src:
        print(f'  SKIP (anchor not found): {label}')
        return
    src = src.replace(old, new, 1)
    patches.append(label)
    print(f'  OK: {label}')

# ── P1: Add url_launcher import ───────────────────────────────────────────────
apply('P1: url_launcher import',
    "import 'package:miniguru/repository/cartRepository.dart';",
    "import 'package:miniguru/repository/cartRepository.dart';\nimport 'package:url_launcher/url_launcher.dart';"
)

# ── P2: Add Amazon color token ────────────────────────────────────────────────
apply('P2: Amazon color token',
    "const Color _green  = Color(0xFF2ECC71);",
    "const Color _green  = Color(0xFF2ECC71);\nconst Color _amazon = Color(0xFFFF9900); // Amazon orange"
)

# ── P3: Add Amazon list state fields ─────────────────────────────────────────
apply('P3: Amazon list state fields',
    "  // productId → qty currently in cart (for +/- controls)\n  final Map<String, int> _cartQty = {};",
    "  // productId → qty currently in cart (for OWN products)\n"
    "  final Map<String, int> _cartQty = {};\n\n"
    "  // Amazon list — productId → {name, price, qty, asin, thumbUrl}\n"
    "  final Map<String, Map<String, dynamic>> _amazonList = {};\n"
    "  int _amazonCount = 0;"
)

# ── P4: Add Amazon helpers after _decrement() ────────────────────────────────
apply('P4: Amazon helpers',
    "  // ── Open detail page ───────────────────────────────────────────────────────",
    """  // ── Amazon helpers ────────────────────────────────────────────────────────
  bool _isAmazon(Map<String, dynamic> p) =>
      (p['sourceType']?.toString() ?? 'OWN') == 'AMAZON';

  /// Extracts ASIN from URL like:
  /// https://www.amazon.in/dp/B08N5LYM1X?tag=miniguru08-21
  /// https://www.amazon.in/product-name/dp/B08N5LYM1X/
  String? _extractAsin(String? url) {
    if (url == null || url.isEmpty) return null;
    final re = RegExp(r'/dp/([A-Z0-9]{10})');
    return re.firstMatch(url)?.group(1);
  }

  void _addToAmazonList(Map<String, dynamic> p) {
    final id   = p['id']?.toString() ?? '';
    final asin = _extractAsin(p['amazonUrl']?.toString());
    if (asin == null) return; // no ASIN — can't add
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
      if (qty <= 0) {
        _amazonList.remove(id);
      } else {
        _amazonList[id]!['qty'] = qty;
      }
      _amazonCount = _amazonList.values
          .fold(0, (s, v) => s + (v['qty'] as int));
    });
  }

  /// Builds the Amazon cart pre-fill URL with all items in _amazonList.
  /// Format: amazon.in/gp/aws/cart/add.html?ASIN.1=X&Quantity.1=N&tag=miniguru08-21
  String _buildAmazonCartUrl() {
    const tag = 'miniguru08-21';
    final buf = StringBuffer('https://www.amazon.in/gp/aws/cart/add.html?');
    int i = 1;
    for (final item in _amazonList.values) {
      buf.write('ASIN.$i=${item['asin']}&Quantity.$i=${item['qty']}&');
      i++;
    }
    buf.write('tag=$tag');
    return buf.toString();
  }

  void _showAmazonCheckout() {
    if (_amazonList.isEmpty) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AmazonCheckoutSheet(
        amazonList:   _amazonList,
        cartUrl:      _buildAmazonCartUrl(),
        onRemove:     (id) {
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

  // ── Open detail page ───────────────────────────────────────────────────────"""
)

# ── P5: Amazon cart button in AppBar alongside cart icon ─────────────────────
apply('P5: Amazon cart button in AppBar',
    "            GestureDetector(\n"
    "              onTap: () => Navigator.push(\n"
    "                context,\n"
    "                MaterialPageRoute(builder: (_) => const CartScreen()),\n"
    "              ).then((_) => _syncCart()),\n"
    "              child: Stack(children: [",
    "            Row(children: [\n"
    "              // Amazon list button — visible only when Amazon items selected\n"
    "              if (_amazonCount > 0) ...[  \n"
    "                GestureDetector(\n"
    "                  onTap: _showAmazonCheckout,\n"
    "                  child: Stack(children: [\n"
    "                    Container(\n"
    "                      padding: const EdgeInsets.all(8),\n"
    "                      decoration: BoxDecoration(\n"
    "                        color: _amazon.withOpacity(0.9),\n"
    "                        borderRadius: BorderRadius.circular(12),\n"
    "                      ),\n"
    "                      child: const Icon(Icons.shopping_bag_outlined,\n"
    "                          color: Colors.white, size: 22),\n"
    "                    ),\n"
    "                    Positioned(\n"
    "                      right: 0, top: 0,\n"
    "                      child: Container(\n"
    "                        width: 17, height: 17,\n"
    "                        decoration: const BoxDecoration(\n"
    "                            color: Colors.white, shape: BoxShape.circle),\n"
    "                        child: Center(\n"
    "                          child: Text('$_amazonCount',\n"
    "                              style: const TextStyle(\n"
    "                                  fontSize: 9,\n"
    "                                  fontWeight: FontWeight.w900,\n"
    "                                  color: _amazon)),\n"
    "                        ),\n"
    "                      ),\n"
    "                    ),\n"
    "                  ]),\n"
    "                ),\n"
    "                const SizedBox(width: 8),\n"
    "              ],\n"
    "              // MiniGuru own cart\n"
    "              GestureDetector(\n"
    "                onTap: () => Navigator.push(\n"
    "                  context,\n"
    "                  MaterialPageRoute(builder: (_) => const CartScreen()),\n"
    "                ).then((_) => _syncCart()),\n"
    "                child: Stack(children: ["
)

# ── P5b: Close the new Row widget after the existing cart GestureDetector ─────
apply('P5b: Close AppBar Row',
    "              ]),\n"
    "            ),\n"
    "          ],\n"
    "        ),\n"
    "      ),\n"
    "      background: Container(",
    "              ]),\n"
    "              ),\n"
    "            ]),  // end Row (amazon + own cart)\n"
    "          ],\n"
    "        ),\n"
    "      ),\n"
    "      background: Container("
)

# ── P6: _buildGrid — pass Amazon data to _ProductTile ────────────────────────
apply('P6: Pass Amazon data to _ProductTile',
    "            return _ProductTile(\n"
    "              product:     p,\n"
    "              thumbUrl:    _thumb(p['images']),\n"
    "              cartQty:     qty,\n"
    "              onTap:       () => _openDetail(p),\n"
    "              onAddCart:   () => _addToCart(p),\n"
    "              onIncrement: () => _increment(p),\n"
    "              onDecrement: () => _decrement(p),\n"
    "            );",
    "            final isAmz  = _isAmazon(p);\n"
    "            final amzQty = isAmz\n"
    "                ? ((_amazonList[id]?['qty'] as int?) ?? 0)\n"
    "                : 0;\n"
    "            return _ProductTile(\n"
    "              product:          p,\n"
    "              thumbUrl:         _thumb(p['images']),\n"
    "              cartQty:          isAmz ? 0 : qty,\n"
    "              isAmazon:         isAmz,\n"
    "              amazonQty:        amzQty,\n"
    "              onTap:            () => _openDetail(p),\n"
    "              onAddCart:        isAmz ? () => _addToAmazonList(p) : () => _addToCart(p),\n"
    "              onIncrement:      isAmz ? () => _addToAmazonList(p) : () => _increment(p),\n"
    "              onDecrement:      isAmz ? () => _removeFromAmazonList(p) : () => _decrement(p),\n"
    "            );"
)

# ── P7: _ProductTile — add isAmazon + amazonQty fields ───────────────────────
apply('P7: _ProductTile fields',
    "  final Map<String, dynamic> product;\n"
    "  final String               thumbUrl;\n"
    "  final int                  cartQty;\n"
    "  final VoidCallback         onTap;\n"
    "  final VoidCallback         onAddCart;\n"
    "  final VoidCallback         onIncrement;\n"
    "  final VoidCallback         onDecrement;\n"
    "\n"
    "  const _ProductTile({\n"
    "    required this.product,\n"
    "    required this.thumbUrl,\n"
    "    required this.cartQty,\n"
    "    required this.onTap,\n"
    "    required this.onAddCart,\n"
    "    required this.onIncrement,\n"
    "    required this.onDecrement,\n"
    "  });",
    "  final Map<String, dynamic> product;\n"
    "  final String               thumbUrl;\n"
    "  final int                  cartQty;\n"
    "  final bool                 isAmazon;\n"
    "  final int                  amazonQty;\n"
    "  final VoidCallback         onTap;\n"
    "  final VoidCallback         onAddCart;\n"
    "  final VoidCallback         onIncrement;\n"
    "  final VoidCallback         onDecrement;\n"
    "\n"
    "  const _ProductTile({\n"
    "    required this.product,\n"
    "    required this.thumbUrl,\n"
    "    required this.cartQty,\n"
    "    this.isAmazon  = false,\n"
    "    this.amazonQty = 0,\n"
    "    required this.onTap,\n"
    "    required this.onAddCart,\n"
    "    required this.onIncrement,\n"
    "    required this.onDecrement,\n"
    "  });"
)

# ── P8: _ProductTile build — use amazonQty, show Amazon badge + button ────────
apply('P8: _ProductTile build uses amazonQty + Amazon badge',
    "    final name  = product['name']?.toString() ?? '';\n"
    "    final price = double.tryParse(product['price']?.toString() ?? '0') ?? 0.0;\n"
    "    final stock = int.tryParse(product['inventory']?.toString() ?? '1') ?? 1;\n"
    "    final inCart = cartQty > 0;",
    "    final name    = product['name']?.toString() ?? '';\n"
    "    final price   = double.tryParse(product['price']?.toString() ?? '0') ?? 0.0;\n"
    "    final stock   = int.tryParse(product['inventory']?.toString() ?? '1') ?? 1;\n"
    "    final inCart  = isAmazon ? (amazonQty > 0) : (cartQty > 0);\n"
    "    final dispQty = isAmazon ? amazonQty : cartQty;"
)

# ── P8b: Image area — add Amazon badge overlay ───────────────────────────────
apply('P8b: Amazon badge overlay on image',
    "            // ── Thumbnail image ─────────────────────────────────────────\n"
    "            ClipRRect(\n"
    "              borderRadius: const BorderRadius.vertical(\n"
    "                  top: Radius.circular(16)),",
    "            // ── Thumbnail image ─────────────────────────────────────────\n"
    "            Stack(children: [\n"
    "            ClipRRect(\n"
    "              borderRadius: const BorderRadius.vertical(\n"
    "                  top: Radius.circular(16)),"
)

# Add Amazon badge after the ClipRRect closing and before info area
apply('P8c: Close Stack + Amazon badge',
    "            // ── Info area — remaining height = _cardH - _imgH ───────────",
    "            // Amazon badge overlay\n"
    "            if (isAmazon) Positioned(\n"
    "              top: 6, right: 6,\n"
    "              child: Container(\n"
    "                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),\n"
    "                decoration: BoxDecoration(\n"
    "                  color: _amazon,\n"
    "                  borderRadius: BorderRadius.circular(6),\n"
    "                ),\n"
    "                child: Text('amazon',\n"
    "                    style: GoogleFonts.nunito(\n"
    "                        fontSize: 8,\n"
    "                        fontWeight: FontWeight.w900,\n"
    "                        color: Colors.white)),\n"
    "              ),\n"
    "            ),\n"
    "            ]), // end image Stack\n"
    "            // ── Info area — remaining height = _cardH - _imgH ───────────"
)

# ── P9: Cart control — use dispQty, show Amazon-style button ─────────────────
apply('P9: Cart control uses dispQty + Amazon style',
    "                        // Cart control\n"
    "                        if (stock == 0)\n"
    "                          Text('Out of stock',\n"
    "                              style: GoogleFonts.",
    "                        // Cart / Amazon control\n"
    "                        if (!isAmazon && stock == 0)\n"
    "                          Text('Out of stock',\n"
    "                              style: GoogleFonts."
)

# Replace cartQty references in the stepper to use dispQty
apply('P9b: Stepper uses dispQty',
    "                        else if (inCart)\n"
    "                          _QtyRow(\n"
    "                            qty:         cartQty,",
    "                        else if (inCart)\n"
    "                          _QtyRow(\n"
    "                            qty:         dispQty,"
)

# ── Write output ──────────────────────────────────────────────────────────────
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'\n{"="*50}')
print(f'Patches applied: {len(patches)}')

# ── Append AmazonCheckoutSheet widget at end of file ─────────────────────────
CHECKOUT_SHEET = '''

// ═══════════════════════════════════════════════════════════════════════════════
//  AMAZON CHECKOUT SHEET
//  Shows all Amazon-listed items with qty, total estimate,
//  "Open Amazon Cart" button (pre-fill URL), and "Email to Parent" (mailto).
// ═══════════════════════════════════════════════════════════════════════════════

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

  double get _total => widget.amazonList.values.fold(
      0, (s, v) => s + ((v['price'] as double) * (v['qty'] as int)));

  Future<void> _openAmazon() async {
    final uri = Uri.parse(widget.cartUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _emailParent() async {
    final email = _emailCtrl.text.trim();
    final subject = Uri.encodeComponent('Your child wants to buy STEAM materials on Amazon');
    final items = widget.amazonList.values
        .map((v) => '• ${v['name']} × ${v['qty']} (₹${((v['price'] as double) * (v['qty'] as int)).toStringAsFixed(0)})')
        .join('%0A');
    final body = Uri.encodeComponent(
      'Hi,\\n\\n'
      'Your child has selected STEAM project materials on MiniGuru!\\n\\n'
      'Items selected:\\n'
    ) + items + Uri.encodeComponent(
      '\\n\\nEstimated total: ₹${_total.toStringAsFixed(0)}\\n\\n'
      'One-click to open their Amazon cart (items pre-loaded, ready to pay):\\n'
    ) + Uri.encodeComponent(widget.cartUrl) + Uri.encodeComponent(
      '\\n\\nCOD and all Amazon payment methods are available.\\n\\n'
      '— Sent via MiniGuru'
    );
    final mailto = Uri.parse('mailto:$email?subject=$subject&body=$body');
    if (await canLaunchUrl(mailto)) {
      await launchUrl(mailto);
    }
  }

  @override
  void dispose() { _emailCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(child: Container(
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          )),
          const SizedBox(height: 16),

          // Header
          Row(children: [
            const Text('🛍️', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 8),
            Text('Amazon Shopping List',
                style: GoogleFonts.nunito(
                    fontSize: 18, fontWeight: FontWeight.w900,
                    color: const Color(0xFF1A1A2E))),
            const Spacer(),
            TextButton(
              onPressed: widget.onClearAll,
              child: Text('Clear all',
                  style: GoogleFonts.nunito(
                      color: Colors.red[400], fontWeight: FontWeight.w700)),
            ),
          ]),
          const SizedBox(height: 4),
          Text('Your parent will pay on Amazon — COD available',
              style: GoogleFonts.nunito(fontSize: 12, color: const Color(0xFF8888AA))),
          const SizedBox(height: 16),

          // Items list
          ...widget.amazonList.entries.map((e) {
            final id   = e.key;
            final item = e.value;
            final thumb = item['thumbUrl']?.toString() ?? '';
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                // Thumbnail
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    width: 48, height: 48,
                    child: thumb.isNotEmpty
                        ? Image.network(thumb, fit: BoxFit.contain,
                            errorBuilder: (_, __, ___) =>
                                Container(color: const Color(0xFFF0F0FF),
                                    child: const Icon(Icons.image_not_supported_outlined,
                                        size: 20, color: Color(0xFF8888AA))))
                        : Container(color: const Color(0xFFF0F0FF),
                            child: const Icon(Icons.inventory_2_outlined,
                                size: 20, color: Color(0xFF8888AA))),
                  ),
                ),
                const SizedBox(width: 10),
                // Name + qty + price
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item['name']?.toString() ?? '',
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.nunito(
                            fontSize: 13, fontWeight: FontWeight.w800,
                            color: const Color(0xFF1A1A2E))),
                    Text('Qty: ${item['qty']}  •  ₹${((item['price'] as double) * (item['qty'] as int)).toStringAsFixed(0)}',
                        style: GoogleFonts.nunito(
                            fontSize: 11, color: const Color(0xFF8888AA))),
                  ],
                )),
                // Remove button
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
                    fontSize: 14, fontWeight: FontWeight.w700,
                    color: const Color(0xFF1A1A2E))),
            Text('₹${_total.toStringAsFixed(0)}',
                style: GoogleFonts.nunito(
                    fontSize: 16, fontWeight: FontWeight.w900,
                    color: _amazon)),
          ]),
          const SizedBox(height: 4),
          Text('* Final price on Amazon may vary. COD & all UPI methods available.',
              style: GoogleFonts.nunito(fontSize: 10, color: const Color(0xFF8888AA))),
          const SizedBox(height: 16),

          // Open Amazon button
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
                backgroundColor: _amazon,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                elevation: 2,
              ),
            ),
          ),
          const SizedBox(height: 10),

          // Email to parent
          if (!_showEmail)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => setState(() => _showEmail = true),
                icon: const Icon(Icons.email_outlined, size: 18,
                    color: Color(0xFF5B6EF5)),
                label: Text('Send Cart Link to Parent / Guardian',
                    style: GoogleFonts.nunito(
                        fontSize: 13, fontWeight: FontWeight.w800,
                        color: const Color(0xFF5B6EF5))),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  side: const BorderSide(color: Color(0xFF5B6EF5)),
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
                    color: Color(0xFF8888AA), size: 20),
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
                icon: const Icon(Icons.send_rounded, size: 18,
                    color: Colors.white),
                label: Text('Send Cart Link via Email',
                    style: GoogleFonts.nunito(
                        fontSize: 13, fontWeight: FontWeight.w800,
                        color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF5B6EF5),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'This opens your mail app with the Amazon cart link pre-filled. '
              'Your parent taps the link — items are ready to buy on Amazon.',
              style: GoogleFonts.nunito(
                  fontSize: 10, color: const Color(0xFF8888AA)),
            ),
          ],
        ],
      ),
    );
  }
}
'''

with open(FILE, 'a', encoding='utf-8') as f:
    f.write(CHECKOUT_SHEET)

print('  ✓ Appended _AmazonCheckoutSheet widget')
print(f'\nFile written: {FILE}')
print('\nRun now:')
print('  cd app/miniguru && flutter pub get')
print('  flutter build web --release --no-tree-shake-icons')
