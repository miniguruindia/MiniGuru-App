import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/models/Product.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/repository/cartRepository.dart';
import 'package:miniguru/repository/productRepository.dart';
import 'package:miniguru/repository/userDataRepository.dart';
import 'package:miniguru/screens/deliveryAddressPage.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final CartRepository _cartRepository = CartRepository();
  final ProductRepository _productRepository = ProductRepository();
  final UserRepository _userRepository = UserRepository();

  List<Map<String, dynamic>> _cartItems = [];
  List<Product> _products = [];
  double _totalBill = 0.0;
  double _walletBalance = 0.0;
  bool _loading = true;

  static const _accent    = Color(0xFF5B6EF5);
  static const _bg        = Color(0xFFF5F7FF);
  static const _gold      = Color(0xFFE8A000);
  static const _goldLight = Color(0xFFFFF3CC);

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() => _loading = true);

    final cartItems = await _cartRepository.getCart();
    final products  = <Product>[];
    for (final item in cartItems) {
      final p = await _productRepository.getProductById(item['id']);
      if (p != null) products.add(p);
    }

    await _userRepository.fetchAndStoreUserData();
    final user = await _userRepository.getUserDataFromLocalDb();

    final total = cartItems.fold<double>(
        0, (sum, item) => sum + (item['price'] as num) * (item['quantity'] as int));

    setState(() {
      _cartItems     = cartItems;
      _products      = products;
      _totalBill     = total;
      _walletBalance = user?.walletBalance ?? 0.0;
      _loading       = false;
    });
  }

  bool get _hasSufficientBalance => _walletBalance >= _totalBill;

  void _removeItem(String productId) async {
    await _cartRepository.removeFromCart(productId);
    _loadAll();
  }

  void _updateQty(String productId, String name, double price, int delta) async {
    if (delta > 0) {
      await _cartRepository.addToCart(productId, name, price);
    } else {
      await _cartRepository.removeFromCart(productId);
    }
    _loadAll();
  }

  void _checkout() {
    if (_cartItems.isEmpty) {
      _snack('Add items to cart first!', Colors.red);
      return;
    }
    if (!_hasSufficientBalance) {
      _showInsufficientDialog();
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DeliveryAddressPage(
          cartItems: _cartItems,
          totalBill: _totalBill,
          cartRepository: _cartRepository,
        ),
      ),
    ).then((_) => _loadAll());
  }

  void _snack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: GoogleFonts.nunito(color: Colors.white)),
      backgroundColor: color,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  void _showInsufficientDialog() {
    final shortfall = _totalBill - _walletBalance;
    showDialog(
      context: context,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.account_balance_wallet_outlined,
                  color: Colors.orange, size: 40),
            ),
            const SizedBox(height: 16),
            Text('Not enough balance!',
                style: GoogleFonts.nunito(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF1A1A2E))),
            const SizedBox(height: 10),
            Text(
              'Your wallet has ₹${_walletBalance.toStringAsFixed(2)} but this order costs ₹${_totalBill.toStringAsFixed(2)}.\n\nYou need ₹${shortfall.toStringAsFixed(2)} more.',
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                  fontSize: 14,
                  color: const Color(0xFF6B6B8A),
                  height: 1.5),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _goldLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                const Text('👨‍👩‍👧', style: TextStyle(fontSize: 20)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Ask a parent or guardian to top up your wallet.',
                    style: GoogleFonts.nunito(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF8B6800)),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _accent,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Got it',
                    style: GoogleFonts.nunito(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Colors.white)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Color(0xFF1A1A2E), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('My Cart',
            style: GoogleFonts.nunito(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF1A1A2E))),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _accent))
          : _cartItems.isEmpty
              ? _buildEmptyCart()
              : Column(children: [
                  _buildWalletBanner(),
                  Expanded(child: _buildCartList()),
                  _buildBottomBar(),
                ]),
    );
  }

  // ── Wallet balance strip ──────────────────────────────────────────────────
  Widget _buildWalletBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: _hasSufficientBalance
            ? const Color(0xFFE8F5E9)
            : _goldLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _hasSufficientBalance
              ? const Color(0xFF10B981).withOpacity(0.4)
              : _gold.withOpacity(0.4),
        ),
      ),
      child: Row(children: [
        Icon(
          Icons.account_balance_wallet_outlined,
          color: _hasSufficientBalance ? const Color(0xFF10B981) : _gold,
          size: 22,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Wallet Balance',
                style: GoogleFonts.nunito(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF6B6B8A))),
            Text('₹${_walletBalance.toStringAsFixed(2)}',
                style: GoogleFonts.nunito(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: _hasSufficientBalance
                        ? const Color(0xFF065F46)
                        : const Color(0xFF8B6800))),
          ]),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: _hasSufficientBalance
                ? const Color(0xFFD4F5EE)
                : _goldLight,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: _hasSufficientBalance
                  ? const Color(0xFF10B981).withOpacity(0.5)
                  : _gold.withOpacity(0.5),
            ),
          ),
          child: Text(
            _hasSufficientBalance ? '✓ Sufficient' : 'Low balance',
            style: GoogleFonts.nunito(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: _hasSufficientBalance
                    ? const Color(0xFF10B981)
                    : _gold),
          ),
        ),
      ]),
    );
  }

  // ── Cart list ─────────────────────────────────────────────────────────────
  Widget _buildCartList() {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      itemCount: _cartItems.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, index) {
        if (index >= _products.length) return const SizedBox.shrink();
        final item    = _cartItems[index];
        final product = _products[index];
        final qty     = item['quantity'] as int;

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: _accent.withOpacity(0.06),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  product.images,
                  width: 72, height: 72,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 72, height: 72,
                    color: const Color(0xFFE8EAFF),
                    child: const Icon(Icons.image_outlined, color: _accent),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product.name,
                        style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF1A1A2E)),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text('₹${product.price} each',
                        style: GoogleFonts.nunito(
                            fontSize: 12,
                            color: const Color(0xFF6B6B8A))),
                    const SizedBox(height: 8),
                    Row(children: [
                      _qtyBtn(
                        icon: qty == 1 ? Icons.delete_outline : Icons.remove,
                        color: qty == 1 ? Colors.red : _accent,
                        onTap: () => qty == 1
                            ? _removeItem(item['id'])
                            : _updateQty(item['id'], product.name, product.price, -1),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Text('$qty',
                            style: GoogleFonts.nunito(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF1A1A2E))),
                      ),
                      _qtyBtn(
                        icon: Icons.add,
                        color: _accent,
                        onTap: () => _updateQty(
                            item['id'], product.name, product.price, 1),
                      ),
                    ]),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text('₹${(product.price * qty).toStringAsFixed(0)}',
                  style: GoogleFonts.nunito(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: _accent)),
            ]),
          ),
        );
      },
    );
  }

  Widget _qtyBtn({required IconData icon, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30, height: 30,
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 16, color: color),
      ),
    );
  }

  // ── Bottom checkout bar ───────────────────────────────────────────────────
  Widget _buildBottomBar() {
    final itemCount = _cartItems.fold<int>(0, (s, i) => s + (i['quantity'] as int));
    final canCheckout = _hasSufficientBalance && _cartItems.isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('$itemCount item${itemCount == 1 ? '' : 's'}',
                style: GoogleFonts.nunito(
                    fontSize: 13,
                    color: const Color(0xFF6B6B8A),
                    fontWeight: FontWeight.w600)),
            Text('₹${_totalBill.toStringAsFixed(2)}',
                style: GoogleFonts.nunito(
                    fontSize: 13,
                    color: const Color(0xFF6B6B8A),
                    fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 8),
          const Divider(color: Color(0xFFE8EAFF)),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('Total',
                style: GoogleFonts.nunito(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF1A1A2E))),
            Text('₹${_totalBill.toStringAsFixed(2)}',
                style: GoogleFonts.nunito(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: canCheckout ? _accent : Colors.red)),
          ]),

          // Ask parent message when balance is low
          if (!_hasSufficientBalance) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _goldLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _gold.withOpacity(0.4)),
              ),
              child: Row(children: [
                const Text('👨‍👩‍👧', style: TextStyle(fontSize: 18)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Ask a parent to top up ₹${(_totalBill - _walletBalance).toStringAsFixed(2)} more to your wallet.',
                    style: GoogleFonts.nunito(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF8B6800)),
                  ),
                ),
              ]),
            ),
          ],

          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _checkout,
              style: ElevatedButton.styleFrom(
                backgroundColor: canCheckout
                    ? _accent
                    : const Color(0xFFB0B8D0),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(
                  canCheckout
                      ? Icons.local_shipping_outlined
                      : Icons.account_balance_wallet_outlined,
                  color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Text(
                  canCheckout
                      ? 'Proceed to Checkout'
                      : 'Insufficient Balance',
                  style: GoogleFonts.nunito(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Colors.white)),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  Widget _buildEmptyCart() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: _accent.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.shopping_cart_outlined,
                size: 56, color: _accent),
          ),
          const SizedBox(height: 20),
          Text('Your cart is empty',
              style: GoogleFonts.nunito(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1A1A2E))),
          const SizedBox(height: 8),
          Text('Add some products to get started!',
              style: GoogleFonts.nunito(
                  fontSize: 14, color: const Color(0xFF6B6B8A))),
          const SizedBox(height: 28),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: _accent,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: Text('Browse Shop',
                style: GoogleFonts.nunito(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Colors.white)),
          ),
        ],
      ),
    );
  }
}