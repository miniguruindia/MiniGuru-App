// lib/widgets/material_picker_widget.dart
// Full-screen Material Picker for children to select STEM materials
// Light theme — white background, clean cards, proper image sizing

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/models/MaterialItem.dart';
import 'package:miniguru/repository/GoinsRepository.dart';
import 'package:miniguru/network/MiniguruApi.dart';

// ─── Light theme colours ──────────────────────────────────────────────────────
const _blue     = Color(0xFF5B6EF5);
const _blueSoft = Color(0xFFEEF0FF);
const _green    = Color(0xFF10B981);
const _amber    = Color(0xFFE8A000);
const _red      = Color(0xFFEF4444);
const _ink      = Color(0xFF1A1A2E);
const _muted    = Color(0xFF8888AA);
const _bg       = Color(0xFFF5F7FF);
const _card     = Color(0xFFFFFFFF);
const _border   = Color(0xFFE8EAFF);

// ─── Public entry-point ───────────────────────────────────────────────────────
Future<List<PickedMaterial>?> showMaterialPicker({
  required BuildContext context,
  required int currentGoinsBalance,
  List<PickedMaterial>? existingPicked,
}) {
  return showModalBottomSheet<List<PickedMaterial>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => MaterialPickerSheet(
      currentGoinsBalance: currentGoinsBalance,
      existingPicked: existingPicked ?? [],
    ),
  );
}

// ─── Sheet widget ─────────────────────────────────────────────────────────────
class MaterialPickerSheet extends StatefulWidget {
  final int currentGoinsBalance;
  final List<PickedMaterial> existingPicked;

  const MaterialPickerSheet({
    Key? key,
    required this.currentGoinsBalance,
    required this.existingPicked,
  }) : super(key: key);

  @override
  State<MaterialPickerSheet> createState() => _MaterialPickerSheetState();
}

class _MaterialPickerSheetState extends State<MaterialPickerSheet> {
  final _repo = GoinsRepository();

  List<MaterialCategory> _categories  = [];
  List<MaterialItem>     _allMaterials = [];
  List<MaterialItem>     _filtered     = [];
  Map<String, int>       _quantities   = {};
  String                 _activeCategoryId = 'all';
  String                 _searchQuery  = '';
  bool                   _loading      = true;

  @override
  void initState() {
    super.initState();
    for (final p in widget.existingPicked) {
      _quantities[p.item.id] = p.quantity;
    }
    _loadData();
  }

  Future<void> _loadData() async {
    final cats = await _repo.getMaterialCategories();
    final mats = await _repo.getMaterials();
    setState(() {
      _categories   = cats;
      _allMaterials = mats;
      _filtered     = mats;
      _loading      = false;
    });
  }

  // ─── Derived values ───────────────────────────────────────
  int get _totalGoins {
    int total = 0;
    for (final mat in _allMaterials) {
      final qty = _quantities[mat.id] ?? 0;
      total += mat.goinsPerUnit * qty;
    }
    return total;
  }

  int get _remainingBalance => widget.currentGoinsBalance - _totalGoins;
  bool get _overBudget      => _remainingBalance < 0;
  int get _shortfall        => _overBudget ? _remainingBalance.abs() : 0;

  List<PickedMaterial> get _pickedList {
    return _allMaterials
        .where((m) => (_quantities[m.id] ?? 0) > 0)
        .map((m) => PickedMaterial(item: m, quantity: _quantities[m.id]!))
        .toList();
  }

  // ─── Filter ───────────────────────────────────────────────
  void _applyFilter() {
    setState(() {
      _filtered = _allMaterials.where((m) {
        final matchCat    = _activeCategoryId == 'all' || m.categoryId == _activeCategoryId;
        final matchSearch = _searchQuery.isEmpty ||
            m.name.toLowerCase().contains(_searchQuery.toLowerCase());
        return matchCat && matchSearch;
      }).toList();
    });
  }

  void _setCategory(String id) {
    _activeCategoryId = id;
    _applyFilter();
  }

  void _setQty(String materialId, int delta) {
    setState(() {
      final current = _quantities[materialId] ?? 0;
      final newQty  = (current + delta).clamp(0, 99);
      if (newQty == 0) {
        _quantities.remove(materialId);
      } else {
        _quantities[materialId] = newQty;
      }
    });
  }

  // ─── Confirm ──────────────────────────────────────────────
  // BEHAVIOR CHANGE (Aug 2026, confirmed): planning always continues, even
  // over budget. Deduction (and, if it goes negative, an auto-resolved
  // debt record) now happens server-side at video upload — this screen no
  // longer blocks or requires a manual pre-approval request.
  void _confirm() {
    Navigator.of(context).pop(_pickedList);
  }

