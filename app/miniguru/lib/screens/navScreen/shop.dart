// lib/screens/navScreen/shop.dart
// MiniGuru Shop — fetches from /materials API (201 Firebase materials)
// Browse tab: child adds materials to kit
// My Kit tab: "Buy on Amazon" cart + "Send Kit to Parent" via SendGrid
// No CartRepository, no Razorpay, no real money — Amazon affiliate only (tag: miniguru08-21)

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:miniguru/secrets.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:url_launcher/url_launcher.dart';

const Color _bg     = Color(0xFFF5F7FF);
const Color _ink    = Color(0xFF1A1A2E);
const Color _accent = Color(0xFF5B6EF5);
const Color _amber  = Color(0xFFE8A000);
const Color _card   = Color(0xFFFFFFFF);
const Color _muted  = Color(0xFF8888AA);
const Color _green  = Color(0xFF2E7D32);
const Color _orange = Color(0xFFFF9900);

const double _cardH = 210.0;

class Shop extends StatefulWidget {
  const Shop({super.key});
  @override
  State<Shop> createState() => _ShopState();
}

class _ShopState extends State<Shop>
    with AutomaticKeepAliveClientMixin, SingleTickerProviderStateMixin {

  late final TabController _tabCtrl = TabController(length: 2, vsync: this);

  List<Map<String, dynamic>> _all      = [];
  List<Map<String, dynamic>> _filtered = [];
  List<Map<String, dynamic>> _cats     = [];
  bool   _loading = true;
  String _error   = '';
  String _selCat  = '';
  String _search  = '';

  final Map<String, Map<String, dynamic>> _kit = {};
  final TextEditingController _searchCtrl = TextEditingController();

  @override bool get wantKeepAlive => true;

  @override
  void initState() { super.initState(); _loadMaterials(); }

  @override
  void dispose() { _tabCtrl.dispose(); _searchCtrl.dispose(); super.dispose(); }

  Future<void> _loadMaterials() async {
    setState(() { _loading = true; _error = ''; });
    try {
      String? token;
      try { token = (await DatabaseHelper().getAuthToken())?.accessToken; } catch (_) {}
      final res = await http.get(
        Uri.parse('$apiBaseUrl/materials'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
      );
      if (res.statusCode == 200) {
        final raw  = jsonDecode(res.body);
        final list = raw is List ? raw : (raw['materials'] ?? raw['data'] ?? []);
        final mats = List<Map<String, dynamic>>.from(list)
            .where((m) => m['showInShop'] != false && m['isActive'] != false)
            .toList();
        final seen = <String>{};
        final cats = <Map<String, dynamic>>[];
        for (final m in mats) {
          final c = m['category']?.toString() ?? '';
          if (c.isNotEmpty && seen.add(c)) cats.add({'id': c, 'name': c});
        }
        setState(() { _all = mats; _filtered = List.from(mats); _cats = cats; _loading = false; });
      } else {
        setState(() { _error = 'Could not load materials (${res.statusCode})'; _loading = false; });
      }
    } catch (e) {
      setState(() { _error = 'Network error: $e'; _loading = false; });
    }
  }

  void _filter() {
    setState(() {
      _filtered = _all.where((m) {
        final name = (m['name'] ?? '').toString().toLowerCase();
        final cat  = (m['category'] ?? '').toString();
        return (_search.isEmpty || name.contains(_search))
            && (_selCat.isEmpty  || cat == _selCat);
      }).toList();
    });
  }

  String _matId(Map<String, dynamic> m) =>
      m['id']?.toString() ?? m['_id']?.toString() ?? '';

  void _addToKit(Map<String, dynamic> mat) {
    final id = _matId(mat);
    if (id.isEmpty) return;
    setState(() {
      if (_kit.containsKey(id)) {
        _kit[id]!['qty'] = (_kit[id]!['qty'] as int) + 1;
      } else {
        _kit[id] = { ...mat, 'qty': 1 };
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('${mat['name']} added to kit',
          style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
      backgroundColor: _green,
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 1),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  void _changeQty(String id, int delta) {
    if (!_kit.containsKey(id)) return;
    final newQty = (_kit[id]!['qty'] as int) + delta;
    setState(() { if (newQty <= 0) _kit.remove(id); else _kit[id]!['qty'] = newQty; });
  }

  String _buildCartUrl() {
    final items = _kit.values
        .where((m) => (m['amazonASIN']?.toString() ?? '').isNotEmpty)
        .toList();
    if (items.isEmpty) return '';
    final params = <String>[];
    for (int i = 0; i < items.length && i < 10; i++) {
      params.add('ASIN.${i+1}=${items[i]['amazonASIN']}&Quantity.${i+1}=${(items[i]['qty'] as int).clamp(1,10)}');
    }
    return 'https://www.amazon.in/gp/aws/cart/add.html?${params.join("&")}&AssociateTag=miniguru08-21';
  }

  Future<void> _launchUrl(String url) async {
    try {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  void _showSendSheet() {
    final emailCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
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
                final items = _kit.values.map((m) => {
                  'name':          m['name'] ?? '',
                  'qty':           m['qty'],
                  'unit':          m['unit'] ?? 'piece',
                  'icon':          m['icon'] ?? '',
                  'amazonASIN':    m['amazonASIN'] ?? '',
                  'amazonUrl':     m['amazonUrl'] ?? '',
                  'imageUrl':      m['imageUrl'] ?? '',
                  'priceEstimate': m['priceEstimate'],
                }).toList();
                final res = await http.post(
                  Uri.parse('$apiBaseUrl/shop/send-to-parent'),
                  headers: {
                    'Content-Type': 'application/json',
                    if (token != null) 'Authorization': 'Bearer $token',
                  },
                  body: jsonEncode({
                    'parentEmail': email,
                    'childName':   'Your child',
                    'items':       items,
                    'cartUrl':     _buildCartUrl(),
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

            return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Center(child: Container(width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.black12, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 16),
              Row(children: [
                const Text('📧', style: TextStyle(fontSize: 22)),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Send Kit to Parent', style: GoogleFonts.nunito(fontSize: 18, fontWeight: FontWeight.w900, color: _ink)),
                  Text('${_kit.length} items — parent gets one-tap Amazon link',
                      style: GoogleFonts.nunito(fontSize: 12, color: _muted)),
                ])),
                IconButton(icon: const Icon(Icons.close_rounded, color: _muted),
                    onPressed: () => Navigator.pop(ctx2)),
              ]),
              const Divider(height: 24),
              if (sent) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(12)),
                  child: Row(children: [
                    const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32)),
                    const SizedBox(width: 10),
                    Expanded(child: Text('Email sent! Parent will receive full kit list with a one-tap Amazon buy link.',
                        style: GoogleFonts.nunito(fontSize: 13, color: Color(0xFF2E7D32), fontWeight: FontWeight.w700))),
                  ]),
                ),
                const SizedBox(height: 16),
                SizedBox(width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(ctx2),
                    style: ElevatedButton.styleFrom(backgroundColor: _accent, foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: Text('Done', style: GoogleFonts.nunito(fontWeight: FontWeight.w800)))),
              ] else ...[
                Text("Parent's email address",
                    style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w700, color: _ink)),
                const SizedBox(height: 8),
                TextField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  style: GoogleFonts.nunito(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'parent@example.com',
                    hintStyle: GoogleFonts.nunito(color: _muted, fontSize: 14),
                    prefixIcon: const Icon(Icons.email_outlined, color: _muted, size: 20),
                    filled: true, fillColor: const Color(0xFFF8F9FF),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    errorText: err,
                  ),
                ),
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
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                  )),
              ],
            ]);
          }),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final kitCount = _kit.values.fold<int>(0, (s, m) => s + (m['qty'] as int));
    return Scaffold(
      backgroundColor: _bg,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [_buildAppBar()],
        body: Column(children: [
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
                Tab(child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Text('🛒  My Kit'),
                  if (kitCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: _amber, borderRadius: BorderRadius.circular(10)),
                      child: Text('$kitCount', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white)),
                    ),
                  ],
                ])),
              ],
            ),
          ),
          Expanded(child: TabBarView(controller: _tabCtrl, children: [_buildBrowseTab(), _buildKitTab()])),
        ]),
      ),
    );
  }

  Widget _buildAppBar() {
    return SliverAppBar(
      pinned: true, expandedHeight: 100, backgroundColor: _accent, elevation: 0,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        title: Column(mainAxisAlignment: MainAxisAlignment.end, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Project Materials', style: GoogleFonts.nunito(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
          Text('Add to kit → buy on Amazon 🛒', style: GoogleFonts.nunito(fontSize: 10, color: Colors.white70)),
        ]),
        background: Container(decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [Color(0xFF4B5EE4), Color(0xFF7C8EFF)],
              begin: Alignment.topLeft, end: Alignment.bottomRight))),
      ),
    );
  }

  Widget _buildBrowseTab() {
    if (_loading) return const Center(child: CircularProgressIndicator(color: _accent));
    if (_error.isNotEmpty) return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.wifi_off_rounded, size: 56, color: Colors.grey),
      const SizedBox(height: 12),
      Text(_error, textAlign: TextAlign.center, style: GoogleFonts.nunito(fontSize: 14, color: Colors.red)),
      const SizedBox(height: 20),
      ElevatedButton(onPressed: _loadMaterials,
          style: ElevatedButton.styleFrom(backgroundColor: _accent, foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          child: Text('Retry', style: GoogleFonts.nunito(fontWeight: FontWeight.w800))),
    ]));

    return RefreshIndicator(
      onRefresh: _loadMaterials, color: _accent,
      child: CustomScrollView(slivers: [
        if (_cats.isNotEmpty) SliverToBoxAdapter(child: _buildCatRow()),
        SliverToBoxAdapter(child: _buildSearchBar()),
        SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
          child: Text('${_filtered.length} materials',
              style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w600, color: _muted)),
        )),
        if (_filtered.isEmpty)
          SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Text('🔍', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text('No materials found', style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w800, color: _ink)),
          ])))
        else
          _buildGrid(),
        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ]),
    );
  }

  Widget _buildCatRow() {
    return SizedBox(height: 48,
      child: ListView(scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [_chip('All', ''), ..._cats.map((c) => _chip(c['name'] ?? '', c['id'] ?? ''))],
      ),
    );
  }

  Widget _chip(String label, String val) {
    final sel = _selCat == val;
    return GestureDetector(
      onTap: () { setState(() => _selCat = val); _filter(); },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: sel ? _accent : _card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: sel ? _accent : const Color(0xFFDDDDF0)),
        ),
        child: Text(label, style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w700,
            color: sel ? Colors.white : _muted)),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 4),
      child: Container(
        decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 8, offset: const Offset(0, 2))]),
        child: TextField(
          controller: _searchCtrl,
          style: GoogleFonts.nunito(fontSize: 14),
          decoration: InputDecoration(
            hintText: 'Search materials...',
            hintStyle: GoogleFonts.nunito(color: Colors.grey[400], fontSize: 14),
            prefixIcon: const Icon(Icons.search_rounded, color: _muted, size: 20),
            suffixIcon: _search.isNotEmpty
                ? IconButton(icon: const Icon(Icons.close_rounded, size: 18, color: _muted),
                    onPressed: () { _searchCtrl.clear(); setState(() => _search = ''); _filter(); })
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onChanged: (v) { setState(() => _search = v.toLowerCase()); _filter(); },
        ),
      ),
    );
  }

  Widget _buildGrid() {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12,
          mainAxisExtent: _cardH,
        ),
        delegate: SliverChildBuilderDelegate((context, i) {
          final m  = _filtered[i];
          final id = _matId(m);
          final qty = (_kit[id]?['qty'] as int?) ?? 0;
          return _MaterialTile(material: m, kitQty: qty,
              onAdd: () => _addToKit(m),
              onInc: () => _changeQty(id, 1),
              onDec: () => _changeQty(id, -1));
        }, childCount: _filtered.length),
      ),
    );
  }

  Widget _buildKitTab() {
    if (_kit.isEmpty) {
      return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Text('🛒', style: TextStyle(fontSize: 56)),
        const SizedBox(height: 16),
        Text('Your kit is empty', style: GoogleFonts.nunito(fontSize: 18, fontWeight: FontWeight.w800, color: _ink)),
        const SizedBox(height: 8),
        Text('Browse materials and tap "+ Kit"', style: GoogleFonts.nunito(fontSize: 13, color: _muted)),
        const SizedBox(height: 24),
        ElevatedButton(onPressed: () => _tabCtrl.animateTo(0),
          style: ElevatedButton.styleFrom(backgroundColor: _accent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          child: Text('Browse Materials', style: GoogleFonts.nunito(color: Colors.white, fontWeight: FontWeight.w800))),
      ]));
    }

    final withAmazon    = _kit.entries.where((e) => (e.value['amazonASIN']?.toString() ?? '').isNotEmpty).toList();
    final withoutAmazon = _kit.entries.where((e) => (e.value['amazonASIN']?.toString() ?? '').isEmpty).toList();
    final cartUrl = _buildCartUrl();
    double total  = 0;
    for (final e in _kit.entries) {
      total += ((e.value['priceEstimate'] as num?)?.toDouble() ?? 0) * (e.value['qty'] as int);
    }

    return ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 32), children: [
      // Header
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xFF4B5EE4), Color(0xFF7C8EFF)],
              begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          const Text('🛒', style: TextStyle(fontSize: 22)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('My Project Kit', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 15, color: Colors.white)),
            Text('${_kit.length} items${total > 0 ? "  •  Est. ₹${total.toStringAsFixed(0)}" : ""}',
                style: GoogleFonts.nunito(fontSize: 12, color: Colors.white70)),
          ])),
        ]),
      ),
      const SizedBox(height: 16),

      if (withAmazon.isNotEmpty) ...[
        Text('🟠  Buy on Amazon', style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w800, color: _orange)),
        const SizedBox(height: 8),
        ...withAmazon.map((e) => _buildKitRow(e.key, e.value)),
        const SizedBox(height: 14),
      ],

      if (withoutAmazon.isNotEmpty) ...[
        Text('🏪  Collect locally / stationery store',
            style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w800, color: _muted)),
        const SizedBox(height: 8),
        ...withoutAmazon.map((e) => _buildKitRow(e.key, e.value)),
        const SizedBox(height: 14),
      ],

      const Divider(),
      const SizedBox(height: 10),

      if (cartUrl.isNotEmpty) ...[
        ElevatedButton.icon(
          onPressed: () => _launchUrl(cartUrl),
          icon: const Text('🛍️', style: TextStyle(fontSize: 16)),
          label: Text('Buy All on Amazon  (cart pre-loaded)',
              style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 14)),
          style: ElevatedButton.styleFrom(backgroundColor: _orange, foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: const Color(0xFFFFF8E1), borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFFFE082))),
          child: Row(children: [
            const Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFFE65100)),
            const SizedBox(width: 6),
            Expanded(child: Text('Make sure your parent is logged into Amazon before tapping above.',
                style: GoogleFonts.nunito(fontSize: 11, color: Color(0xFFE65100)))),
          ]),
        ),
        const SizedBox(height: 10),
      ],

      OutlinedButton.icon(
        onPressed: _showSendSheet,
        icon: const Icon(Icons.send_rounded, size: 16),
        label: Text('Send Kit to Parent', style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 14)),
        style: OutlinedButton.styleFrom(foregroundColor: _accent,
          side: const BorderSide(color: _accent, width: 1.5),
          minimumSize: const Size(double.infinity, 50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
      ),
      const SizedBox(height: 6),
      Center(child: Text('Parent gets an email with full list + one-tap Amazon buy link',
          textAlign: TextAlign.center, style: GoogleFonts.nunito(fontSize: 11, color: _muted))),
      const SizedBox(height: 16),
      Center(child: TextButton(
        onPressed: () => setState(() => _kit.clear()),
        child: Text('Clear Kit', style: GoogleFonts.nunito(fontSize: 13, color: Colors.red[400])))),
    ]);
  }

  Widget _buildKitRow(String id, Map<String, dynamic> mat) {
    final name      = mat['name']?.toString() ?? '';
    final icon      = mat['icon']?.toString() ?? '🔩';
    final imageUrl  = mat['imageUrl']?.toString() ?? '';
    final qty       = mat['qty'] as int;
    final unit      = mat['unit']?.toString() ?? 'piece';
    final price     = (mat['priceEstimate'] as num?)?.toDouble() ?? 0;
    final hasAmazon = (mat['amazonASIN']?.toString() ?? '').isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6)]),
      child: Row(children: [
        ClipRRect(borderRadius: BorderRadius.circular(8),
          child: Container(width: 48, height: 48, color: const Color(0xFFF0F0FF),
            child: imageUrl.isNotEmpty
                ? Image.network(imageUrl, fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => Center(child: Text(icon, style: const TextStyle(fontSize: 22))))
                : Center(child: Text(icon, style: const TextStyle(fontSize: 22))))),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name, style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w700, color: _ink),
              maxLines: 1, overflow: TextOverflow.ellipsis),
          Text(price > 0 ? '₹${price.toStringAsFixed(0)} / $unit' : (hasAmazon ? 'Check on Amazon' : 'Collect locally'),
              style: GoogleFonts.nunito(fontSize: 11, color: _muted)),
        ])),
        Row(children: [
          _stepBtn(Icons.remove_rounded, () => _changeQty(id, -1)),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text('$qty', style: GoogleFonts.nunito(fontSize: 14, fontWeight: FontWeight.w800, color: _ink))),
          _stepBtn(Icons.add_rounded, () => _changeQty(id, 1)),
        ]),
      ]),
    );
  }

  Widget _stepBtn(IconData icon, VoidCallback fn) => GestureDetector(
    onTap: fn,
    child: Container(width: 28, height: 28,
      decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(8)),
      child: Icon(icon, color: Colors.white, size: 16)),
  );
}

