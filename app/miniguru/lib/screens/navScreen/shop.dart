// lib/screens/navScreen/shop.dart
// MiniGuru Shop — fetches from /materials API (201 Firebase materials)
// Browse tab: child adds materials to kit
// My Kit tab: "Buy on Amazon" cart + "Send Kit to Parent" via SendGrid
// No CartRepository, no Razorpay, no real money — Amazon affiliate only (tag: miniguru04-21)

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:miniguru/secrets.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

const Color _bg     = Color(0xFFF5F7FF);
const Color _ink    = Color(0xFF1A1A2E);
const Color _accent = Color(0xFF5B6EF5);
const Color _amber  = Color(0xFFE8A000);
const Color _card   = Color(0xFFFFFFFF);
const Color _muted  = Color(0xFF8888AA);
const Color _green  = Color(0xFF2E7D32);
const Color _orange = Color(0xFFFF9900);

const double _cardH = 232.0; // room for the Goins line

class Shop extends StatefulWidget {
  /// Optional: when set (e.g. "new-lab" / "home-corner"), the Shop opens the
  /// collection with that link key as soon as collections have loaded. Used by
  /// the Consultancy pages. Null = normal Shop, nothing changes.
  final String? openCollectionKey;
  const Shop({super.key, this.openCollectionKey});
  @override
  State<Shop> createState() => _ShopState();
}

