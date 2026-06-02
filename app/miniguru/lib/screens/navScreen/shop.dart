// lib/screens/navScreen/shop.dart
// MiniGuru Shop — fetches directly from API, no SQLite product layer
// Card layout uses mainAxisExtent (exact pixel height) so white space is impossible.
// Tapping a card opens ProductDetailsPage (full gallery, description, qty, add to cart).
// Cart badge updates live. Category chips + search bar filter in memory.
// Amazon/Flipkart affiliate products show "Buy on Amazon/Flipkart" button — never enter cart.

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
import 'package:miniguru/repository/draftsRepository.dart';
import 'package:miniguru/repository/GoinsRepository.dart';
import 'package:miniguru/models/MaterialItem.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:url_launcher/url_launcher.dart';

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

class _ShopState extends State<Shop> with AutomaticKeepAliveClientMixin, TickerProviderStateMixin {
  List<Map<String, dynamic>> _all      = [];
  List<Map<String, dynamic>> _filtered = [];
  List<Map<String, dynamic>> _cats     = [];

  bool   _loading   = true;
  String _error     = '';
  String _selCat    = '';
  String _search    = '';
  int    _cartCount = 0;

  final Map<String, int>    _cartQty    = {};

  // Amazon shopping list — productId → {name, price, qty, asin, thumbUrl}
  final Map<String, Map<String, dynamic>> _amazonList = {};
  int _amazonCount = 0;
  final TextEditingController _searchCtrl = TextEditingController();
  final CartRepository        _cartRepo   = CartRepository();
  final DraftRepository       _draftRepo  = DraftRepository();
  final GoinsRepository       _goinsRepo  = GoinsRepository();

  // Kit tab state
  late final TabController _tabCtrl = TabController(length: 2, vsync: this);
  List<PickedMaterial> _kitMaterials = [];
  bool _kitLoading = true;
  String? _kitDraftTitle;

  @override bool get wantKeepAlive => true;

  @override
  void initState() { super.initState(); _load(); _loadKit(); }

