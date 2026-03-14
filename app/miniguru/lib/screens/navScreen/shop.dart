// lib/screens/navScreen/shop.dart
// MiniGuru Shop — fetches directly from API, no SQLite product layer
// Card layout uses mainAxisExtent (exact pixel height) so white space is impossible.
// Tapping a card opens ProductDetailsPage (full gallery, description, qty, add to cart).
// Cart badge updates live. Category chips + search bar filter in memory.

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:miniguru/secrets.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/screens/cartScreen.dart';
import 'package:miniguru/screens/productDetailsScreen.dart';
import 'package:miniguru/models/Product.dart';
import 'package:miniguru/repository/cartRepository.dart';

// ── Design tokens ─────────────────────────────────────────────────────────────
const Color _bg     = Color(0xFFF5F7FF);
const Color _ink    = Color(0xFF1A1A2E);
const Color _accent = Color(0xFF5B6EF5);
const Color _amber  = Color(0xFFE8A000);
const Color _card   = Color(0xFFFFFFFF);
const Color _muted  = Color(0xFF8888AA);
const Color _green  = Color(0xFF2ECC71);

// ── Card sizing — tune these 3 numbers only ────────────────────────────────────
const double _cardH = 210.0;  // exact card height in pixels (mainAxisExtent)
const double _imgH  = 140.0;  // image portion height
// info area height = _cardH - _imgH = 70px — always exact, never stretches

class Shop extends StatefulWidget {
  const Shop({super.key});
  @override
  State<Shop> createState() => _ShopState();
}

class _ShopState extends State<Shop> with AutomaticKeepAliveClientMixin {
  List<Map<String, dynamic>> _all      = [];
  List<Map<String, dynamic>> _filtered = [];
  List<Map<String, dynamic>> _cats     = [];

  bool   _loading   = true;
  String _error     = '';
  String _selCat    = '';
  String _search    = '';
  int    _cartCount = 0;

  // productId → qty currently in cart (for +/- controls)
  final Map<String, int> _cartQty = {};

  final TextEditingController _searchCtrl = TextEditingController();
  final CartRepository        _cartRepo   = CartRepository();