  // ─── Build ────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.of(context).size.height;
    return Container(
      height: screenH * 0.92,
      decoration: const BoxDecoration(
        color: _bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          _buildHandle(),
          _buildHeader(),
          _buildGoinsBar(),
          if (_overBudget) _buildShortfallBanner(),
          _buildSearch(),
          _buildCategoryRow(),
          Expanded(child: _loading ? _buildLoader() : _buildMaterialGrid()),
          _buildSuggestLink(),
          _buildConfirmBar(),
        ],
      ),
    );
  }

  Widget _buildHandle() => Padding(
        padding: const EdgeInsets.only(top: 10, bottom: 4),
        child: Center(
          child: Container(
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: _border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
      );

  Widget _buildHeader() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Row(children: [
          const Text('🧰', style: TextStyle(fontSize: 22)),
          const SizedBox(width: 10),
          Expanded(
            child: Text('Pick Your Materials',
                style: GoogleFonts.nunito(
                    color: _ink, fontSize: 18, fontWeight: FontWeight.w900)),
          ),
          GestureDetector(
            onTap: () => Navigator.of(context).pop(null),
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                  color: _border, borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.close, color: _muted, size: 18),
            ),
          ),
        ]),
      );

  Widget _buildGoinsBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFEEF0FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _blue.withOpacity(0.2),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('🧰', style: TextStyle(fontSize: 16)),
          const SizedBox(width: 6),
          Text('Select materials for your project',
            style: GoogleFonts.nunito(
              fontSize: 12, fontWeight: FontWeight.w700, color: _muted)),
        ],
      ),
    );
  }

  // ─── Suggest a material not in this list ──────────────────────────────
  Widget _buildSuggestLink() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
      child: TextButton.icon(
        onPressed: _showSuggestMaterialDialog,
        icon: const Icon(Icons.add_circle_outline, size: 16, color: _blue),
        label: Text("Can't find it? Suggest a material",
            style: GoogleFonts.nunito(
                fontSize: 12, fontWeight: FontWeight.w700, color: _blue)),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }

  Future<void> _showSuggestMaterialDialog() async {
    final nameCtrl = TextEditingController();
    final rateCtrl = TextEditingController();
    bool sending = false;
    String? error;

    await showDialog(
      context: context,
      builder: (dlgCtx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text('Suggest a Material',
              style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("What material couldn't you find?",
                  style: GoogleFonts.nunito(fontSize: 12, color: _muted)),
              const SizedBox(height: 10),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Material name',
                  hintText: 'e.g. Copper foil tape',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: rateCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Suggested Goins rate (optional)',
                  hintText: 'e.g. 10',
                  border: OutlineInputBorder(),
                ),
              ),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(error!, style: GoogleFonts.nunito(color: _red, fontSize: 12)),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: sending ? null : () => Navigator.of(dlgCtx).pop(),
              child: Text('Cancel', style: GoogleFonts.nunito()),
            ),
            ElevatedButton(
              onPressed: sending
                  ? null
                  : () async {
                      final name = nameCtrl.text.trim();
                      if (name.length < 3) {
                        setDlg(() => error = 'Please enter at least 3 characters');
                        return;
                      }
                      setDlg(() { sending = true; error = null; });
                      try {
                        final ok = await MiniguruApi().suggestMaterial(
                          suggestion: name,
                          category: 'custom_material_request',
                          requestedGoinsPrice: int.tryParse(rateCtrl.text.trim()),
                        );
                        if (dlgCtx.mounted) Navigator.of(dlgCtx).pop();
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text(ok
                                ? "Thanks! We'll take a look and may add it soon."
                                : 'Could not send your suggestion — try again later.'),
                            backgroundColor: ok ? _green : _red,
                          ));
                        }
                      } catch (_) {
                        setDlg(() { sending = false; error = 'Something went wrong — try again.'; });
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: _blue),
              child: sending
                  ? const SizedBox(width: 16, height: 16,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text('Send', style: GoogleFonts.nunito(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
    nameCtrl.dispose();
    rateCtrl.dispose();
  }

  // ─── Shortfall banner — informational only (Aug 2026) ────────
  // No button here anymore: the debt record is created automatically,
  // server-side, at video upload — not via a manual pre-request during
  // local planning. This just lets the child see it coming.
  Widget _buildShortfallBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E6),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _amber.withOpacity(0.4)),
      ),
      child: Row(
        children: [
          const Text('🪙', style: TextStyle(fontSize: 20)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'This uses $_shortfall more Goins than you have',
                  style: GoogleFonts.nunito(
                      color: _ink, fontSize: 12, fontWeight: FontWeight.w800),
                ),
                Text(
                  'That\'s okay — keep going. You\'ll go into debt for it, paid back as you earn more Goins.',
                  style: GoogleFonts.nunito(
                      color: _muted, fontSize: 10, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearch() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: TextField(
        onChanged: (v) { _searchQuery = v; _applyFilter(); },
        style: GoogleFonts.nunito(color: _ink, fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Search materials...',
          hintStyle: GoogleFonts.nunito(color: _muted, fontSize: 14),
          prefixIcon: const Icon(Icons.search, color: _muted, size: 18),
          filled: true,
          fillColor: _card,
          contentPadding: const EdgeInsets.symmetric(vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _blue, width: 1.5),
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryRow() {
    final all = [
      MaterialCategory(id: 'all', name: 'All', emoji: '🌟'),
      ..._categories,
    ];
    return SizedBox(
      height: 40,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: all.length,
        itemBuilder: (_, i) {
          final cat    = all[i];
          final active = _activeCategoryId == cat.id;
          return GestureDetector(
            onTap: () => _setCategory(cat.id),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: active ? _blue : _card,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color: active ? _blue : _border),
              ),
              child: Text(
                '${cat.emoji} ${cat.name}',
                style: GoogleFonts.nunito(
                  color: active ? Colors.white : _muted,
                  fontSize: 12,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildLoader() =>
      const Center(child: CircularProgressIndicator(color: _blue));

  Widget _buildMaterialGrid() {
    if (_filtered.isEmpty) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('🔍', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 10),
          Text('No materials found',
              style: GoogleFonts.nunito(color: _muted, fontSize: 14)),
        ]),
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        mainAxisExtent: 195.0, // portrait — image + name + qty all fit cleanly
      ),
      itemCount: _filtered.length,
      itemBuilder: (_, i) => _buildMaterialCard(_filtered[i]),
    );
  }

  Widget _buildMaterialCard(MaterialItem mat) {
    final qty      = _quantities[mat.id] ?? 0;
    final selected = qty > 0;
    final hasImage = mat.imageUrl != null && mat.imageUrl!.isNotEmpty;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: selected ? const Color(0xFFEEF0FF) : _card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: selected ? _blue : _border,
          width: selected ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [

          // ── Image area ─────────────────────────────────────────────────────
          ClipRRect(
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(13)),
            child: Container(
              height: 100,
              width: double.infinity,
              color: const Color(0xFFF8F9FF),
              child: hasImage
                  ? Image.network(
                      mat.imageUrl!,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Center(
                        child: Text('📦', style: TextStyle(fontSize: 36)),
                      ),
                    )
                  : const Center(
                      child: Text('📦', style: TextStyle(fontSize: 36)),
                    ),
            ),
          ),

          // ── Info area ──────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 6, 8, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [

                // Name + Goins badge
                Row(children: [
                  Expanded(
                    child: Text(mat.name,
                        style: GoogleFonts.nunito(
                            color: _ink,
                            fontSize: 11,
                            fontWeight: FontWeight.w800),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                  ),
                  const SizedBox(width: 4),

                ]),

                // Unit
                Text('/${mat.unit}',
                    style: GoogleFonts.nunito(
                        color: _muted, fontSize: 9)),

                const SizedBox(height: 6),

                // Qty controls + running cost
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const SizedBox(width: 0),
                    Row(children: [
                      _qtyButton(Icons.remove,
                          () => _setQty(mat.id, -1),
                          enabled: qty > 0),
                      Padding(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 6),
                        child: Text('$qty',
                            style: GoogleFonts.nunito(
                                color: _ink,
                                fontSize: 14,
                                fontWeight: FontWeight.bold)),
                      ),
                      _qtyButton(Icons.add,
                          () => _setQty(mat.id, 1),
                          enabled: true),
                    ]),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _qtyButton(IconData icon, VoidCallback onTap,
      {bool enabled = true}) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 26, height: 26,
        decoration: BoxDecoration(
          color: enabled ? _blue.withOpacity(0.12) : _border,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
              color: enabled ? _blue.withOpacity(0.3) : _border),
        ),
        child: Icon(icon,
            size: 14, color: enabled ? _blue : _muted),
      ),
    );
  }

  Widget _buildConfirmBar() {
    final count = _pickedList.length;
    // Kept purely as a color cue for the total (red = over budget) — no
    // longer disables anything, since Confirm always works now.
    final overBudget = _overBudget;
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        decoration: const BoxDecoration(
          color: _card,
          border: Border(top: BorderSide(color: _border)),
        ),
        child: Row(children: [
          // Summary
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  count == 0
                      ? 'No materials selected'
                      : '$count material${count > 1 ? 's' : ''} selected',
                  style: GoogleFonts.nunito(
                      color: _muted, fontSize: 12, fontWeight: FontWeight.w600),
                ),
                if (_totalGoins > 0)
                  Text(
                    'Total: $_totalGoins Goins',
                    style: GoogleFonts.nunito(
                        color: overBudget ? _red : _amber,
                        fontSize: 13,
                        fontWeight: FontWeight.bold),
                  ),
              ],
            ),
          ),
          // Clear
          if (count > 0) ...[
            GestureDetector(
              onTap: () => setState(() {
                _quantities.clear();
              }),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEEEE),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _red.withOpacity(0.3)),
                ),
                child: Text('Clear',
                    style: GoogleFonts.nunito(
                        fontWeight: FontWeight.w900,
                        color: _red,
                        fontSize: 13)),
              ),
            ),
          ],
          // Confirm — always enabled now (Aug 2026 behavior change)
          GestureDetector(
            onTap: _confirm,
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: _blue,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.check_rounded, color: Colors.white, size: 16),
                const SizedBox(width: 6),
                Text(
                  'Confirm',
                  style: GoogleFonts.nunito(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}