  @override
  void dispose() { _searchCtrl.dispose(); _tabCtrl.dispose(); super.dispose(); }

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
        http.get(Uri.parse('$apiBaseUrl/materials'), headers: h),
        http.get(Uri.parse('$apiBaseUrl/materials/categories'), headers: h),
      ]);

      if (rs[0].statusCode == 200) {
        final raw = jsonDecode(rs[0].body);
        final list = raw is List ? raw : (raw['materials'] ?? raw['data'] ?? []);
        final mats = List<Map<String, dynamic>>.from(list)
            .where((m) => m['showInShop'] != false && m['isActive'] != false)
            .toList();
        setState(() { _all = mats; _filtered = List.from(mats); });
      } else {
        setState(() => _error = 'Could not load materials (${rs[0].statusCode})');
      }

      if (rs[1].statusCode == 200) {
        final raw = jsonDecode(rs[1].body);
        final catList = raw is List ? raw : (raw['categories'] ?? []);
        // Build unique category list from materials
        final seen = <String>{};
        final cats = <Map<String, dynamic>>[];
        for (final m in _all) {
          final cat = m['category']?.toString() ?? '';
          if (cat.isNotEmpty && seen.add(cat)) {
            cats.add({'id': cat, 'name': cat});
          }
        }
        setState(() { _cats = cats; });
      }

    } catch (e) {
      setState(() => _error = 'Network error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

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

  void _filter() {
    setState(() {
      _filtered = _all.where((m) {
        final n   = (m['name'] ?? '').toString().toLowerCase();
        final d   = (m['description'] ?? '').toString().toLowerCase();
        final cat = (m['category'] ?? '').toString();
        return (_search.isEmpty || n.contains(_search) || d.contains(_search))
            && (_selCat.isEmpty  || cat == _selCat);
      }).toList();
    });
  }

  String _thumb(dynamic images) {
    String raw = '';
    if (images is List && images.isNotEmpty) raw = images[0].toString();
    else if (images is String)               raw = images;
    if (raw.isEmpty) return '';
    return raw.startsWith('http') ? raw : '$apiBaseUrl/$raw';
  }

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


  // ── Load kit from latest draft ────────────────────────────────────────────
  Future<void> _loadKit() async {
    setState(() => _kitLoading = true);
    try {
      final drafts = await _draftRepo.getDrafts();
      if (drafts.isEmpty) {
        setState(() { _kitMaterials = []; _kitLoading = false; });
        return;
      }
      final latest = drafts.first;
      _kitDraftTitle = latest.title.isNotEmpty ? latest.title : 'My Project';
      if (latest.materials.isEmpty) {
        setState(() { _kitMaterials = []; _kitLoading = false; });
        return;
      }
      final allMats = await _goinsRepo.getMaterials();
      final picked  = <PickedMaterial>[];
      latest.materials.forEach((id, qty) {
        try {
          picked.add(PickedMaterial(
            item: allMats.firstWhere((m) => m.id == id),
            quantity: qty,
          ));
        } catch (_) {}
      });
      setState(() { _kitMaterials = picked; _kitLoading = false; });
    } catch (e) {
      setState(() { _kitMaterials = []; _kitLoading = false; });
    }
  }

  // ── Material kit helpers ─────────────────────────────────────────────────────
  void _addMaterialToKit(Map<String, dynamic> m) {
    final id = m['id']?.toString() ?? '';
    setState(() {
      if (_amazonList.containsKey(id)) {
        _amazonList[id]!['qty'] = (_amazonList[id]!['qty'] as int) + 1;
      } else {
        _amazonList[id] = {
          'name':     m['name']?.toString() ?? '',
          'price':    double.tryParse(m['priceEstimate']?.toString() ?? '0') ?? 0.0,
          'qty':      1,
          'asin':     m['amazonASIN']?.toString() ?? '',
          'thumbUrl': m['imageUrl']?.toString() ?? '',
          'icon':     m['icon']?.toString() ?? '📦',
          'unit':     m['unit']?.toString() ?? 'piece',
          'amazonUrl': m['amazonUrl']?.toString() ?? '',
        };
      }
      _amazonCount = _amazonList.values.fold(0, (s, v) => s + (v['qty'] as int));
    });
  }

  void _removeMaterialFromKit(String id) {
    if (!_amazonList.containsKey(id)) return;
    setState(() {
      final qty = (_amazonList[id]!['qty'] as int) - 1;
      if (qty <= 0) _amazonList.remove(id);
      else _amazonList[id]!['qty'] = qty;
      _amazonCount = _amazonList.values.fold(0, (s, v) => s + (v['qty'] as int));
    });
  }

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

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      backgroundColor: _bg,
      floatingActionButton: _amazonCount > 0
          ? FloatingActionButton.extended(
              onPressed: _showAmazonCheckout,
              backgroundColor: const Color(0xFFFF9900),
              icon: const Icon(Icons.shopping_bag_outlined, color: Colors.white),
              label: Text('Amazon List ($_amazonCount)',
                  style: GoogleFonts.nunito(
                      fontWeight: FontWeight.w900,
                      color: Colors.white, fontSize: 13)),
            )
          : null,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [_buildAppBar()],
        body: Column(children: [
          // ── Tab bar ──────────────────────────────────────────────────────
          Container(
            color: Colors.white,
            child: TabBar(
              controller: _tabCtrl,
              labelStyle: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 13),
              unselectedLabelStyle: GoogleFonts.nunito(fontWeight: FontWeight.w600, fontSize: 13),
              labelColor: _accent,
              unselectedLabelColor: _muted,
              indicatorColor: _accent,
              indicatorWeight: 3,
              tabs: [
                const Tab(text: '🛍️  Browse'),
                Tab(text: _kitMaterials.isEmpty
                    ? '🛒  My Kit'
                    : '🛒  My Kit (${_kitMaterials.length})'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabCtrl,
              children: [
                // ── Tab 1: Browse ───────────────────────────────────────
                _loading
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
                // ── Tab 2: My Kit ───────────────────────────────────────
                _buildKitTab(),
              ],
            ),
          ),
        ]),
      ),
    );
  }


  // ── Send to Parent (in-app, uses SendGrid backend) ────────────────────────
  void _showSendToParentSheet() {
    final emailCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: Color(0xFFF5F7FF),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: StatefulBuilder(builder: (ctx2, setSt) {
            bool sending = false;
            bool sent    = false;
            String? err;

            Future<void> doSend() async {
              final email = emailCtrl.text.trim();
              if (email.isEmpty || !email.contains('@')) {
                setSt(() => err = 'Please enter a valid email address');
                return;
              }
              setSt(() { sending = true; err = null; });
              try {
                String? token;
                try { token = (await DatabaseHelper().getAuthToken())?.accessToken; } catch (_) {}
                final items = _amazonList.entries.map((e) => {
                  'name':     e.value['name'],
                  'qty':      e.value['qty'],
                  'price':    e.value['price'],
                  'asin':     e.value['asin'],
                  'imageUrl': e.value['thumbUrl'],
                }).toList();
                final cartUrl = _buildAmazonCartUrl();
                final res = await http.post(
                  Uri.parse('\$apiBaseUrl/shop/send-to-parent'),
                  headers: {
                    'Content-Type': 'application/json',
                    if (token != null) 'Authorization': 'Bearer \$token',
                  },
                  body: jsonEncode({
                    'parentEmail': email,
                    'childName':   'Your child',
                    'items':       items,
                    'cartUrl':     cartUrl,
                  }),
                );
                if (res.statusCode == 200) {
                  setSt(() { sent = true; sending = false; });
                } else {
                  setSt(() { err = 'Failed to send. Try again.'; sending = false; });
                }
              } catch (e) {
                setSt(() { err = 'Network error. Try again.'; sending = false; });
              }
            }

            return Column(mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.black12,
                    borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 16),
                Row(children: [
                  const Text('📧', style: TextStyle(fontSize: 22)),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Send Kit to Parent',
                      style: GoogleFonts.nunito(fontSize: 18, fontWeight: FontWeight.w900, color: _ink)),
                    Text('\${_amazonList.length} items — parent gets one-tap Amazon buy link',
                      style: GoogleFonts.nunito(fontSize: 12, color: _muted)),
                  ])),
                  IconButton(icon: const Icon(Icons.close_rounded, color: _muted),
                    onPressed: () => Navigator.pop(ctx2)),
                ]),
                const Divider(height: 24),
                if (sent) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(12)),
                    child: Row(children: [
                      const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32)),
                      const SizedBox(width: 10),
                      Expanded(child: Text(
                        'Email sent! Parent will receive the full kit list with a one-tap Amazon buy link.',
                        style: GoogleFonts.nunito(fontSize: 13,
                          color: const Color(0xFF2E7D32), fontWeight: FontWeight.w700))),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx2),
                      style: ElevatedButton.styleFrom(backgroundColor: _accent,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      child: Text('Done',
                        style: GoogleFonts.nunito(fontWeight: FontWeight.w800)))),
                ] else ...[
                  Text("Parent's email address",
                    style: GoogleFonts.nunito(fontSize: 13,
                      fontWeight: FontWeight.w700, color: _ink)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    style: GoogleFonts.nunito(fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'parent@example.com',
                      hintStyle: GoogleFonts.nunito(color: _muted, fontSize: 14),
                      prefixIcon: const Icon(Icons.email_outlined, color: _muted, size: 20),
                      filled: true, fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none),
                      errorText: err,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text('Parent receives item list with images and a pre-loaded Amazon cart link. No Amazon account needed on your side.',
                    style: GoogleFonts.nunito(fontSize: 11, color: _muted)),
                  const SizedBox(height: 16),
                  SizedBox(width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: sending ? null : doSend,
                      icon: sending
                        ? const SizedBox(width: 16, height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.send_rounded, size: 16),
                      label: Text(sending ? 'Sending...' : 'Send Email to Parent',
                        style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 14)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _accent, foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14))),
                    )),
                ],
              ],
            );
          }),
        ),
      ),
    );
  }

  // ── My Kit tab ───────────────────────────────────────────────────────────
  Widget _buildKitTab() {
    if (_amazonList.isEmpty) return _buildKitEmpty();
    final entries   = _amazonList.entries.toList();
    final withAsin  = entries.where((e) => (e.value['asin']?.toString() ?? '').isNotEmpty).toList();
    final noAsin    = entries.where((e) => (e.value['asin']?.toString() ?? '').isEmpty).toList();
    final total     = _amazonList.values.fold<double>(
        0, (s, v) => s + ((v['price'] as double) * (v['qty'] as int)));
    final hasAmazon = withAsin.isNotEmpty;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
      children: [
        // Header strip
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF4B5EE4), Color(0xFF7C8EFF)],
              begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(14)),
          child: Row(children: [
            const Text('🛒', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('My Project Kit',
                style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 15, color: Colors.white)),
              Text('${_amazonList.length} item${_amazonList.length == 1 ? "" : "s"}  •  Est. ₹${total.toStringAsFixed(0)}',
                style: GoogleFonts.nunito(fontSize: 12, color: Colors.white70)),
            ])),
          ]),
        ),
        const SizedBox(height: 16),

        // Items with Amazon links
        if (withAsin.isNotEmpty) ...[
          Text('🛒  On Amazon',
            style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w800, color: _accent)),
          const SizedBox(height: 8),
          ...withAsin.map((e) => _buildKitRow(e.key, e.value)),
          const SizedBox(height: 14),
        ],

        // Items without Amazon links
        if (noAsin.isNotEmpty) ...[
          Text('🏪  Buy locally / stationery store',
            style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w800, color: _muted)),
          const SizedBox(height: 8),
          ...noAsin.map((e) => _buildKitRow(e.key, e.value)),
          const SizedBox(height: 14),
        ],

        const Divider(),
        const SizedBox(height: 10),

        // Total
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Estimated Total',
            style: GoogleFonts.nunito(fontSize: 14, fontWeight: FontWeight.w700, color: _muted)),
          Text('₹${total.toStringAsFixed(0)}',
            style: GoogleFonts.nunito(fontSize: 18, fontWeight: FontWeight.w900, color: _ink)),
        ]),
        const SizedBox(height: 16),

        // Buy on Amazon button (opens pre-loaded cart)
        if (hasAmazon) ...[
          ElevatedButton.icon(
            onPressed: () async {
              final url = _buildAmazonCartUrl();
              final uri = Uri.parse(url);
              if (await canLaunchUrl(uri)) {
                launchUrl(uri, mode: LaunchMode.platformDefault);
              }
            },
            icon: const Text('🛍️', style: TextStyle(fontSize: 16)),
            label: Text('Buy on Amazon  (cart pre-loaded)',
              style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 14)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFF9900),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8E1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFFFE082))),
            child: Row(children: [
              const Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFFE65100)),
              const SizedBox(width: 6),
              Expanded(child: Text(
                'Make sure you are logged into Amazon in this browser before tapping above.',
                style: GoogleFonts.nunito(fontSize: 11, color: const Color(0xFFE65100)),
              )),
            ]),
          ),
        ],
        const SizedBox(height: 10),

        // Send to Parent button
        OutlinedButton.icon(
          onPressed: () => _showSendToParentSheet(),
          icon: const Icon(Icons.send_rounded, size: 16),
          label: Text('Send Kit to Parent',
            style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 14)),
          style: OutlinedButton.styleFrom(
            foregroundColor: _accent,
            side: const BorderSide(color: _accent, width: 1.5),
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        ),
        const SizedBox(height: 8),
        Center(
          child: Text('Parent gets an email with full list + one-tap Amazon buy link',
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(fontSize: 11, color: _muted)),
        ),
      ],
    );
  }

  Widget _buildKitRow(String id, Map<String, dynamic> item) {
    final thumbUrl = item['thumbUrl']?.toString() ?? '';
    final icon     = item['icon']?.toString() ?? '📦';
    final name     = item['name']?.toString() ?? '';
    final price    = (item['price'] as double?) ?? 0.0;
    final qty      = (item['qty'] as int?) ?? 1;
    final unit     = item['unit']?.toString() ?? 'piece';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6)]),
      child: Row(children: [
        // Image
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Container(
            width: 48, height: 48, color: const Color(0xFFF0F0FF),
            child: thumbUrl.isNotEmpty
              ? Image.network(thumbUrl, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                    Center(child: Text(icon, style: const TextStyle(fontSize: 22))))
              : Center(child: Text(icon, style: const TextStyle(fontSize: 22))),
          ),
        ),
        const SizedBox(width: 10),
        // Name + price
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name,
            style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w700, color: _ink),
            maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('₹${price.toStringAsFixed(0)} / $unit',
            style: GoogleFonts.nunito(fontSize: 11, color: _muted)),
        ])),
        // Qty stepper
        Row(children: [
          GestureDetector(
            onTap: () => _removeMaterialFromKit(id),
            child: Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                color: const Color(0xFFF0F0FF),
                borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.remove_rounded, size: 16, color: _accent)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text('$qty',
              style: GoogleFonts.nunito(fontSize: 14, fontWeight: FontWeight.w800, color: _ink)),
          ),
          GestureDetector(
            onTap: () {
              setState(() {
                _amazonList[id]!['qty'] = qty + 1;
                _amazonCount = _amazonList.values.fold(0, (s, v) => s + (v['qty'] as int));
              });
            },
            child: Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                color: _accent,
                borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.add_rounded, size: 16, color: Colors.white)),
          ),
        ]),
      ]),
    );
  }

  Widget _buildKitItem(PickedMaterial m, {required bool hasLink}) {
    final imageUrl = m.item.imageUrl ?? '';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6)],
      ),
      child: Row(children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Container(
            width: 48, height: 48, color: const Color(0xFFF0F0FF),
            child: imageUrl.isNotEmpty
              ? Image.network(imageUrl, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Center(
                    child: Text(m.item.icon ?? '📦', style: const TextStyle(fontSize: 22))))
              : Center(child: Text(m.item.icon ?? '📦', style: const TextStyle(fontSize: 22))),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(m.item.name,
            style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w700, color: _ink),
            maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('Qty: ${m.quantity}  •  ${m.item.unit}',
            style: GoogleFonts.nunito(fontSize: 11, color: _muted)),
        ])),
        if (hasLink)
          GestureDetector(
            onTap: () async {
              final uri = Uri.parse(m.item.amazonUrl!);
              if (await canLaunchUrl(uri)) {
                launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFF9900), borderRadius: BorderRadius.circular(8)),
              child: Text('Amazon →',
                style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white)),
            ),
          )
        else
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.05), borderRadius: BorderRadius.circular(8)),
            child: Text('Local shop',
              style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w700, color: _muted)),
          ),
      ]),
    );
  }

  Widget _buildKitEmpty() {
    return Center(child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Text('🛒', style: TextStyle(fontSize: 56)),
        const SizedBox(height: 16),
        Text('Your kit is empty',
          style: GoogleFonts.nunito(fontSize: 18, fontWeight: FontWeight.w800, color: _ink)),
        const SizedBox(height: 8),
        Text('Browse materials and tap "Add to Kit" to build your list',
          textAlign: TextAlign.center,
          style: GoogleFonts.nunito(fontSize: 13, color: _muted)),
      ]),
    ));
  }

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
                    style: GoogleFonts.nunito(fontSize: 10, color: Colors.white70)),
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
                      decoration: const BoxDecoration(color: _amber, shape: BoxShape.circle),
                      child: Center(
                        child: Text('$_cartCount',
                            style: const TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                                color: Colors.white)),
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
          border: Border.all(color: sel ? _accent : const Color(0xFFDDDDF0)),
          boxShadow: sel
              ? [BoxShadow(color: _accent.withOpacity(0.25), blurRadius: 6, offset: const Offset(0, 2))]
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
            hintStyle: GoogleFonts.nunito(color: Colors.grey[400], fontSize: 14),
            prefixIcon: const Icon(Icons.search_rounded, color: _muted, size: 20),
            suffixIcon: _search.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18, color: _muted),
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

  Widget _buildGrid() {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount:   2,
          crossAxisSpacing: 12,
          mainAxisSpacing:  12,
          mainAxisExtent:   _cardH,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, i) {
            final m   = _filtered[i];
            final id  = m['id']?.toString() ?? '';
            final qty = (_amazonList[id]?['qty'] as int?) ?? 0;
            return _MaterialTile(
              material:    m,
              kitQty:      qty,
              onAdd:       () => _addMaterialToKit(m),
              onIncrement: () => _addMaterialToKit(m),
              onDecrement: () => _removeMaterialFromKit(id),
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
        Text('No materials found',
            style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w800, color: _ink)),
        const SizedBox(height: 4),
        Text('Try a different category or search term',
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
            style: GoogleFonts.nunito(fontSize: 14, color: Colors.red.shade700)),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh_rounded),
          label: Text('Retry', style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
          style: ElevatedButton.styleFrom(
              backgroundColor: _accent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
        ),
      ]),
    ));
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// _MaterialTile — shown in Browse tab
// ══════════════════════════════════════════════════════════════════════════════
class _MaterialTile extends StatelessWidget {
  final Map<String, dynamic> material;
  final int                  kitQty;
  final VoidCallback         onAdd;
  final VoidCallback         onIncrement;
  final VoidCallback         onDecrement;

