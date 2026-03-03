// lib/widgets/material_picker_widget.dart
// Full-screen Material Picker for children to select STEM materials
// Shows categories, materials with goins cost, quantity selector, running total

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/models/MaterialItem.dart';
import 'package:miniguru/repository/GoinsRepository.dart';

// ─── Colours (matching MiniGuru palette) ─────────────────────────────────────
const _blue       = Color(0xFF3B82F6);
const _navy       = Color(0xFF1E3A8A);
const _green      = Color(0xFF10B981);
const _amber      = Color(0xFFF59E0B);
const _purple     = Color(0xFF8B5CF6);
const _red        = Color(0xFFEF4444);
const _bgDark     = Color(0xFF0F172A);
const _cardDark   = Color(0xFF1E293B);
const _cardLight  = Color(0xFF334155);

// ─── Public entry-point ───────────────────────────────────────────────────────
/// Show the material picker as a full-screen bottom sheet.
/// Returns the list of [PickedMaterial] the child confirmed, or null if cancelled.
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

  List<MaterialCategory> _categories = [];
  List<MaterialItem>     _allMaterials = [];
  List<MaterialItem>     _filtered = [];
  Map<String, int>       _quantities = {}; // materialId → quantity
  String                 _activeCategoryId = 'all';
  String                 _searchQuery = '';
  bool                   _loading = true;

  @override
  void initState() {
    super.initState();
    // Pre-fill existing selections
    for (final p in widget.existingPicked) {
      _quantities[p.item.id] = p.quantity;
    }
    _loadData();
  }

  Future<void> _loadData() async {
    final cats = await _repo.getMaterialCategories();
    final mats = await _repo.getMaterials();
    setState(() {
      _categories = cats;
      _allMaterials = mats;
      _filtered = mats;
      _loading = false;
    });
  }

  // ─── Derived values ──────────────────────────────────────
  int get _totalGoins {
    int total = 0;
    for (final mat in _allMaterials) {
      final qty = _quantities[mat.id] ?? 0;
      total += mat.goinsPerUnit * qty;
    }
    return total;
  }

  int get _remainingBalance => widget.currentGoinsBalance - _totalGoins;
  bool get _overBudget => _remainingBalance < 0;

  List<PickedMaterial> get _pickedList {
    return _allMaterials
        .where((m) => (_quantities[m.id] ?? 0) > 0)
        .map((m) => PickedMaterial(item: m, quantity: _quantities[m.id]!))
        .toList();
  }

  // ─── Filter ──────────────────────────────────────────────
  void _applyFilter() {
    setState(() {
      _filtered = _allMaterials.where((m) {
        final matchCat = _activeCategoryId == 'all' || m.categoryId == _activeCategoryId;
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
      final newQty = (current + delta).clamp(0, 99);
      if (newQty == 0) {
        _quantities.remove(materialId);
      } else {
        _quantities[materialId] = newQty;
      }
    });
  }

  // ─── Confirm ─────────────────────────────────────────────
  void _confirm() {
    if (_overBudget) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Not enough Goins! Remove some materials.',
            style: GoogleFonts.poppins(),
          ),
          backgroundColor: _red,
        ),
      );
      return;
    }
    Navigator.of(context).pop(_pickedList);
  }

  // ─── Build ───────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.of(context).size.height;

    return Container(
      height: screenH * 0.92,
      decoration: const BoxDecoration(
        color: _bgDark,
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
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
      );

  Widget _buildHeader() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Row(
          children: [
            const Text('🧰', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Pick Your Materials',
                style: GoogleFonts.poppins(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            GestureDetector(
              onTap: () => Navigator.of(context).pop(null),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: _cardDark,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.close, color: Colors.white60, size: 18),
              ),
            ),
          ],
        ),
      );

  Widget _buildGoinsBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: _overBudget ? _red.withOpacity(0.15) : _navy.withOpacity(0.6),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _overBudget ? _red.withOpacity(0.5) : _blue.withOpacity(0.3),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _goinsStat(
            '💰 Balance',
            '${widget.currentGoinsBalance} G',
            Colors.white70,
          ),
          _goinsStat(
            '🧰 Cost',
            '-$_totalGoins G',
            _totalGoins > 0 ? _amber : Colors.white38,
          ),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(label,
            style: GoogleFonts.poppins(
                color: Colors.white38, fontSize: 10, fontWeight: FontWeight.w500)),
        const SizedBox(height: 2),
        Text(value,
            style: GoogleFonts.poppins(
                color: valueColor, fontSize: 14, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildSearch() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: TextField(
        onChanged: (v) {
          _searchQuery = v;
          _applyFilter();
        },
        style: GoogleFonts.poppins(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Search materials...',
          hintStyle: GoogleFonts.poppins(color: Colors.white38, fontSize: 14),
          prefixIcon: const Icon(Icons.search, color: Colors.white38, size: 18),
          filled: true,
          fillColor: _cardDark,
          contentPadding: const EdgeInsets.symmetric(vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
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
          final cat = all[i];
          final active = _activeCategoryId == cat.id;
          return GestureDetector(
            onTap: () => _setCategory(cat.id),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: active ? _blue : _cardDark,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: active ? _blue : Colors.transparent,
                ),
              ),
              child: Text(
                '${cat.emoji} ${cat.name}',
                style: GoogleFonts.poppins(
                  color: active ? Colors.white : Colors.white54,
                  fontSize: 12,
                  fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildLoader() => const Center(
        child: CircularProgressIndicator(color: _blue),
      );

  Widget _buildMaterialGrid() {
    if (_filtered.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🔍', style: TextStyle(fontSize: 40)),
            const SizedBox(height: 10),
            Text('No materials found',
                style: GoogleFonts.poppins(color: Colors.white38, fontSize: 14)),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.55,
      ),
      itemCount: _filtered.length,
      itemBuilder: (_, i) => _buildMaterialCard(_filtered[i]),
    );
  }

  Widget _buildMaterialCard(MaterialItem mat) {
    final qty = _quantities[mat.id] ?? 0;
    final selected = qty > 0;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: selected ? _blue.withOpacity(0.15) : _cardDark,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: selected ? _blue.withOpacity(0.7) : _cardLight.withOpacity(0.5),
          width: selected ? 1.5 : 1,
        ),
      ),
      padding: const EdgeInsets.all(10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name row
          Row(
            children: [
              Expanded(
                child: Text(
                  mat.name,
                  style: GoogleFonts.poppins(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // Goins cost badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: _amber.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${mat.goinsPerUnit}G',
                  style: GoogleFonts.poppins(
                      color: _amber, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            '/${mat.unit}',
            style: GoogleFonts.poppins(color: Colors.white38, fontSize: 10),
          ),
          const Spacer(),
          // Quantity controls
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Total cost for this item
              Text(
                qty > 0 ? '= ${mat.goinsPerUnit * qty}G' : '',
                style: GoogleFonts.poppins(
                    color: _green, fontSize: 10, fontWeight: FontWeight.w500),
              ),
              Row(
                children: [
                  _qtyButton(Icons.remove, () => _setQty(mat.id, -1),
                      enabled: qty > 0),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(
                      '$qty',
                      style: GoogleFonts.poppins(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                  _qtyButton(Icons.add, () => _setQty(mat.id, 1),
                      enabled: !_overBudget || qty > 0),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _qtyButton(IconData icon, VoidCallback onTap, {bool enabled = true}) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          color: enabled ? _blue.withOpacity(0.3) : Colors.white10,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          size: 14,
          color: enabled ? Colors.white : Colors.white24,
        ),
      ),
    );
  }

  Widget _buildConfirmBar() {
    final count = _pickedList.length;

    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        decoration: BoxDecoration(
          color: _cardDark,
          border: Border(top: BorderSide(color: Colors.white12)),
        ),
        child: Row(
          children: [
            // Summary
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    count == 0 ? 'No materials selected' : '$count material${count > 1 ? 's' : ''} selected',
                    style: GoogleFonts.poppins(
                        color: Colors.white60, fontSize: 12),
                  ),
                  if (_totalGoins > 0)
                    Text(
                      'Total: $_totalGoins Goins',
                      style: GoogleFonts.poppins(
                          color: _overBudget ? _red : _amber,
                          fontSize: 13,
                          fontWeight: FontWeight.bold),
                    ),
                ],
              ),
            ),
            // Clear button
            if (count > 0) ...[
              GestureDetector(
                onTap: () => setState(() => _quantities.clear()),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  margin: const EdgeInsets.only(right: 8),
                  decoration: BoxDecoration(
                    color: _red.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _red.withOpacity(0.3)),
                  ),
                  child: Text('Clear',
                      style: GoogleFonts.poppins(color: _red, fontSize: 13)),
                ),
              ),
            ],
            // Confirm button
            GestureDetector(
              onTap: _confirm,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: _overBudget ? _red : _blue,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _overBudget ? Icons.warning_rounded : Icons.check_rounded,
                      color: Colors.white,
                      size: 16,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _overBudget ? 'Over Budget' : 'Confirm',
                      style: GoogleFonts.poppins(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600),
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
}