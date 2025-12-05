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

class _ShopState extends State<Shop> {
  List<Product> _products = [];
  List<Product> _allProducts = []; // Store all products initially
  List<ProductCategory> _productCategories = [];
  bool _loading = true;

  final CartRepository _cartRepository = CartRepository();
  int _cartItemCount = 0;

  final Set<String> _selectedCategories = {}; // Track selected categories

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    ProductRepository repo = ProductRepository();
    await repo.fetchAndStoreProducts();
    await repo.fetchAndStoreProductCategories();
    List<Product> products = await repo.getProducts();
    List<ProductCategory> categories = await repo.getProductCategories();
    setState(() {
      _productCategories = categories;
      _products = products;
      _allProducts = products; // Keep all products for filtering
      _loading = false;
    });
  }

  Future<void> _loadCartItemCount() async {
    List<Map<String, dynamic>> items = await _cartRepository.getCart();
    setState(() {
      _cartItemCount = items.fold(
          0,
          (previousValue, element) =>
              previousValue + (element['quantity'] as int));
    });
  }

  void _filterProducts() {
    setState(() {
      if (_selectedCategories.isEmpty) {
        _products = List.from(
            _allProducts); // Reset to all products if no categories are selected
      } else {
        _products = _allProducts
            .where((product) => _selectedCategories.contains(product.category))
            .toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    _loadCartItemCount(); // You might want to move this to a more suitable place to avoid frequent calls
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Shop",
          style: headingTextStyle.copyWith(
            fontWeight: FontWeight.bold,
            fontSize: 24,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
        actions: [
          // IconButton for Previous Orders
          IconButton(
            icon: const Icon(Icons.shopping_bag_outlined),
            onPressed: () {
              // Navigate to Previous Orders page
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const OrdersScreen(),
                ),
              );
            },
          ),
          // IconButton for Cart with Badge
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_cart_outlined),
                onPressed: () {
                  // Navigate to Cart page
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const CartScreen(),
                    ),
                  );
                },
              ),
              if (_cartItemCount > 0)
                Positioned(
                  right: 4,
                  top: 4,
                  child: Badge.count(
                    count: _cartItemCount,
                    backgroundColor: Colors.red,
                    textStyle: const TextStyle(color: Colors.white),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        "Categories",
                        style: headingTextStyle,
                      ),
                    ),
                    _buildFilterIcons(),
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        "Products",
                        style: headingTextStyle,
                      ),
                    ),
                    _buildSearchBar(),
                    Expanded(child: _buildProductGrid()),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildFilterIcons() {
    List<Color> colors = [pastelBlue, pastelYellow, pastelRed, pastelGreen];
    List<Color> fontColors = [
      pastelBlueText,
      pastelYellowText,
      pastelRedText,
      pastelGreenText
    ];
    return SizedBox(
      height: 120,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: _productCategories.length,
        itemBuilder: (context, index) {
          final category = _productCategories[index];
          final isSelected =
              _selectedCategories.contains(category.name); // Check if selected

          return GestureDetector(
            onTap: () {
              setState(() {
                if (isSelected) {
                  _selectedCategories
                      .remove(category.name); // Remove if already selected
                } else {
                  _selectedCategories
                      .add(category.name); // Add to selected list
                }
                _filterProducts(); // Apply filter
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isSelected
                            ? Colors.black
                            : Colors.transparent, // Black border if selected
                        width: 3.0,
                      ),
                    ),
                    child: CircleAvatar(
                      backgroundColor: colors[index % colors.length],
                      radius: 35,
                      child: Icon(category.icon, size: 32),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    category.name,
                    style: bodyTextStyle.copyWith(
                        color: fontColors[index % colors.length], fontSize: 11),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: TextField(
        decoration: InputDecoration(
          labelText: 'Search Products',
          labelStyle: bodyTextStyle,
          border: const OutlineInputBorder(),
          prefixIcon: const Icon(Icons.search),
        ),
        onChanged: (query) {
          setState(() {
            if (query.isEmpty) {
              _filterProducts(); // Reset to filtered products if search is cleared
            } else {
              _products = _allProducts
                  .where((product) =>
                      product.name.toLowerCase().contains(query.toLowerCase()))
                  .toList();
            }
          });
        },
      ),
    );
  }

  Widget _buildProductGrid() {
    List<Color> colors = [pastelBlue, pastelYellow, pastelRed, pastelGreen];
    List<Color> fontColors = [
      pastelBlueText,
      pastelYellowText,
      pastelRedText,
      pastelGreenText
    ];

    return GridView.builder(
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.75,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: _products.length,
      itemBuilder: (context, index) {
        final product = _products[index];
        final color = colors[index % colors.length];
        final fontColor = fontColors[index % fontColors.length];

        return GestureDetector(
          onTap: () {
            // Navigate to Product Details page
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ProductDetailsPage(
                  product: product,
                  backgroundColor: fontColor,
                ),
              ),
            );
          },
          child: Card(
            color: color,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20.0),
            ),
            elevation: 6,
            shadowColor: Colors.black.withOpacity(0.2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(20.0)),
                      child: Image.network(
                        product.images,
                        fit: BoxFit.cover,
                        width: double.infinity,
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        style: headingTextStyle.copyWith(
                            color: Colors.black,
                            fontSize: 16,
                            fontWeight: FontWeight.bold),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4.0),
                      Text(
                        "₹${product.price}",
                        style: bodyTextStyle.copyWith(
                            color: Colors.grey[800], fontSize: 14),
                      ),
                      const SizedBox(height: 8.0),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8.0, vertical: 4.0),
                        decoration: BoxDecoration(
                          color: fontColor.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          product.category,
                          style: bodyTextStyle.copyWith(
                              color: Colors.black,
                              fontSize: 12,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