  const _MaterialTile({
    required this.material,
    required this.kitQty,
    required this.onAdd,
    required this.onIncrement,
    required this.onDecrement,
  });

  static const _accent = Color(0xFF5B6EF5);
  static const _ink    = Color(0xFF1A1A2E);
  static const _muted  = Color(0xFF8888AA);
  static const _card   = Color(0xFFFFFFFF);
  static const _bg     = Color(0xFFF5F7FF);

  String _priceLabel(Map<String, dynamic> m) {
    final price   = double.tryParse(m['priceEstimate']?.toString() ?? '0') ?? 0.0;
    final unit    = m['unit']?.toString() ?? 'piece';
    final hasAsin = (m['amazonASIN']?.toString() ?? '').isNotEmpty;
    if (price > 0) return '₹\${price.toStringAsFixed(0)} / \$unit';
    if (hasAsin)  return 'Check price on Amazon';
    return 'Collect locally / free';
  }

  @override
  Widget build(BuildContext context) {
    final name       = material['name']?.toString() ?? '';
    final imageUrl   = material['imageUrl']?.toString() ?? '';
    final icon       = material['icon']?.toString() ?? '📦';
    final price      = double.tryParse(material['priceEstimate']?.toString() ?? '0') ?? 0.0;
    final category   = material['category']?.toString() ?? '';
    final unit       = material['unit']?.toString() ?? 'piece';
    final hasAmazon  = (material['amazonASIN']?.toString() ?? '').isNotEmpty;
    final inKit      = kitQty > 0;

    return Container(
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(
          color: Colors.black.withOpacity(0.06),
          blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image area
          Expanded(
            child: Stack(children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                child: Container(
                  width: double.infinity,
                  color: const Color(0xFFF0F2FF),
                  child: imageUrl.isNotEmpty
                    ? Image.network(imageUrl, fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) =>
                          Center(child: Text(icon, style: const TextStyle(fontSize: 40))))
                    : Center(child: Text(icon, style: const TextStyle(fontSize: 40))),
                ),
              ),
              // Amazon badge
              if (hasAmazon)
                Positioned(top: 8, right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF9900),
                      borderRadius: BorderRadius.circular(6)),
                    child: Text('Amazon',
                      style: GoogleFonts.nunito(
                        fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white)),
                  ),
                ),
              // In-kit badge
              if (inKit)
                Positioned(top: 8, left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: _accent,
                      borderRadius: BorderRadius.circular(6)),
                    child: Text('In Kit: $kitQty',
                      style: GoogleFonts.nunito(
                        fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white)),
                  ),
                ),
            ]),
          ),

          // Info area
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                  style: GoogleFonts.nunito(
                    fontSize: 12, fontWeight: FontWeight.w800, color: _ink),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Row(children: [
                  Expanded(
                    child: Text(
                      price > 0 ? '₹${price.toStringAsFixed(0)} / $unit' : 'Price TBD',
                      style: GoogleFonts.nunito(fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: price > 0 ? const Color(0xFF2E7D32) : _muted)),
                  ),
                ]),
                const SizedBox(height: 6),
                // Add to Kit button or stepper
                inKit
                  ? Row(children: [
                      Expanded(
                        child: Container(
                          height: 30,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0F2FF),
                            borderRadius: BorderRadius.circular(8)),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              GestureDetector(
                                onTap: onDecrement,
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 8),
                                  child: Icon(Icons.remove_rounded,
                                    size: 14, color: _accent)),
                              ),
                              Text('$kitQty',
                                style: GoogleFonts.nunito(
                                  fontSize: 13, fontWeight: FontWeight.w800, color: _ink)),
                              GestureDetector(
                                onTap: onIncrement,
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 8),
                                  child: Icon(Icons.add_rounded,
                                    size: 14, color: _accent)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ])
                  : SizedBox(
                      width: double.infinity, height: 30,
                      child: ElevatedButton(
                        onPressed: onAdd,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _accent,
                          foregroundColor: Colors.white,
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8))),
                        child: Text('+ Add to Kit',
                          style: GoogleFonts.nunito(
                            fontSize: 11, fontWeight: FontWeight.w800)),
                      ),
                    ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// _ProductTile