  @override bool get wantKeepAlive => true;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  // ── Fetch products + categories ────────────────────────────────────────────
  Future<void> _load() async {
    setState(() { _loading = true; _error = ''; });
    try {
      String? token;
      try { token = (await DatabaseHelper().getAuthToken())?.accessToken; } catch (_) {}
      final Map<String, String> h = {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

      final List<http.Response> rs = await Future.wait([
        http.get(Uri.parse('$apiBaseUrl/products'), headers: h),
        http.get(Uri.parse('$apiBaseUrl/products/categories/all'), headers: h),
      ]);

      if (rs[0].statusCode == 200) {
        final list = jsonDecode(rs[0].body) as List;
        setState(() {
          _all      = List<Map<String, dynamic>>.from(list);
          _filtered = List.from(_all);
        });
      } else {
        setState(() => _error = 'Could not load products (${rs[0].statusCode})');
      }

      if (rs[1].statusCode == 200) {
        final raw = jsonDecode(rs[1].body);
        setState(() {
          _cats = raw is List
              ? List<Map<String, dynamic>>.from(raw)
              : List<Map<String, dynamic>>.from(raw['categories'] ?? []);
        });
      }

      await _syncCart();
    } catch (e) {
      setState(() => _error = 'Network error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Sync cart badge + qty map ──────────────────────────────────────────────
  Future<void> _syncCart() async {
    try {
      final items = await _cartRepo.getCart();
      if (!mounted) return;
      int total = 0;
      final Map<String, int> qmap = {};
      for (final item in items) {
        final id  = item['productId']?.toString() ?? '';
        final qty = (item['quantity'] as int? ?? 0);
        if (id.isNotEmpty) qmap[id] = qty;
        total += qty;
      }
      setState(() { _cartQty.clear(); _cartQty.addAll(qmap); _cartCount = total; });
    } catch (_) {}
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  void _filter() {
    setState(() {
      _filtered = _all.where((p) {
        final n = (p['name'] ?? '').toString().toLowerCase();
        final d = (p['description'] ?? '').toString().toLowerCase();
        final c = (p['categoryId'] ?? '').toString();
        return (_search.isEmpty || n.contains(_search) || d.contains(_search))
            && (_selCat.isEmpty  || c == _selCat);
      }).toList();
    });
  }

  // ── Image URL helper ───────────────────────────────────────────────────────
  String _thumb(dynamic images) {
    String raw = '';
    if (images is List && images.isNotEmpty) raw = images[0].toString();
    else if (images is String)               raw = images;
    if (raw.isEmpty) return '';
    return raw.startsWith('http') ? raw : '$apiBaseUrl/$raw';
  }

  // ── Cart actions ───────────────────────────────────────────────────────────
  Future<void> _addToCart(Map<String, dynamic> p) async {
    try {
      final id    = p['id']?.toString() ?? '';
      final name  = p['name']?.toString() ?? '';
      final price = double.tryParse(p['price']?.toString() ?? '0') ?? 0.0;
      await _cartRepo.addToCart(id, name, price);
      await _syncCart();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('${p['name']} added to cart',
            style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
        backgroundColor: _accent,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    }
  }

  Future<void> _increment(Map<String, dynamic> p) async {
    try {
      final id    = p['id']?.toString() ?? '';
      final name  = p['name']?.toString() ?? '';
      final price = double.tryParse(p['price']?.toString() ?? '0') ?? 0.0;
      await _cartRepo.addToCart(id, name, price);
      await _syncCart();
    } catch (_) {}
  }

  Future<void> _decrement(Map<String, dynamic> p) async {
    try {
      final id = p['id']?.toString() ?? '';
      await _cartRepo.removeFromCart(id);
      await _syncCart();
    } catch (_) {}
  }

  // ── Open detail page ───────────────────────────────────────────────────────
  void _openDetail(Map<String, dynamic> p) {
    try {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ProductDetailsPage(
            product:         Product.fromJsonRemote(p),
            backgroundColor: const Color(0xFFEEF0FF),
          ),
        ),
      ).then((_) => _syncCart());
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  // ── Root build ─────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      backgroundColor: _bg,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [_buildAppBar()],
        body: _loading
            ? const Center(child: CircularProgressIndicator(color: _accent))
            : _error.isNotEmpty
                ? _buildError()
                : RefreshIndicator(
                    onRefresh: _load,
                    color: _accent,
                    child: CustomScrollView(slivers: [
                      if (_cats.isNotEmpty)
                        SliverToBoxAdapter(child: _buildCatRow()),
                      SliverToBoxAdapter(child: _buildSearchBar()),
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                          child: Text(
                            '${_filtered.length} product${_filtered.length == 1 ? '' : 's'}',
                            style: GoogleFonts.nunito(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: _muted),
                          ),
                        ),
                      ),
                      if (_filtered.isEmpty)
                        SliverFillRemaining(child: _buildEmpty())
                      else
                        _buildGrid(),
                      const SliverToBoxAdapter(child: SizedBox(height: 32)),
                    ]),
                  ),
      ),
    );
  }

  // ── AppBar ─────────────────────────────────────────────────────────────────
  Widget _buildAppBar() {
    return SliverAppBar(
      pinned: true,
      expandedHeight: 110,
      backgroundColor: _accent,
      elevation: 0,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('MiniGuru Shop',
                    style: GoogleFonts.nunito(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Colors.white)),
                Text('Build something amazing ✨',
                    style: GoogleFonts.nunito(
                        fontSize: 10,
                        color: Colors.white70)),
              ],
            ),
            GestureDetector(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CartScreen()),
              ).then((_) => _syncCart()),
              child: Stack(children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.shopping_cart_outlined,
                      color: Colors.white, size: 22),
                ),
                if (_cartCount > 0)
                  Positioned(
                    right: 0, top: 0,
                    child: Container(
                      width: 17, height: 17,
                      decoration: const BoxDecoration(
                          color: _amber, shape: BoxShape.circle),
                      child: Center(
                        child: Text(
                          '$_cartCount',
                          style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              color: Colors.white),
                        ),
                      ),
                    ),
                  ),
              ]),
            ),
          ],
        ),
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4B5EE4), Color(0xFF7C8EFF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
    );
  }

  // ── Category chips ─────────────────────────────────────────────────────────
  Widget _buildCatRow() {
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [
          _buildChip('All', ''),
          ..._cats.map((c) => _buildChip(
              c['name']?.toString() ?? '',
              c['id']?.toString() ?? '')),
        ],
      ),
    );
  }

  Widget _buildChip(String label, String id) {
    final sel = _selCat == id;
    return GestureDetector(
      onTap: () { setState(() => _selCat = id); _filter(); },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: sel ? _accent : _card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: sel ? _accent : const Color(0xFFDDDDF0)),
          boxShadow: sel
              ? [BoxShadow(
                  color: _accent.withOpacity(0.25),
                  blurRadius: 6, offset: const Offset(0, 2))]
              : [],
        ),
        child: Text(label,
            style: GoogleFonts.nunito(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: sel ? Colors.white : _muted)),
      ),
    );
  }

  // ── Search bar ─────────────────────────────────────────────────────────────
  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 4),
      child: Container(
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: TextField(
          controller: _searchCtrl,
          style: GoogleFonts.nunito(fontSize: 14),
          decoration: InputDecoration(
            hintText: 'Search materials...',
            hintStyle: GoogleFonts.nunito(
                color: Colors.grey[400], fontSize: 14),
            prefixIcon: const Icon(Icons.search_rounded,
                color: _muted, size: 20),
            suffixIcon: _search.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close_rounded,
                        size: 18, color: _muted),
                    onPressed: () {
                      _searchCtrl.clear();
                      setState(() => _search = '');
                      _filter();
                    })
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onChanged: (v) {
            setState(() => _search = v.toLowerCase());
            _filter();
          },
        ),
      ),
    );
  }

  // ── Product grid — mainAxisExtent = exact px height, ZERO white space ──────
  Widget _buildGrid() {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount:   2,
          crossAxisSpacing: 12,
          mainAxisSpacing:  12,
          mainAxisExtent:   _cardH, // ← pixel height, NOT a ratio
        ),
        delegate: SliverChildBuilderDelegate(
          (context, i) {
            final p   = _filtered[i];
            final id  = p['id']?.toString() ?? '';
            final qty = _cartQty[id] ?? 0;
            return _ProductTile(
              product:     p,
              thumbUrl:    _thumb(p['images']),
              cartQty:     qty,
              onTap:       () => _openDetail(p),
              onAddCart:   () => _addToCart(p),
              onIncrement: () => _increment(p),
              onDecrement: () => _decrement(p),
            );
          },
          childCount: _filtered.length,
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text('🔍', style: TextStyle(fontSize: 48)),
        const SizedBox(height: 12),
        Text('No products found',
            style: GoogleFonts.nunito(
                fontSize: 16, fontWeight: FontWeight.w800, color: _ink)),
        const SizedBox(height: 4),
        Text('Try a different search or category',
            style: GoogleFonts.nunito(fontSize: 13, color: _muted)),
      ],
    ));
  }

  Widget _buildError() {
    return Center(child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.wifi_off_rounded, size: 56, color: Colors.grey),
        const SizedBox(height: 12),
        Text(_error,
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(
                fontSize: 14, color: Colors.red[700])),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh_rounded),
          label: Text('Retry',
              style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
          style: ElevatedButton.styleFrom(
              backgroundColor: _accent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12))),
        ),
      ]),
    ));
  }
}

