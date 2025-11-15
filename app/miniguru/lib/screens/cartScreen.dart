import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
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

  final colors = [pastelBlue, pastelYellow, pastelGreen, pastelRed];

  List<Map<String, dynamic>> _cartItems = [];
  List<Product> _products = [];
  double _totalBill = 0.0;
  double _walletBalance = 0.0;

  @override
  void initState() {
    super.initState();
    _loadCartItems();
    _loadWalletBalance();
  }

  Future<void> _loadCartItems() async {
    // Fetch cart items
    List<Map<String, dynamic>> cartItems = await _cartRepository.getCart();

    // Fetch product details based on productId
    List<Product> productList = [];
    for (var item in cartItems) {
      Product? product = await _productRepository.getProductById(item['id']);
      if (product != null) {
        productList.add(product);
      }
    }

    // Calculate total bill
    double total = cartItems.fold(
        0.0,
        (previousValue, item) =>
            previousValue + (item['price'] * item['quantity']));

    setState(() {
      _cartItems = cartItems;
      _products = productList;
      _totalBill = total;
    });
  }

  Future<void> _loadWalletBalance() async {
    await _userRepository.fetchAndStoreUserData();
    User? user = await _userRepository.getUserDataFromLocalDb();
    setState(() {
      _walletBalance = user!.walletBalance;
    });
  }

  void _removeItemFromCart(String productId) async {
    await _cartRepository.removeFromCart(productId);
    _loadCartItems(); // Reload the cart items after removing one
  }

  void _checkout() {
    if (_totalBill > _walletBalance) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Insufficient balance in wallet!',
            style: TextStyle(color: Colors.red, fontSize: 16),
          ),
          backgroundColor: Colors.grey[200],
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      // Proceed with checkout logic
      if (_totalBill > 0) {
        // Navigate to delivery address page with cart data
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => DeliveryAddressPage(
              cartItems: _cartItems,
              totalBill: _totalBill,
              cartRepository: _cartRepository,
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red,
            content: Text(
              'Add items to the cart to checkout!',
              style: bodyTextStyle.copyWith(color: backgroundWhite),
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Your Cart",
          style: headingTextStyle.copyWith(
              fontSize: 24, fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: Column(
        children: [
          Expanded(
            child: _cartItems.isNotEmpty
                ? ListView.builder(
                    itemCount: _products.length,
                    itemBuilder: (context, index) {
                      final item = _cartItems[index];
                      final product = _products[index];
                      final color = colors[index % colors.length];

                      return Card(
                        color: color,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15),
                        ),
                        elevation: 5,
                        margin: const EdgeInsets.all(8),
                        child: ListTile(
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              product.images,
                              width: 60,
                              height: 60,
                              fit: BoxFit.cover,
                            ),
                          ),
                          title: Text(
                            product.name,
                            style: bodyTextStyle.copyWith(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                          subtitle: Text(
                            "₹${product.price} x ${item['quantity']}",
                            style: bodyTextStyle.copyWith(fontSize: 16),
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline,
                                color: Colors.red),
                            onPressed: () => _removeItemFromCart(item['id']),
                          ),
                        ),
                      );
                    },
                  )
                : const Center(
                    child: Text("Your cart is empty."),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                // Display Wallet Balance
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "Wallet Balance:",
                      style: headingTextStyle.copyWith(
                          fontSize: 18, fontWeight: FontWeight.w500),
                    ),
                    Text(
                      "₹${_walletBalance.toStringAsFixed(2)}",
                      style: headingTextStyle.copyWith(
                          fontSize: 18, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Total Bill Display
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "Total Bill:",
                      style: headingTextStyle.copyWith(
                          fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      "₹${_totalBill.toStringAsFixed(2)}",
                      style: headingTextStyle.copyWith(
                          fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                // Proceed to Checkout Button
                ElevatedButton(
                  onPressed: _checkout,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16.0),
                    shape: const StadiumBorder(),
                    backgroundColor:
                        _totalBill > _walletBalance ? Colors.grey : buttonBlack,
                  ),
                  child: Center(
                    child: Text(
                      _totalBill > _walletBalance
                          ? "Insufficient Balance"
                          : "Proceed to Checkout",
                      style: headingTextStyle.copyWith(
                        fontSize: 18,
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