// ══════════════════════════════════════════════════════════════════════════════
class _ProductTile extends StatelessWidget {
  final Map<String, dynamic> product;
  final String               thumbUrl;
  final int                  cartQty;
  final int                  amazonQty;
  final VoidCallback         onTap;
  final VoidCallback         onAddCart;
  final VoidCallback         onIncrement;
  final VoidCallback         onDecrement;

  const _ProductTile({
    required this.product,
    required this.thumbUrl,
    required this.cartQty,
    this.amazonQty = 0,
    required this.onTap,
    required this.onAddCart,
    required this.onIncrement,
    required this.onDecrement,
  });

  @override
  Widget build(BuildContext context) {
    final name        = product['name']?.toString() ?? '';
    final price       = double.tryParse(product['price']?.toString() ?? '0') ?? 0.0;
    final stock       = int.tryParse(product['inventory']?.toString() ?? '1') ?? 1;
    final inCart      = cartQty > 0;
    final sourceType  = product['sourceType']?.toString() ?? 'OWN';
    final amazonUrl   = product['amazonUrl']?.toString() ?? '';
    final flipkartUrl = product['flipkartUrl']?.toString() ?? '';
    final isAmazon    = sourceType == 'AMAZON' && amazonUrl.isNotEmpty;
    final isFlipkart  = sourceType == 'FLIPKART' && flipkartUrl.isNotEmpty;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Column(
          children: [
            // ── Thumbnail ──────────────────────────────────────────────
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: SizedBox(
                width: double.infinity,
                height: _imgH,
                child: thumbUrl.isNotEmpty
                    ? Image.network(
                        thumbUrl,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => _placeholder(),
                        loadingBuilder: (_, child, prog) => prog == null
                            ? child
                            : Container(
                                color: const Color(0xFFF0F0FF),
                                child: const Center(
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: _accent))),
                      )
                    : _placeholder(),
              ),
            ),

            // ── Info area ──────────────────────────────────────────────
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(9, 6, 9, 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.nunito(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: _ink)),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          'Rs.${price.toStringAsFixed(0)}',
                          style: GoogleFonts.nunito(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: _accent),
                        ),
                        // ── Cart / affiliate control ───────────────────
                        if (isAmazon)
                          amazonQty == 0
                          ? GestureDetector(
                              onTap: onAddCart,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 5),
                                decoration: BoxDecoration(
                                    color: const Color(0xFFFF9900),
                                    borderRadius: BorderRadius.circular(8)),
                                child: Row(mainAxisSize: MainAxisSize.min,
                                    children: [
                                  const Icon(Icons.add_shopping_cart_rounded,
                                      size: 11, color: Colors.white),
                                  const SizedBox(width: 3),
                                  Text('Add', style: GoogleFonts.nunito(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.white)),
                                ]),
                              ),
                            )
                          : Row(mainAxisSize: MainAxisSize.min, children: [
                              _stepBtn(Icons.remove_rounded, onDecrement,
                                  color: const Color(0xFFFF9900)),
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 5),
                                child: Text('$amazonQty',
                                    style: GoogleFonts.nunito(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w900,
                                        color: const Color(0xFFFF9900))),
                              ),
                              _stepBtn(Icons.add_rounded, onIncrement,
                                  color: const Color(0xFFFF9900)),
                            ])
                        else if (isFlipkart)
                          _AffiliateButton(
                            label: 'Flipkart',
                            url: flipkartUrl,
                            color: const Color(0xFF2874F0),
                          )
                        else if (stock == 0)
                          Text('Out of stock',
                              style: GoogleFonts.nunito(
                                  fontSize: 9,
                                  color: Colors.red,
                                  fontWeight: FontWeight.w700))
                        else if (!inCart)
                          GestureDetector(
                            onTap: onAddCart,
                            child: Container(
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(
                                  color: _accent,
                                  borderRadius: BorderRadius.circular(8)),
                              child: const Icon(Icons.add_shopping_cart_rounded,
                                  color: Colors.white, size: 15),
                            ),
                          )
                        else
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            _stepBtn(Icons.remove_rounded, onDecrement),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 6),
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

  Widget _stepBtn(IconData icon, VoidCallback fn, {Color? color}) =>
    GestureDetector(
      onTap: fn,
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
            color: color ?? _accent,
            borderRadius: BorderRadius.circular(6)),
        child: Icon(icon, color: Colors.white, size: 13),
      ),
    );

  Widget _placeholder() => Container(
    color: const Color(0xFFF0F0FF),
    child: const Center(
        child: Icon(Icons.inventory_2_outlined, size: 36, color: Color(0xFFCCCCEE))),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// _AffiliateButton — top-level widget, NOT inside _ProductTile
// Shown on Amazon / Flipkart products instead of the cart stepper.
// Tapping opens the affiliate URL in the external browser.
// These products NEVER enter the local cart — no Order created in DB.
// Amazon commission earned via tracking tag: miniguru08-21
// ══════════════════════════════════════════════════════════════════════════════
class _AffiliateButton extends StatelessWidget {
  final String label;
  final String url;
  final Color  color;

  const _AffiliateButton({
    required this.label,
    required this.url,
    required this.color,
  });

  Future<void> _open() async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _open,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: GoogleFonts.nunito(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: Colors.white),
            ),
            const SizedBox(width: 3),
            const Icon(Icons.open_in_new_rounded, size: 10, color: Colors.white70),
          ],
        ),
      ),
    );
  }
}


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
