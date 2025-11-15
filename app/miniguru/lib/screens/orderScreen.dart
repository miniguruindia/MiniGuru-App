import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/Order.dart';
import 'package:miniguru/models/Product.dart';
import 'package:miniguru/repository/OrderRepository.dart';
import 'package:miniguru/repository/productRepository.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final OrderRepository _orderRepository = OrderRepository();
  final ProductRepository _productRepository = ProductRepository();
  final List<Color> colors = [pastelYellow, pastelBlue, pastelRed];

  Map<String, Product> _productsMap = {};
  List<Order> _filteredOrders = [];
  String _selectedFilter = 'all';

  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
    });
    await _orderRepository.fetchAndStoreAllOrders();
    List<Order> orders = await _orderRepository.getAllOrders();

    Map<String, Product> productsMap = {};
    for (var order in orders) {
      for (var productItem in order.products) {
        Product? product =
            await _productRepository.getProductById(productItem.productId);
        if (product != null) {
          productsMap[productItem.productId] = product;
        }
      }
    }

    setState(() {
      _productsMap = productsMap;
      _filterOrders(_selectedFilter); // Apply the initial filter
      _isLoading = false;
    });
  }

  Future<void> _filterOrders(String filter) async {
    setState(() {
      _selectedFilter = filter;
    });

    List<Order> filteredOrders;
    if (filter == 'all') {
      filteredOrders = await _orderRepository.getAllOrders();
    } else {
      filteredOrders =
          await _orderRepository.getOrdersByStatus(filter.toLowerCase());
    }

    setState(() {
      _filteredOrders = filteredOrders;
    });
  }

  String _formatDate(DateTime date) {
    return "${date.day}/${date.month}/${date.year}";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Orders",
          style: headingTextStyle.copyWith(
              fontSize: 24, fontWeight: FontWeight.w600, color: Colors.black),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: !_isLoading
          ? Column(
              children: [
                // Filter Buttons
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8.0),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip("All"),
                        const SizedBox(width: 8),
                        _buildFilterChip("Pending"),
                        const SizedBox(width: 8),
                        _buildFilterChip("Completed"),
                      ],
                    ),
                  ),
                ),
                const Divider(height: 1, color: Colors.grey),
                Expanded(
                  child: _filteredOrders.isNotEmpty
                      ? ListView.builder(
                          itemCount: _filteredOrders.length,
                          itemBuilder: (context, index) {
                            final order = _filteredOrders[index];
                            return Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: 8.0,
                                horizontal: 20.0,
                              ),
                              child: Card(
                                color: colors[index % colors.length],
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                elevation: 2,
                                child: Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Row(
                                            children: [
                                              const Icon(Icons.receipt_long,
                                                  color: Colors.grey, size: 18),
                                              const SizedBox(width: 8),
                                              Text(
                                                "Order #${order.id}",
                                                style: bodyTextStyle.copyWith(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 10,
                                                    color: Colors.black87),
                                              ),
                                            ],
                                          ),
                                          Text(
                                            _formatDate(order.createdAt),
                                            style: bodyTextStyle.copyWith(
                                                fontSize: 12,
                                                color: Colors.grey[800]),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      ...order.products.map((productItem) {
                                        final product =
                                            _productsMap[productItem.productId];
                                        return product != null
                                            ? Padding(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        vertical: 4.0),
                                                child: Row(
                                                  children: [
                                                    ClipRRect(
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              4),
                                                      child: Image.network(
                                                        product.images,
                                                        width: 35,
                                                        height: 35,
                                                        fit: BoxFit.cover,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 12),
                                                    Expanded(
                                                      child: Column(
                                                        crossAxisAlignment:
                                                            CrossAxisAlignment
                                                                .start,
                                                        children: [
                                                          Text(
                                                            product.name,
                                                            style: bodyTextStyle
                                                                .copyWith(
                                                                    fontWeight:
                                                                        FontWeight
                                                                            .w600,
                                                                    fontSize:
                                                                        13),
                                                          ),
                                                          Text(
                                                            "Qty: ${productItem.quantity}",
                                                            style: bodyTextStyle
                                                                .copyWith(
                                                                    fontSize:
                                                                        12,
                                                                    color: Colors
                                                                            .grey[
                                                                        800]),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              )
                                            : const SizedBox.shrink();
                                      }),
                                      const SizedBox(height: 10),
                                      const Divider(
                                          height: 1, color: Colors.grey),
                                      const SizedBox(height: 10),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            "Total: ₹${order.totalAmount.toStringAsFixed(2)}",
                                            style: headingTextStyle.copyWith(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w600),
                                          ),
                                          Row(
                                            children: [
                                              const Icon(Icons.payment,
                                                  color: Colors.grey, size: 16),
                                              const SizedBox(width: 4),
                                              Text(
                                                order.paymentStatus,
                                                style: bodyTextStyle.copyWith(
                                                    fontSize: 12,
                                                    color: Colors.grey[800]),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        )
                      : const Center(
                          child: Text("No orders available.",
                              style: TextStyle(color: Colors.grey)),
                        ),
                ),
              ],
            )
          : const Center(
              child: CircularProgressIndicator(),
            ),
    );
  }

  Widget _buildFilterChip(String label) {
    return FilterChip(
      label: Text(
        label,
        style: bodyTextStyle.copyWith(
            color: (_selectedFilter.toLowerCase() == label.toLowerCase())
                ? backgroundWhite
                : buttonBlack),
      ),
      selected: _selectedFilter.toLowerCase() == label.toLowerCase(),
      onSelected: (bool selected) {
        if (selected) _filterOrders(label.toLowerCase());
      },
      selectedColor: buttonBlack,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }
}
