import 'dart:convert';

class Order {
  final String id;
  final String userId;
  final List<ProductItem> products;
  final double totalAmount;
  final String paymentStatus;
  final DateTime createdAt;
  final DateTime updatedAt;

  Order({
    required this.id,
    required this.userId,
    required this.products,
    required this.totalAmount,
    required this.paymentStatus,
    required this.createdAt,
    required this.updatedAt,
  });

  // Convert an Order instance to a map for sqflite
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'totalAmount': totalAmount,
      'paymentStatus': paymentStatus,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'products': jsonEncode(products
          .map((p) => p.toMap())
          .toList()), // Convert list to JSON string
    };
  }

  // Convert a map to an Order instance
  factory Order.fromMap(Map<String, dynamic> map) {
    return Order(
      id: map['id'],
      userId: map['userId'],
      products: (jsonDecode(map['products']) as List<dynamic>)
          .map((item) => ProductItem.fromMap(item as Map<String, dynamic>))
          .toList(),
      totalAmount: map['totalAmount'],
      paymentStatus: map['paymentStatus'],
      createdAt: DateTime.parse(map['createdAt']),
      updatedAt: DateTime.parse(map['updatedAt']),
    );
  }

  // Convert an Order instance to JSON for API responses
  String toJson() => jsonEncode(toMap());

  // Convert JSON to an Order instance from API response
  factory Order.fromApiJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'],
      userId: json['userId'],
      products: (json['products'] as List<dynamic>)
          .map((item) => ProductItem.fromApiJson(item as Map<String, dynamic>))
          .toList(),
      totalAmount: json['totalAmount'].toDouble(),
      paymentStatus: json['paymentStatus'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }
}

class ProductItem {
  final String productId;
  final int quantity;

  ProductItem({
    required this.productId,
    required this.quantity,
  });

  // Convert a ProductItem instance to a map for sqflite
  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'quantity': quantity,
    };
  }

  // Convert a map to a ProductItem instance
  factory ProductItem.fromMap(Map<String, dynamic> map) {
    return ProductItem(
      productId: map['productId'],
      quantity: map['quantity'],
    );
  }

  // Convert a ProductItem instance to JSON for easier manipulation
  String toJson() => jsonEncode(toMap());

  // Convert a JSON string to a ProductItem instance
  factory ProductItem.fromJson(String source) =>
      ProductItem.fromMap(jsonDecode(source));

  // Convert a map to a ProductItem instance from API response
  factory ProductItem.fromApiJson(Map<String, dynamic> json) {
    return ProductItem(
      productId: json['productId'],
      quantity: json['quantity'],
    );
  }
}