// ── Product Tile ──────────────────────────────────────────────────────────────
// Height is EXACTLY _cardH px (controlled by grid mainAxisExtent above).
// _imgH px image + (_cardH - _imgH) px info area. Nothing can overflow or gap.
// Qty 0  → shows "Add to Cart" button
// Qty >0 → shows − N + inline stepper
// Tap anywhere → opens ProductDetailsPage with full gallery + description
class _ProductTile extends StatelessWidget {
  final Map<String, dynamic> product;
  final String               thumbUrl;
  final int                  cartQty;
  final VoidCallback         onTap;
  final VoidCallback         onAddCart;
  final VoidCallback         onIncrement;
  final VoidCallback         onDecrement;

  const _ProductTile({
    required this.product,
    required this.thumbUrl,
    required this.cartQty,
    required this.onTap,
    required this.onAddCart,
    required this.onIncrement,
    required this.onDecrement,
  });

  @override
  Widget build(BuildContext context) {
    final name  = product['name']?.toString() ?? '';
    final price = double.tryParse(product['price']?.toString() ?? '0') ?? 0.0;
    final stock = int.tryParse(product['inventory']?.toString() ?? '1') ?? 1;
    final inCart = cartQty > 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        // Grid mainAxisExtent already constrains height to _cardH.
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Column(
          children: [
            // ── Thumbnail image ─────────────────────────────────────────
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16)),
              child: SizedBox(
                width: double.infinity,
                height: _imgH,
                child: thumbUrl.isNotEmpty
                    ? Image.network(
                        thumbUrl,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => _placeholder(),
                        loadingBuilder: (_, child, prog) =>
                            prog == null
                                ? child
                                : Container(
                                    color: const Color(0xFFF0F0FF),
                                    child: const Center(
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: _accent))),
                      )
                    : _placeholder(),
              ),
            ),

            // ── Info area — remaining height = _cardH - _imgH ───────────
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(9, 6, 9, 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Product name
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.nunito(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: _ink),
                    ),

                    // Price + cart control
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Price
                        Text(
                          'Rs.${price.toStringAsFixed(0)}',
                          style: GoogleFonts.nunito(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: _accent),
                        ),

                        // Cart control
                        if (stock == 0)
                          Text('Out of stock',
                              style: GoogleFonts.nunito(
                                  fontSize: 9,
                                  color: Colors.red,
                                  fontWeight: FontWeight.w700))
                        else if (!inCart)
                          // Add button
                          GestureDetector(
                            onTap: onAddCart,
                            child: Container(
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(
                                  color: _accent,
                                  borderRadius: BorderRadius.circular(8)),
                              child: const Icon(
                                  Icons.add_shopping_cart_rounded,
                                  color: Colors.white, size: 15),
                            ),
                          )
                        else
                          // Qty stepper − N +
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            _stepBtn(Icons.remove_rounded, onDecrement),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6),
                              child: Text('$cartQty',
                                  style: GoogleFonts.nunito(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w900,
                                      color: _accent)),
                            ),
                            _stepBtn(Icons.add_rounded, onIncrement),
                          ]),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showFullImage(BuildContext context, String url) {
    if (url.isEmpty) return;
    showDialog(
      context: context,
      barrierColor: Colors.black87,
      builder: (_) => GestureDetector(
        onTap: () => Navigator.pop(context),
        child: Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.all(16),
          child: Stack(alignment: Alignment.topRight, children: [
            InteractiveViewer(
              minScale: 0.5,
              maxScale: 4.0,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Container(
                    color: const Color(0xFFF0F0FF),
                    height: 300,
                    child: const Center(child: Icon(Icons.broken_image_outlined, size: 60)),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: CircleAvatar(
                backgroundColor: Colors.black54,
                radius: 16,
                child: IconButton(
                  padding: EdgeInsets.zero,
                  icon: const Icon(Icons.close, color: Colors.white, size: 16),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _stepBtn(IconData icon, VoidCallback fn) => GestureDetector(
    onTap: fn,
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
          color: _accent, borderRadius: BorderRadius.circular(6)),
      child: Icon(icon, color: Colors.white, size: 13),
    ),
  );

  Widget _placeholder() => Container(
    color: const Color(0xFFF0F0FF),
    child: const Center(child: Icon(Icons.inventory_2_outlined,
        size: 36, color: Color(0xFFCCCCEE))),
  );
}