class _ShopState extends State<Shop>
    with AutomaticKeepAliveClientMixin, SingleTickerProviderStateMixin {

  late final TabController _tabCtrl = TabController(length: 3, vsync: this);

  List<Map<String, dynamic>> _all      = [];
  List<Map<String, dynamic>> _filtered = [];
  List<Map<String, dynamic>> _cats     = [];
  List<Map<String, dynamic>> _groups   = []; // "clubbed" category groups (Sept 2026)
  List<Map<String, dynamic>> _collections = [];
  String _selGroup = ''; // group name filter — separate from _selCat, expands to several categories
  bool   _loading = true;
  String _error   = '';
  String _selCat  = '';
  String _search  = '';

  final Map<String, Map<String, dynamic>> _kit = {};
  bool _isSending = false; // prevents double-send on parent email
  bool _autoOpened = false; // opens the linked collection only once
  final TextEditingController _searchCtrl = TextEditingController();

  @override bool get wantKeepAlive => true;

  @override
  void initState() { super.initState(); _loadMaterials(); _loadCollections(); _loadGroups(); }

  // "Clubbed" category groups (Sept 2026) — e.g. one "Electronics & Circuits"
  // chip surfacing every material across several specific categories at
  // once. Optional and additive: if this fails to load, the existing
  // per-category chip row below still works exactly as before.
  Future<void> _loadGroups() async {
    try {
      final res = await http.get(Uri.parse('$apiBaseUrl/materials/category-groups'));
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body);
        if (mounted) setState(() => _groups = List<Map<String, dynamic>>.from(list));
      }
    } catch (_) {
      // Non-critical.
    }
  }

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
          final rawCats = m['categories'];
          final List<String> mCats = (rawCats is List && rawCats.isNotEmpty)
              ? rawCats.map((e) => e.toString()).toList()
              : [m['category']?.toString() ?? ''];
          for (final c in mCats) {
            if (c.isNotEmpty && seen.add(c)) cats.add({'id': c, 'name': c});
          }
        }
        setState(() { _all = mats; _filtered = _collapseVariants(mats); _cats = cats; _loading = false; });
      } else {
        setState(() { _error = 'Could not load materials (${res.statusCode})'; _loading = false; });
      }
    } catch (e) {
      setState(() { _error = 'Network error: $e'; _loading = false; });
    }
  }

  // ── Collections (Sept 2026) — "Shop by Project" quick-order ────────────
  // Curated bundles an admin assembled (e.g. "🚁 Drone Building Kit") —
  // tapping one shows everything for that project pre-checked, so a child
  // can add a whole kit in one tap instead of hunting the catalog by type.
  Future<void> _loadCollections() async {
    try {
      final res = await http.get(Uri.parse('$apiBaseUrl/materials/collections'));
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body);
        if (mounted) setState(() => _collections = List<Map<String, dynamic>>.from(list));
        _maybeAutoOpenCollection();
      }
    } catch (_) {
      // Non-critical — Shop works fine without the collections row if this fails.
    }
  }

  void _maybeAutoOpenCollection() {
    final key = widget.openCollectionKey;
    if (key == null || key.isEmpty || _autoOpened || !mounted) return;
    for (final c in _collections) {
      if ((c['linkKey'] ?? '').toString() == key) {
        _autoOpened = true;
        final id = c['id'].toString();
        final name = (c['name'] ?? '').toString();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _openCollection(id, name);
        });
        return;
      }
    }
  }

  Future<void> _openCollection(String id, String name) async {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => _CollectionSheet(
        collectionId: id,
        collectionName: name,
        onAddAll: (items) {
          for (final m in items) { _addToKit(m, silent: true); }
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('${items.length} items added to your kit! 🎉'),
            backgroundColor: _green,
          ));
        },
      ),
    );
  }

  Widget _buildCollectionsRow() {
    if (_collections.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 76,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 2),
        children: _collections.map((c) {
          final name = (c['name'] ?? '').toString();
          final icon = (c['icon'] ?? '🧰').toString();
          final count = (c['itemCount'] ?? 0).toString();
          return GestureDetector(
            onTap: () => _openCollection(c['id'].toString(), name),
            child: Container(
              width: 132,
              margin: const EdgeInsets.only(right: 10),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: _orange.withOpacity(0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _orange.withOpacity(0.35)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(icon, style: const TextStyle(fontSize: 22)),
                  const SizedBox(height: 4),
                  Text(name, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w800, color: _ink)),
                  Text('$count items', style: GoogleFonts.nunito(fontSize: 10, color: _muted)),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }


  List<String> _matCategories(Map<String, dynamic> m) {
    final raw = m['categories'];
    if (raw is List && raw.isNotEmpty) return raw.map((e) => e.toString()).toList();
    final c = (m['category'] ?? '').toString();
    return c.isEmpty ? [] : [c];
  }

  // Search text and item names are cleaned the same way (lower-case, brackets /
  // commas / odd or double spaces turned into single spaces) so a pasted full
  // name still finds its item instead of showing nothing.
  String _normSearch(String s) =>
      s.toLowerCase().replaceAll(RegExp(r'[^\p{L}\p{N}]+', unicode: true), ' ').trim();

  bool _matchesSearch(Map<String, dynamic> m, String q) {
    if (q.isEmpty) return true;
    final aliases = ((m['aliases'] as List?) ?? []).map((e) => e.toString()).join(' ');
    final cats = _matCategories(m).join(' ');
    final hay = _normSearch('${m['name'] ?? ''} $aliases $cats ${m['amazonASIN'] ?? ''}');
    if (hay.contains(q)) return true;
    return q.split(' ').every((t) => t.isEmpty || hay.contains(t));
  }

  void _filter() {
    // A group chip expands to every category it contains; a single-category
    // chip and the group row are mutually exclusive (picking one clears
    // the other) so the two rows never fight over what's showing.
    final groupCats = _selGroup.isEmpty
        ? null
        : (_groups.firstWhere((g) => g['name'] == _selGroup, orElse: () => {})['memberCategories'] as List?)
              ?.map((e) => e.toString()).toSet();
    setState(() {
      _filtered = _collapseVariants(_all.where((m) {
        final name = (m['name'] ?? '').toString().toLowerCase();
        final aliases = ((m['aliases'] as List?) ?? []).map((e) => e.toString().toLowerCase());
        final matchSearch = _search.isEmpty || _matchesSearch(m, _search);
        final mCats = _matCategories(m);
        final matchCat = _selCat.isEmpty || mCats.contains(_selCat);
        final matchGroup = groupCats == null || mCats.any(groupCats.contains);
        return matchSearch && matchCat && matchGroup;
      }).toList());
    });
  }

  // ── Ask MiniGuru AI (Oct 2026) ────────────────────────────────────────
  // Name or photo search through Gemini. The photo is shrunk by the picker
  // (max 800 px) before it leaves the phone; the server never stores it.
  bool _aiBusy = false;

  Future<void> _aiSearchByText() async {
    final text = _searchCtrl.text.trim();
    if (text.isEmpty) return;
    await _runAiSearch(query: text);
  }

  Future<void> _aiSearchByPhoto() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('📷 Search with a photo', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
        content: Text(
            'Your photo is sent to Google\'s Gemini AI to find matching items. '
            'MiniGuru does not save it. Only use photos of objects — no people.',
            style: GoogleFonts.nunito(fontSize: 13, height: 1.4)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Choose photo')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final picked = await ImagePicker().pickImage(
          source: ImageSource.gallery, maxWidth: 800, maxHeight: 800, imageQuality: 70);
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      if (bytes.length > 1100000) {
        _aiSnack('That photo is too big. Please try a smaller one.');
        return;
      }
      final mime = (picked.mimeType != null && ['image/jpeg', 'image/png', 'image/webp'].contains(picked.mimeType))
          ? picked.mimeType!
          : 'image/jpeg';
      await _runAiSearch(query: _searchCtrl.text.trim(), imageBase64: base64Encode(bytes), mimeType: mime);
    } catch (e) {
      _aiSnack('Could not use that photo. Please try again.');
    }
  }

  void _aiSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _runAiSearch({String? query, String? imageBase64, String? mimeType}) async {
    if (_aiBusy) return;
    setState(() => _aiBusy = true);
    try {
      final res = await MiniguruApi().aiSearchMaterials(query: query, imageBase64: imageBase64, mimeType: mimeType);
      final body = jsonDecode(res.body);
      if (res.statusCode != 200) {
        _aiSnack((body['error'] ?? 'AI search is not available right now.').toString());
        return;
      }
      // Use OUR copies of the items (same objects the grid uses), and show the
      // main item when the AI points at a variant.
      final byId = <String, Map<String, dynamic>>{for (final m in _all) _matId(m): m};
      final reasons = <String, String>{};
      final found = <Map<String, dynamic>>[];
      for (final raw in (body['materials'] as List? ?? [])) {
        final id = (raw['id'] ?? '').toString();
        final own = byId[id];
        if (own == null) continue;
        found.add(own);
        reasons[id] = (raw['aiReason'] ?? '').toString();
      }
      final heads = _collapseVariants(found);
      if (!mounted) return;
      if (heads.isEmpty) {
        _aiSnack((body['message'] ?? 'No close match found. Try other words, or a clearer photo.').toString());
        return;
      }
      _showAiResults(heads, reasons);
    } catch (e) {
      _aiSnack('AI search is not available right now.');
    } finally {
      if (mounted) setState(() => _aiBusy = false);
    }
  }

  void _showAiResults(List<Map<String, dynamic>> heads, Map<String, String> reasons) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 12),
            Align(alignment: Alignment.centerLeft,
              child: Text('✨ MiniGuru AI found these', style: GoogleFonts.nunito(fontSize: 17, fontWeight: FontWeight.w900, color: _ink))),
            const SizedBox(height: 2),
            Align(alignment: Alignment.centerLeft,
              child: Text('AI can be wrong — check the picture and name.', style: GoogleFonts.nunito(fontSize: 12, color: _muted))),
            const SizedBox(height: 8),
            Flexible(
              child: ListView(shrinkWrap: true, children: [
                for (final m in heads) _aiResultRow(ctx, m, reasons),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _aiResultRow(BuildContext sheetCtx, Map<String, dynamic> m, Map<String, String> reasons) {
    final id = _matId(m);
    final imageUrl = m['imageUrl']?.toString() ?? '';
    final unit = m['unit']?.toString() ?? 'piece';
    final isGroup = _optionsFor(m).length > 1;
    final reason = reasons[id] ?? '';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Container(width: 52, height: 52, color: const Color(0xFFF0F2FF),
            child: imageUrl.isNotEmpty
                ? Image.network(imageUrl, fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(Icons.inventory_2_outlined))
                : const Icon(Icons.inventory_2_outlined)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(m['name']?.toString() ?? '', maxLines: 2, overflow: TextOverflow.ellipsis,
                style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w800, color: _ink)),
            Text('🪙 ${_goinsOf(m)} Goins per $unit',
                style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w700, color: const Color(0xFFB45309))),
            if (reason.isNotEmpty)
              Text(reason, maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.nunito(fontSize: 11, color: _muted)),
          ]),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () {
            Navigator.pop(sheetCtx);
            if (isGroup) { _openVariantSheet(m); } else { _addToKit(m); }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(8)),
            child: Text(isGroup ? 'Choose' : '+ Kit',
                style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
          ),
        ),
      ]),
    );
  }

  // ── Variants (Oct 2026) ───────────────────────────────────────────────
  // An item with `variantOf` set is an option under a main item. The grid
  // shows ONE tile per group (the main item); a search hit on any option
  // shows its main item. If the main item is missing for any reason, the
  // variant simply shows as a normal item.
  List<Map<String, dynamic>> _collapseVariants(List<Map<String, dynamic>> hits) {
    final byId = <String, Map<String, dynamic>>{
      for (final m in _all) _matId(m): m,
    };
    final out = <Map<String, dynamic>>[];
    final seen = <String>{};
    for (final m in hits) {
      final parent = (m['variantOf'] ?? '').toString();
      final shown = (parent.isNotEmpty && byId.containsKey(parent)) ? byId[parent]! : m;
      if (seen.add(_matId(shown))) out.add(shown);
    }
    return out;
  }

  /// The main item followed by all of its variants.
  List<Map<String, dynamic>> _optionsFor(Map<String, dynamic> head) {
    final id = _matId(head);
    return [head, ..._all.where((m) => (m['variantOf'] ?? '').toString() == id)];
  }

  int _goinsOf(Map<String, dynamic> m) =>
      ((m['goinsPrice'] ?? m['goinsPerUnit'] ?? 0) as num).toInt();

  void _openVariantSheet(Map<String, dynamic> head) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
        final options = _optionsFor(head);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 12),
              Align(alignment: Alignment.centerLeft,
                child: Text(head['name']?.toString() ?? '',
                    style: GoogleFonts.nunito(fontSize: 17, fontWeight: FontWeight.w900, color: _ink))),
              const SizedBox(height: 2),
              Align(alignment: Alignment.centerLeft,
                child: Text('Tick the option you want — they all cost the same.',
                    style: GoogleFonts.nunito(fontSize: 12, color: _muted))),
              const SizedBox(height: 8),
              Flexible(
                child: ListView(shrinkWrap: true, children: [
                  for (final o in options) _variantRow(o, setSheet),
                ]),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _accent, foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text('Done', style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                ),
              ),
            ]),
          ),
        );
      }),
    );
  }

  Widget _variantRow(Map<String, dynamic> o, StateSetter setSheet) {
    final id = _matId(o);
    final qty = (_kit[id]?['qty'] as int?) ?? 0;
    final ticked = qty > 0;
    final imageUrl = o['imageUrl']?.toString() ?? '';
    final unit = o['unit']?.toString() ?? 'piece';
    void toggle(bool on) => setSheet(() {
          if (on) { _addToKit(o, silent: true); } else { _changeQty(id, -qty); }
        });
    return InkWell(
      onTap: () => toggle(!ticked),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Checkbox(value: ticked, activeColor: _accent, onChanged: (v) => toggle(v == true)),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Container(width: 44, height: 44, color: const Color(0xFFF0F2FF),
              child: imageUrl.isNotEmpty
                  ? Image.network(imageUrl, fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Icon(Icons.inventory_2_outlined))
                  : const Icon(Icons.inventory_2_outlined)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(o['name']?.toString() ?? '', maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w800, color: _ink)),
              Text('🪙 ${_goinsOf(o)} Goins per $unit',
                  style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w700, color: const Color(0xFFB45309))),
            ]),
          ),
          if (ticked)
            Row(mainAxisSize: MainAxisSize.min, children: [
              _stepBtn(Icons.remove_rounded, () => setSheet(() => _changeQty(id, -1))),
              Padding(padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text('$qty', style: GoogleFonts.nunito(fontSize: 14, fontWeight: FontWeight.w800, color: _ink))),
              _stepBtn(Icons.add_rounded, () => setSheet(() => _changeQty(id, 1))),
            ]),
        ]),
      ),
    );
  }

  String _matId(Map<String, dynamic> m) =>
      m['id']?.toString() ?? m['_id']?.toString() ?? '';

  void _addToKit(Map<String, dynamic> mat, {bool silent = false}) {
    final id = _matId(mat);
    if (id.isEmpty) return;
    setState(() {
      if (_kit.containsKey(id)) {
        _kit[id]!['qty'] = (_kit[id]!['qty'] as int) + 1;
      } else {
        _kit[id] = { ...mat, 'qty': 1 };
      }
    });
    if (silent) return; // bulk-add from a Collection shows one summary snack instead
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
    return 'https://www.amazon.in/gp/aws/cart/add.html?${params.join("&")}&AssociateTag=miniguru04-21';
  }

  Future<void> _launchUrl(String url) async {
    try {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  void _showSendSheet() {
    final emailCtrl = TextEditingController();
    // BUGFIX (Aug 2026): sending/sent/err used to be declared INSIDE the
    // StatefulBuilder's builder callback below. That callback re-runs on
    // every setSt() rebuild, which re-declared all three as fresh
    // false/false/null on every single rebuild — silently discarding
    // whatever doSend() had just set (sending=true, an error, or
    // sent=true) the instant it tried to render it. The button looked
    // completely unresponsive: no spinner, no error, nothing — even
    // though a real network request (and sometimes a real send) was
    // happening invisibly in the background. Same bug class as Rule 31
    // (StatefulBuilder local vars reset on rebuild) — that rule was only
    // ever applied to the double-send guard (_isSending, class-level)
    // and never to these three. Fix: declare them here, once, outside
    // the rebuilding closure, so every setSt() rebuild closes over the
    // SAME persistent variables instead of resetting them.
    bool sending = false;
    bool sent = false;
    String? err;
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
            Future<void> doSend() async {
              if (_isSending) return; // prevent double-send
              final email = emailCtrl.text.trim();
              if (email.isEmpty || !email.contains('@')) {
                setSt(() => err = 'Please enter a valid email address');
                return;
              }
              _isSending = true;
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
                  _isSending = false;
                  setSt(() { sent = true; sending = false; });
                  await Future.delayed(const Duration(milliseconds: 300));
                  if (context.mounted) Navigator.pop(context);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Row(children: [
                        const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                        const SizedBox(width: 10),
                        Expanded(child: Text(
                          'Kit email sent to ${emailCtrl.text.trim()} ✓',
                          style: GoogleFonts.nunito(fontWeight: FontWeight.w700, color: Colors.white),
                        )),
                      ]),
                      backgroundColor: const Color(0xFF2E7D32),
                      behavior: SnackBarBehavior.floating,
                      duration: const Duration(seconds: 4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ));
                  }
                } else {
                  _isSending = false; setSt(() { err = 'Failed to send. Try again.'; sending = false; });
                }
              } catch (e) {
                _isSending = false; setSt(() { err = 'Network error. Try again.'; sending = false; });
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
                const Tab(text: '🛍️  Shop'),
                const Tab(text: '🎁  Preset Kits'),
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
          Expanded(child: TabBarView(controller: _tabCtrl, children: [_buildBrowseTab(), _buildPresetKitsTab(), _buildKitTab()])),
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

  // Preset kits = the admin-made Collections. A collection that is linked to
  // the T-LAB / Home Corner Consultancy page also shows here (and vice versa).
  Widget _buildPresetKitsTab() {
    if (_loading) return const Center(child: CircularProgressIndicator(color: _accent));
    if (_collections.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('🎁', style: TextStyle(fontSize: 56)),
            const SizedBox(height: 10),
            Text('No preset kits yet',
                style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w900, color: _ink)),
            const SizedBox(height: 4),
            Text('Ready-made kits will appear here.',
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(fontSize: 13, color: _muted)),
          ]),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadMaterials,
      color: _accent,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
        children: [
          Text('Pick a ready-made kit, remove anything you already have, then add it to My Kit.',
              style: GoogleFonts.nunito(fontSize: 12, color: _muted, height: 1.4)),
          const SizedBox(height: 10),
          for (final c in _collections)
            GestureDetector(
              onTap: () => _openCollection(c['id'].toString(), (c['name'] ?? '').toString()),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _orange.withOpacity(0.35)),
                ),
                child: Row(children: [
                  Text((c['icon'] ?? '🧰').toString(), style: const TextStyle(fontSize: 30)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text((c['name'] ?? '').toString(),
                          style: GoogleFonts.nunito(
                              fontSize: 14, fontWeight: FontWeight.w900, color: _ink)),
                      if ((c['description'] ?? '').toString().trim().isNotEmpty)
                        Text((c['description']).toString(),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.nunito(fontSize: 12, color: _muted, height: 1.3)),
                      const SizedBox(height: 2),
                      Text(
                          '${c['itemCount'] ?? 0} items'
                          '${(c['linkKey'] ?? '').toString() == 'new-lab' ? '  ·  🏫 also on the T-LAB page' : ((c['linkKey'] ?? '').toString() == 'home-corner' ? '  ·  🏠 also on the Home Corner page' : '')}',
                          style: GoogleFonts.nunito(fontSize: 11, color: _muted)),
                    ]),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: _muted),
                ]),
              ),
            ),
        ],
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
            if (_search.isNotEmpty) ...[
              const SizedBox(height: 14),
              ElevatedButton.icon(
                onPressed: _aiBusy ? null : _aiSearchByText,
                icon: const Icon(Icons.auto_awesome_rounded, size: 18),
                label: Text('Ask MiniGuru AI', style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                style: ElevatedButton.styleFrom(
                    backgroundColor: _accent, foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              ),
            ],
          ])))
        else
          _buildGrid(),
        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ]),
    );
  }

  Widget _buildCatRow() {
    return Column(children: [
      if (_groups.isNotEmpty)
        SizedBox(height: 42,
          child: ListView(scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
            children: [
              _groupChip('All', ''),
              ..._groups.map((g) => _groupChip('${g['emoji'] ?? '🗂️'} ${g['name']}', g['name'] ?? '')),
            ],
          ),
        ),
      SizedBox(height: 48,
        child: ListView(scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          children: [_chip('All', ''), ..._cats.map((c) => _chip(c['name'] ?? '', c['id'] ?? ''))],
        ),
      ),
    ]);
  }

  // The "clubbed" umbrella row — a broader browse entry point sitting above
  // the specific-category chips (e.g. tap "🔌 Electronics & Circuits" to see
  // everything across Electronics + Sensors + Boards + Batteries at once).
  Widget _groupChip(String label, String val) {
    final sel = _selGroup == val;
    return GestureDetector(
      onTap: () { setState(() { _selGroup = val; if (val.isNotEmpty) _selCat = ''; }); _filter(); },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: sel ? _amber.withOpacity(0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: sel ? _amber : const Color(0xFFEEEEF6)),
        ),
        child: Text(label, style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w800,
            color: sel ? const Color(0xFF8A6200) : _muted)),
      ),
    );
  }

  Widget _chip(String label, String val) {
    final sel = _selCat == val;
    return GestureDetector(
      onTap: () { setState(() { _selCat = val; if (val.isNotEmpty) _selGroup = ''; }); _filter(); },
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
            suffixIcon: _aiBusy
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: _accent)))
                : Row(mainAxisSize: MainAxisSize.min, children: [
                    if (_search.isNotEmpty)
                      IconButton(
                          tooltip: 'Ask MiniGuru AI',
                          icon: const Icon(Icons.auto_awesome_rounded, size: 20, color: _accent),
                          onPressed: _aiSearchByText),
                    IconButton(
                        tooltip: 'Search with a photo',
                        icon: const Icon(Icons.photo_camera_outlined, size: 20, color: _accent),
                        onPressed: _aiSearchByPhoto),
                    if (_search.isNotEmpty)
                      IconButton(icon: const Icon(Icons.close_rounded, size: 18, color: _muted),
                          onPressed: () { _searchCtrl.clear(); setState(() => _search = ''); _filter(); }),
                  ]),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onChanged: (v) { setState(() => _search = _normSearch(v)); _filter(); },
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
          final options = _optionsFor(m);
          if (options.length > 1) {
            // A group: the tile shows the total in the kit across all options
            // and opens the tick list instead of adding directly.
            final groupQty = options.fold<int>(0, (s, o) => s + ((_kit[_matId(o)]?['qty'] as int?) ?? 0));
            return _MaterialTile(material: m, kitQty: groupQty, variantCount: options.length,
                onAdd: () => _openVariantSheet(m),
                onInc: () => _openVariantSheet(m),
                onDec: () => _openVariantSheet(m));
          }
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
          Text('🪙 ${((mat['goinsPrice'] ?? mat['goinsPerUnit'] ?? 0) as num).toInt()} Goins / $unit',
              style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w700, color: const Color(0xFFB45309))),
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
  final int          variantCount; // >1 = a group of options, chosen by tick

  const _MaterialTile({required this.material, required this.kitQty,
      required this.onAdd, required this.onInc, required this.onDec,
      this.variantCount = 1});

  static const _accent = Color(0xFF5B6EF5);
  static const _ink    = Color(0xFF1A1A2E);
  static const _muted  = Color(0xFF8888AA);
  static const _orange = Color(0xFFFF9900);
  static const _green  = Color(0xFF2E7D32);

  @override
  Widget build(BuildContext context) {
    final name       = material['name']?.toString() ?? '';
    final imageUrl   = material['imageUrl']?.toString() ?? '';
    final icon       = material['icon']?.toString() ?? '📦';
    final price      = (material['priceEstimate'] as num?)?.toDouble() ?? 0;
    final unit       = material['unit']?.toString() ?? 'piece';
    final amazonUrl  = material['amazonUrl']?.toString() ?? '';
    final hasAmazon  = amazonUrl.isNotEmpty;
    final inKit      = kitQty > 0;
    final goins      = ((material['goinsPrice'] ?? material['goinsPerUnit'] ?? 0) as num).toInt();
    final isGroup    = variantCount > 1;

    return GestureDetector(
      // Tapping the card (outside the + Kit / stepper buttons, which
      // still win their own taps first) opens the real Amazon product
      // page for this material, so a parent/child can see the actual
      // current price and photos before buying.
      onTap: hasAmazon ? () => launchUrl(Uri.parse(amazonUrl), mode: LaunchMode.externalApplication) : null,
      child: Container(
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
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text('Amazon', style: GoogleFonts.nunito(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white)),
                  const SizedBox(width: 2),
                  const Icon(Icons.open_in_new_rounded, size: 9, color: Colors.white),
                ]))),
          if (inKit)
            Positioned(top: 8, left: 8,
              child: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(6)),
                child: Text('In Kit: $kitQty', style: GoogleFonts.nunito(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white)))),
        ]),

        // Info
        Expanded(child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w800, color: _ink)),
              // Quantity + unit read more naturally than a bare "/unit"
              // slash — e.g. "₹50 per pack of 5" instead of "₹50/pack of 5"
              // — and doesn't assume every material is priced per single
              // piece, since some are priced per pack, per metre, etc.
              Text(
                price > 0 ? '₹${price.toStringAsFixed(0)} per $unit' : (hasAmazon ? 'via Amazon' : 'Local/free'),
                style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w700,
                    color: price > 0 ? _green : _muted),
                overflow: TextOverflow.ellipsis,
              ),
              Text('🪙 $goins Goins per $unit',
                  style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFFB45309)),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
              if (price > 0)
                Text('Est. price — see Amazon for current rate',
                    style: GoogleFonts.nunito(fontSize: 8, fontWeight: FontWeight.w600, color: _muted),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 2),
              Align(
                alignment: Alignment.centerRight,
                child: (isGroup || !inKit)
                  ? GestureDetector(onTap: onAdd,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                        decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(8)),
                        child: Text(isGroup ? 'Choose · $variantCount options' : '+ Kit',
                            style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white))))
                  : Row(mainAxisSize: MainAxisSize.min, children: [
                      _stepBtn(Icons.remove_rounded, onDec),
                      Padding(padding: const EdgeInsets.symmetric(horizontal: 5),
                        child: Text('$kitQty', style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w900, color: _accent))),
                      _stepBtn(Icons.add_rounded, onInc),
                    ]),
              ),
            ]),
        )),
      ]),
    ));
  }

  Widget _stepBtn(IconData icon, VoidCallback fn) => GestureDetector(
    onTap: fn,
    child: Container(padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: _accent, borderRadius: BorderRadius.circular(6)),
      child: Icon(icon, color: Colors.white, size: 13)),
  );
}

