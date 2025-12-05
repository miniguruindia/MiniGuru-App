import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/Product.dart';
import 'package:miniguru/models/ProductCategory.dart';
import 'package:miniguru/repository/cartRepository.dart';
import 'package:miniguru/repository/productRepository.dart';
import 'package:miniguru/screens/cartScreen.dart';
import 'package:miniguru/screens/orderScreen.dart';
import 'package:miniguru/screens/productDetailsScreen.dart';

class Shop extends StatefulWidget {
  const Shop({super.key});

  @override
  State<Shop> createState() => _ShopState();
}

class _ShopState extends State<Shop> with AutomaticKeepAliveClientMixin {
  List<Product> _products = [];
  List<Product> _allProducts = [];
  List<ProductCategory> _productCategories = [];
  bool _loading = true;

  final CartRepository _cartRepository = CartRepository();
  int _cartItemCount = 0;

  final Set<String> _selectedCategories = {};
  final _searchController = TextEditingController();

  static const _colors = [pastelBlue, pastelYellow, pastelRed, pastelGreen];
  static const _fontColors = [
    pastelBlueText,
    pastelYellowText,
    pastelRedText,
    pastelGreenText
  ];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    setState(() => _loading = true);

    try {
      final repo = ProductRepository();
      await Future.wait([
        repo.fetchAndStoreProducts(),
        repo.fetchAndStoreProductCategories(),
      ]);

      final products = await repo.getProducts();
      final categories = await repo.getProductCategories();

      if (mounted) {
        setState(() {
          _productCategories = categories;
          _products = products;
          _allProducts = List.from(products);
          _loading = false;
        });
        _loadCartItemCount();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error loading products: $e'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _loadCartItemCount() async {
    final items = await _cartRepository.getCart();
    if (mounted) {
      setState(() {
        _cartItemCount =
            items.fold(0, (sum, item) => sum + (item['quantity'] as int));
      });
    }
  }

  void _filterProducts() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _products = _allProducts.where((product) {
        final matchesCategory = _selectedCategories.isEmpty ||
            _selectedCategories.contains(product.category);
        final matchesQuery =
            query.isEmpty || product.name.toLowerCase().contains(query);
        return matchesCategory && matchesQuery;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Scaffold(
      backgroundColor: backgroundWhite,
      appBar: AppBar(
        title: Text('Shop', style: headingTextStyle.copyWith(fontSize: 24)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon:
                const Icon(Icons.shopping_bag_outlined, color: Colors.black54),
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const OrdersScreen()),
              );
              _loadCartItemCount();
            },
          ),
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_cart_outlined,
                    color: Colors.black54),
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const CartScreen()),
                  );
                  _loadCartItemCount();
                },
              ),
              if (_cartItemCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    constraints:
                        const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      _cartItemCount.toString(),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: pastelBlueText))
          : RefreshIndicator(
              onRefresh: _loadProducts,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(child: _buildCategorySection()),
                  SliverToBoxAdapter(child: _buildSearchBar()),
                  _buildProductGrid(),
                ],
              ),
            ),
    );
  }

  Widget _buildCategorySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text('Categories',
              style: headingTextStyle.copyWith(fontSize: 16)),
        ),
        SizedBox(
          height: 120,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _productCategories.length,
            itemBuilder: (context, index) {
              final category = _productCategories[index];
              final isSelected = _selectedCategories.contains(category.name);
              final color = _colors[index % _colors.length];
              final fontColor = _fontColors[index % _fontColors.length];

              return GestureDetector(
                onTap: () {
                  setState(() {
                    if (isSelected) {
                      _selectedCategories.remove(category.name);
                    } else {
                      _selectedCategories.add(category.name);
                    }
                    _filterProducts();
                  });
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Column(
                    children: [
                      Container(
                        width: 70,
                        height: 70,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: color,
                          border: Border.all(
                            color:
                                isSelected ? Colors.black : Colors.transparent,
                            width: 3,
                          ),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: color.withOpacity(0.4),
                                    spreadRadius: 2,
                                    blurRadius: 8,
                                  ),
                                ]
                              : null,
                        ),
                        child: Icon(category.icon,
                            size: 32, color: Colors.black87),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        category.name,
                        style: bodyTextStyle.copyWith(
                          fontSize: 11,
                          color: isSelected ? fontColor : Colors.black54,
                          fontWeight:
                              isSelected ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: TextField(
        controller: _searchController,
        decoration: InputDecoration(
          hintText: 'Search products...',
          hintStyle: bodyTextStyle.copyWith(color: Colors.grey[400]),
          prefixIcon: const Icon(Icons.search, color: Colors.grey),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey[300]!),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey[300]!),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: pastelBlueText),
          ),
          filled: true,
          fillColor: Colors.white,
        ),
        onChanged: (_) => _filterProducts(),
      ),
    );
  }

  Widget _buildProductGrid() {
    if (_products.isEmpty) {
      return SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.shopping_bag_outlined,
                  size: 64, color: Colors.grey[400]),
              const SizedBox(height: 16),
              Text(
                'No products found',
                style: headingTextStyle.copyWith(color: Colors.grey[600]),
              ),
              const SizedBox(height: 8),
              Text(
                'Try adjusting your filters',
                style: bodyTextStyle.copyWith(color: Colors.grey[500]),
              ),
            ],
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.all(16),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.7,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final product = _products[index];
            final color = _colors[index % _colors.length];
            final fontColor = _fontColors[index % _fontColors.length];

            return Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              child: InkWell(
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => ProductDetailsPage(
                        product: product,
                        backgroundColor: fontColor,
                      ),
                    ),
                  );
                  _loadCartItemCount();
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 3,
                        child: ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(16)),
                          child: Image.network(
                            product.images,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              color: Colors.grey[300],
                              child: const Icon(Icons.image, size: 40),
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    product.name,
                                    style:
                                        headingTextStyle.copyWith(fontSize: 14),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '₹${product.price}',
                                    style: bodyTextStyle.copyWith(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  product.category,
                                  style: bodyTextStyle.copyWith(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
          childCount: _products.length,
        ),
      ),
    );
  }
}
