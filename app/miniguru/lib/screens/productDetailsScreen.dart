import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:miniguru/models/Product.dart';
import 'package:miniguru/repository/cartRepository.dart';
import 'package:miniguru/secrets.dart';

const _ink    = Color(0xFF1A1A2E);
const _accent = Color(0xFF5B6EF5);
const _cream  = Color(0xFFFFFBF2);
const _muted  = Color(0xFF6B6B8A);

class ProductDetailsPage extends StatefulWidget {
  final Product product;
  final Color backgroundColor;
  const ProductDetailsPage({
    super.key,
    required this.product,
    required this.backgroundColor,
  });
  @override
  State<ProductDetailsPage> createState() => _ProductDetailsPageState();
}

class _ProductDetailsPageState extends State<ProductDetailsPage> {
  int _cartQuantity = 0;
  int _imageIndex   = 0;
  final CartRepository _cartRepo = CartRepository();
  final PageController _pageCtrl = PageController();
  Product? _full;
  bool _loadingFull = true;

  @override
  void initState() {
    super.initState();
    _initCart();
    _fetchFull();
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  Future<void> _initCart() async {
    final q = await _cartRepo.getItemsQuantity(widget.product.id);
    if (mounted) setState(() => _cartQuantity = q);
  }

  Future<void> _fetchFull() async {
    try {
      final res = await http.get(Uri.parse('$apiBaseUrl/products/${widget.product.id}'));
      if (res.statusCode == 200) {
        if (mounted) setState(() {
          _full = Product.fromJsonRemote(jsonDecode(res.body));
          _loadingFull = false;
        });
      } else {
        if (mounted) setState(() { _full = widget.product; _loadingFull = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _full = widget.product; _loadingFull = false; });
    }
  }

  void _add() async {
    final p = _full ?? widget.product;
    if (_cartQuantity < p.inventory) {
      await _cartRepo.addToCart(p.id, p.name, p.price);
      if (mounted) setState(() => _cartQuantity++);
    }
  }

  void _remove() async {
    if (_cartQuantity > 0) {
      await _cartRepo.removeFromCart(widget.product.id);
      if (mounted) setState(() => _cartQuantity--);
    }
  }

  String _imgUrl(String raw) {
    if (raw.isEmpty) return '';
    if (raw.startsWith('http')) return raw;
    return '$apiBaseUrl/$raw';
  }

  @override
  Widget build(BuildContext context) {
    final p = _full ?? widget.product;
    final imgs = p.imageList.isNotEmpty ? p.imageList
        : (p.images.isNotEmpty ? [p.images] : <String>[]);
    return Scaffold(
      backgroundColor: _cream,
      body: Stack(children: [
        CustomScrollView(slivers: [
          _buildImageSliver(imgs),
          SliverToBoxAdapter(child: _buildBody(p)),
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ]),
        _buildBottomBar(p),
      ]),
    );
  }

  Widget _buildImageSliver(List<String> imgs) {
    return SliverAppBar(
      expandedHeight: 380,
      pinned: true,
      backgroundColor: Colors.white,
      iconTheme: const IconThemeData(color: _ink),
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(children: [
          imgs.isEmpty
              ? Container(
                  color: const Color(0xFFEEEEFF),
                  child: const Center(child: Icon(Icons.inventory_2_outlined, size: 80, color: Color(0xFFBBBBDD))))
              : PageView.builder(
                  controller: _pageCtrl,
                  itemCount: imgs.length,
                  onPageChanged: (i) => setState(() => _imageIndex = i),
                  itemBuilder: (_, i) {
                    final url = _imgUrl(imgs[i]);
                    return url.isEmpty
                        ? Container(color: const Color(0xFFEEEEFF))
                        : InteractiveViewer(
                            minScale: 0.5,
                            maxScale: 4.0,
                            child: Container(
                              color: Colors.white,
                              child: Image.network(url, fit: BoxFit.contain,
                                  errorBuilder: (_, __, ___) => Container(
                                      color: const Color(0xFFEEEEFF),
                                      child: const Icon(Icons.broken_image_outlined, size: 60, color: Color(0xFFBBBBDD))))));
                  }),
          if (imgs.length > 1)
            Positioned(
              bottom: 12, left: 0, right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(imgs.length, (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: _imageIndex == i ? 20 : 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: _imageIndex == i ? _accent : Colors.white60,
                    borderRadius: BorderRadius.circular(4),
                  ),
                )),
              ),
            ),
          if (imgs.length > 1)
            Positioned(
              bottom: 36, right: 12,
              child: Column(
                children: List.generate(imgs.length, (i) => GestureDetector(
                  onTap: () => _pageCtrl.animateToPage(i,
                      duration: const Duration(milliseconds: 250), curve: Curves.easeInOut),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: _imageIndex == i ? _accent : Colors.white, width: 2),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 4)],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Image.network(_imgUrl(imgs[i]), fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => Container(color: const Color(0xFFEEEEFF))),
                    ),
                  ),
                )),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _buildBody(Product p) {
    return Container(
      decoration: const BoxDecoration(
        color: _cream,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Text(p.name,
              style: GoogleFonts.nunito(fontSize: 22, fontWeight: FontWeight.w900, color: _ink))),
          const SizedBox(width: 12),
          Text('Rs.${p.price.toStringAsFixed(0)}',
              style: GoogleFonts.nunito(fontSize: 24, fontWeight: FontWeight.w900, color: _accent)),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 8, children: [
          _chip(Icons.category_outlined, p.category),
          if (p.brand != null && p.brand!.isNotEmpty) _chip(Icons.business_outlined, p.brand!),
          if (p.size != null && p.size!.isNotEmpty) _chip(Icons.straighten_outlined, p.size!),
          _chip(
            p.inventory > 0 ? Icons.check_circle_outline : Icons.cancel_outlined,
            p.inventory > 0 ? 'In Stock (${p.inventory})' : 'Out of Stock',
            color: p.inventory > 0 ? Colors.green[700]! : Colors.red,
          ),
        ]),
        const SizedBox(height: 20),
        _section('Description', p.description),
        if (!_loadingFull && p.howToUse != null && p.howToUse!.isNotEmpty) ...[
          const SizedBox(height: 16),
          _section('How to Use', p.howToUse!),
        ],
        if (_loadingFull) ...[
          const SizedBox(height: 16),
          const Center(child: CircularProgressIndicator(color: _accent, strokeWidth: 2)),
        ],
        const SizedBox(height: 16),
        _infoTable(p),
      ]),
    );
  }

  Widget _chip(IconData icon, String label, {Color color = _muted}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE0E0F0)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 4),
        Text(label, style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
      ]),
    );
  }

  Widget _section(String title, String body) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: GoogleFonts.nunito(fontSize: 15, fontWeight: FontWeight.w900, color: _ink)),
      const SizedBox(height: 6),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE8E8F8)),
        ),
        child: Text(body, style: GoogleFonts.nunito(fontSize: 14, color: _muted, height: 1.6)),
      ),
    ]);
  }

  Widget _infoTable(Product p) {
    final rows = <_Row>[
      _Row('Category', p.category),
      if (p.brand != null && p.brand!.isNotEmpty) _Row('Brand', p.brand!),
      if (p.size != null && p.size!.isNotEmpty) _Row('Size', p.size!),
      _Row('Price', 'Rs.${p.price.toStringAsFixed(2)}'),
      _Row('Stock', p.inventory > 0 ? '${p.inventory} units' : 'Out of stock'),
    ];
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE8E8F8)),
      ),
      child: Column(
        children: rows.asMap().entries.map((e) => Container(
          decoration: BoxDecoration(
            border: e.key < rows.length - 1
                ? const Border(bottom: BorderSide(color: Color(0xFFEEEEF8)))
                : null,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(children: [
            SizedBox(width: 100,
                child: Text(e.value.l, style: GoogleFonts.nunito(
                    fontSize: 13, fontWeight: FontWeight.w700, color: _ink))),
            Expanded(child: Text(e.value.v,
                style: GoogleFonts.nunito(fontSize: 13, color: _muted))),
          ]),
        )).toList(),
      ),
    );
  }

  Widget _buildBottomBar(Product p) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 16, offset: const Offset(0, -4))],
        ),
        child: Row(children: [
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE0E0F0)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              IconButton(
                icon: const Icon(Icons.remove_rounded, size: 18),
                onPressed: _cartQuantity > 0 ? _remove : null,
                color: _cartQuantity > 0 ? _accent : Colors.grey[300],
              ),
              Text('$_cartQuantity', style: GoogleFonts.nunito(
                  fontSize: 16, fontWeight: FontWeight.w900, color: _ink)),
              IconButton(
                icon: const Icon(Icons.add_rounded, size: 18),
                onPressed: p.inventory > _cartQuantity ? _add : null,
                color: p.inventory > _cartQuantity ? _accent : Colors.grey[300],
              ),
            ]),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: p.inventory > _cartQuantity ? () {
                _add();
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text('Added to cart',
                      style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
                  backgroundColor: _accent,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ));
              } : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: _accent,
                disabledBackgroundColor: Colors.grey[200],
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                _cartQuantity > 0 ? 'In Cart ($_cartQuantity) - Add More' : 'Add to Cart',
                style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _Row {
  final String l, v;
  _Row(this.l, this.v);
}