// ── Collection quick-order sheet (Sept 2026) ────────────────────────────
// Shows everything in a curated collection pre-checked; the child can
// uncheck anything they don't need, then add the rest to their kit in one
// tap. Reuses whatever shape the /materials endpoint already returns
// (same toFlutterShape as everywhere else in the app) — no special casing.
class _CollectionSheet extends StatefulWidget {
  final String collectionId;
  final String collectionName;
  final void Function(List<Map<String, dynamic>> items) onAddAll;
  const _CollectionSheet({
    required this.collectionId,
    required this.collectionName,
    required this.onAddAll,
  });

  @override
  State<_CollectionSheet> createState() => _CollectionSheetState();
}

class _CollectionSheetState extends State<_CollectionSheet> {
  bool _loading = true;
  String? _error;
  String? _description;
  String _icon = '🧰';
  List<Map<String, dynamic>> _materials = [];
  final Set<String> _checked = {};

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await http.get(
          Uri.parse('$apiBaseUrl/materials/collections/${widget.collectionId}'));
      if (res.statusCode != 200) throw Exception('Could not load this collection.');
      final data = jsonDecode(res.body);
      final mats = List<Map<String, dynamic>>.from(data['materials'] ?? []);
      if (mounted) {
        setState(() {
          _materials = mats;
          _description = data['description'];
          _icon = (data['icon'] ?? '🧰').toString();
          _checked.addAll(mats.map((m) => (m['id'] ?? m['_id']).toString()));
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load this collection. Please try again.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: Column(children: [
          Container(width: 40, height: 4,
              decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 12),
          Row(children: [
            Text(_icon, style: const TextStyle(fontSize: 26)),
            const SizedBox(width: 8),
            Expanded(child: Text(widget.collectionName,
                style: GoogleFonts.nunito(fontSize: 18, fontWeight: FontWeight.w900, color: _ink))),
          ]),
          if (_description != null && _description!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Align(alignment: Alignment.centerLeft,
              child: Text(_description!, style: GoogleFonts.nunito(fontSize: 12, color: _muted))),
          ],
          const SizedBox(height: 8),
          if (!_loading && _error == null)
            Align(alignment: Alignment.centerLeft,
              child: Text('Everything is pre-checked — tap to remove anything you don\'t need.',
                  style: GoogleFonts.nunito(fontSize: 12, color: _muted, fontStyle: FontStyle.italic))),
          const SizedBox(height: 10),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!, style: GoogleFonts.nunito(color: Colors.red)))
                    : ListView.separated(
                        controller: scrollController,
                        itemCount: _materials.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final m = _materials[i];
                          final id = (m['id'] ?? m['_id']).toString();
                          final checked = _checked.contains(id);
                          return CheckboxListTile(
                            value: checked,
                            onChanged: (v) => setState(() {
                              if (v == true) _checked.add(id); else _checked.remove(id);
                            }),
                            controlAffinity: ListTileControlAffinity.leading,
                            secondary: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: (m['imageUrl'] ?? '').toString().isNotEmpty
                                  ? Image.network(m['imageUrl'], width: 40, height: 40, fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => const Icon(Icons.inventory_2_outlined))
                                  : const SizedBox(width: 40, height: 40, child: Icon(Icons.inventory_2_outlined)),
                            ),
                            title: Text(m['name']?.toString() ?? '', style: GoogleFonts.nunito(fontWeight: FontWeight.w700, fontSize: 13)),
                            subtitle: Text(
                                (m['priceEstimate'] != null ? '₹${m['priceEstimate']} / ${m['unit'] ?? 'piece'}  ·  ' : '') +
                                    '🪙 ${((m['goinsPrice'] ?? m['goinsPerUnit'] ?? 0) as num).toInt()} Goins',
                                style: GoogleFonts.nunito(fontSize: 11, color: _muted)),
                          );
                        },
                      ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _checked.isEmpty ? null : () {
                final toAdd = _materials.where((m) => _checked.contains((m['id'] ?? m['_id']).toString())).toList();
                Navigator.pop(context);
                widget.onAddAll(toAdd);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: _accent, foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                _checked.isEmpty ? 'Select at least one item' : 'Add ${_checked.length} items to Kit',
                style: GoogleFonts.nunito(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}