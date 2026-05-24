// lib/widgets/material_picker_widget.dart
// Full-screen Material Picker for children to select STEM materials
// Light theme — white background, clean cards, proper image sizing

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/models/MaterialItem.dart';
import 'package:miniguru/repository/GoinsRepository.dart';

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
  void _confirm() {
    if (_overBudget) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Not enough Goins! Remove some materials.',
            style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
        backgroundColor: _red,
      ));
      return;
    }
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
          _buildSearch(),
          _buildCategoryRow(),
          Expanded(child: _loading ? _buildLoader() : _buildMaterialGrid()),
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
        color: _overBudget
            ? const Color(0xFFFFEEEE)
            : const Color(0xFFEEF0FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _overBudget
              ? _red.withOpacity(0.3)
              : _blue.withOpacity(0.2),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _goinsStat('💰 Balance', '${widget.currentGoinsBalance} G', _muted),
          _goinsStat('🧰 Cost', '-$_totalGoins G',
              _totalGoins > 0 ? _amber : _muted),
          _goinsStat(
            _overBudget ? '⛔ Short' : '✅ After',
            '${_remainingBalance} G',
            _overBudget ? _red : _green,
          ),
        ],
      ),
    );
  }

  Widget _goinsStat(String label, String value, Color valueColor) {
    return Column(crossAxisAlignment: CrossAxisAlignment.center, children: [
      Text(label,
          style: GoogleFonts.nunito(
              color: _muted, fontSize: 10, fontWeight: FontWeight.w500)),
      const SizedBox(height: 2),
      Text(value,
          style: GoogleFonts.nunito(
              color: valueColor, fontSize: 14, fontWeight: FontWeight.bold)),
    ]);
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
        childAspectRatio: 0.78, // portrait — image + name + qty all fit cleanly
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
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF3CC),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('${mat.goinsPerUnit}G',
                        style: GoogleFonts.nunito(
                            color: _amber,
                            fontSize: 9,
                            fontWeight: FontWeight.w900)),
                  ),
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
                    Text(
                      qty > 0 ? '${mat.goinsPerUnit * qty}G' : '',
                      style: GoogleFonts.nunito(
                          color: _green,
                          fontSize: 10,
                          fontWeight: FontWeight.w700),
                    ),
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
                          enabled: !_overBudget || qty > 0),
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
                        color: _overBudget ? _red : _amber,
                        fontSize: 13,
                        fontWeight: FontWeight.bold),
                  ),
              ],
            ),
          ),
          // Clear
          if (count > 0) ...[
            GestureDetector(
              onTap: () => setState(() => _quantities.clear()),
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
          // Confirm
          GestureDetector(
            onTap: _confirm,
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: _overBudget ? _red : _blue,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(
                  _overBudget
                      ? Icons.warning_rounded
                      : Icons.check_rounded,
                  color: Colors.white,
                  size: 16,
                ),
                const SizedBox(width: 6),
                Text(
                  _overBudget ? 'Over Budget' : 'Confirm',
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