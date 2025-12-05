import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/Product.dart';
import 'package:miniguru/repository/cartRepository.dart';

class ProductDetailsPage extends StatefulWidget {
  final Product product;
  final Color backgroundColor;

  const ProductDetailsPage(
      {super.key, required this.product, required this.backgroundColor});

  @override
  State<ProductDetailsPage> createState() => _ProductDetailsPageState();
}

class _ProductDetailsPageState extends State<ProductDetailsPage> {
  int _cartQuantity = 0;
  final CartRepository _cartRepository = CartRepository();
  late Color _color;

  @override
  void initState() {
    super.initState();
    _initializeCart();
    _color = widget.backgroundColor;
  }

  Future<void> _initializeCart() async {
    int quantity = await _cartRepository.getItemsQuantity(widget.product.id);
    setState(() {
      _cartQuantity = quantity;
    });
  }

  void _addToCart() async {
    if (_cartQuantity < widget.product.inventory) {
      await _cartRepository.addToCart(
          widget.product.id, widget.product.name, widget.product.price);
      setState(() {
        _cartQuantity++;
      });
    }
  }

  void _removeFromCart() async {
    if (_cartQuantity > 0) {
      await _cartRepository.removeFromCart(widget.product.id);
      setState(() {
        _cartQuantity--;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.product.name,
          style: bodyTextStyle.copyWith(
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Product Image with rounded corners and shadow
                  Container(
                    height: 250,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(30),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 20,
                          spreadRadius: 5,
                          offset: const Offset(0, 10),
                        ),
                      ],
                      image: DecorationImage(
                        image: NetworkImage(widget.product.images),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Product Name
                  Text(
                    widget.product.name,
                    style: headingTextStyle.copyWith(
                        fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 10),
                  // Product Price
                  Text(
                    "₹${widget.product.price}",
                    style: bodyTextStyle.copyWith(
                        fontSize: 20, color: Colors.grey[700]),
                  ),
                  const SizedBox(height: 20),
                  // Product Category
                  Row(
                    children: [
                      Icon(Icons.category, color: Colors.grey[600]),
                      const SizedBox(width: 8),
                      Text(
                        "Category: ${widget.product.category}",
                        style: bodyTextStyle.copyWith(fontSize: 16),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Product Inventory
                  Row(
                    children: [
                      Icon(Icons.inventory, color: Colors.grey[600]),
                      const SizedBox(width: 8),
                      Text(
                        "In stock: ${widget.product.inventory}",
                        style: bodyTextStyle.copyWith(fontSize: 16),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  // Product Description
                  Text(
                    "Description",
                    style: headingTextStyle.copyWith(
                        fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    widget.product.description,
                    style: bodyTextStyle.copyWith(fontSize: 16),
                  ),
                ],
              ),
            ),
          ),
          // Floating Add to Cart Button with quantity controller
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(30),
                  topRight: Radius.circular(30),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.15),
                    blurRadius: 10,
                    spreadRadius: 5,
                    offset: const Offset(0, -5),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Quantity control
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove_circle_outline),
                        onPressed: _cartQuantity > 0 ? _removeFromCart : null,
                      ),
                      Text(
                        '$_cartQuantity',
                        style: headingTextStyle.copyWith(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: _addToCart,
                      ),
                    ],
                  ),
                  // Add to Cart button
                  ElevatedButton(
                    onPressed: () {
                      _addToCart();
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text("Added to cart"),
                      ));
                    },
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        vertical: 12,
                        horizontal: 24,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(30),
                      ),
                      backgroundColor: _color,
                    ),
                    child: Text(
                      _cartQuantity > 0
                          ? "In Cart ($_cartQuantity)"
                          : "Add to Cart",
                      style: bodyTextStyle.copyWith(color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