// ══════════════════════════════════════════════════════════════════════════
// _MaterialTile — Browse tab grid card
// 210px total: 130px image + 80px info — exact, no whitespace
// ══════════════════════════════════════════════════════════════════════════
class _MaterialTile extends StatelessWidget {
  final Map<String, dynamic> material;
  final int          kitQty;
  final VoidCallback onAdd;
  final VoidCallback onInc;
  final VoidCallback onDec;

  const _MaterialTile({required this.material, required this.kitQty,
      required this.onAdd, required this.onInc, required this.onDec});

  static const _accent = Color(0xFF5B6EF5);
  static const _ink    = Color(0xFF1A1A2E);
  static const _muted  = Color(0xFF8888AA);
  static const _orange = Color(0xFFFF9900);
  static const _green  = Color(0xFF2E7D32);

  @override
  Widget build(BuildContext context) {
    final name      = material['name']?.toString() ?? '';
    final imageUrl  = material['imageUrl']?.toString() ?? '';
    final icon      = material['icon']?.toString() ?? '📦';
    final price     = (material['priceEstimate'] as num?)?.toDouble() ?? 0;
    final unit      = material['unit']?.toString() ?? 'piece';
    final hasAmazon = (material['amazonASIN']?.toString() ?? '').isNotEmpty;
    final inKit     = kitQty > 0;

    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 8, offset: const Offset(0, 2))]),
      child: Column(children: [
        // Image 130px
        Stack(children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Container(width: double.infinity, height: 130, color: const Color(0xFFF0F2FF),
              child: imageUrl.isNotEmpty
                  ? Image.network(imageUrl, fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => Center(child: Text(icon, style: const TextStyle(fontSize: 40))))
                  : Center(child: Text(icon, style: const TextStyle(fontSize: 40)))),
          ),
          if (hasAmazon)
            Positioned(top: 8, right: 8,
              child: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(color: _orange, borderRadius: BorderRadius.circular(6)),
                child: Text('Amazon', style: GoogleFonts.nunito(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white)))),
          if (inKit)
            Positioned(top: 8, left: 8,
              child: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(6)),
                child: Text('In Kit: $kitQty', style: GoogleFonts.nunito(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white)))),
        ]),

        // Info 80px
        Expanded(child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w800, color: _ink)),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Flexible(child: Text(
                  price > 0 ? '₹${price.toStringAsFixed(0)}/$unit' : (hasAmazon ? 'via Amazon' : 'Local/free'),
                  style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w700,
                      color: price > 0 ? _green : _muted),
                  overflow: TextOverflow.ellipsis)),
                const SizedBox(width: 4),
                if (!inKit)
                  GestureDetector(onTap: onAdd,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                      decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(8)),
                      child: Text('+ Kit', style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white))))
                else
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    _stepBtn(Icons.remove_rounded, onDec),
                    Padding(padding: const EdgeInsets.symmetric(horizontal: 5),
                      child: Text('$kitQty', style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w900, color: _accent))),
                    _stepBtn(Icons.add_rounded, onInc),
                  ]),
              ]),
            ]),
        )),
      ]),
    );
  }

  Widget _stepBtn(IconData icon, VoidCallback fn) => GestureDetector(
    onTap: fn,
    child: Container(padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(6)),
      child: Icon(icon, color: Colors.white, size: 13)),
  );
}