import 'dart:convert';

import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class CartRepository {
  final _db = DatabaseHelper();
  final _api = MiniguruApi();

  Future<int> getItemsQuantity(String productId) async {
    return _db.getItemQuantity(productId);
  }

  Future<List<Map<String, dynamic>>> getCart() async {
    return _db.getAllCartItems();
  }

  Future<void> addToCart(String productId, String name, double price) async {
    return _db.addToCart(productId, name, price);
  }

  Future<void> removeFromCart(String productId) async {
    return _db.removeFromCart(productId);
  }

  Future<void> clearFromCart(String productId) async {
    return _db.clearItemFromCart(productId);
  }

  Future<void> clearCart() async {
    return _db.clearCart();
  }

  Future<String?> placeOrder(
      List<Map<String, dynamic>> data, String address) async {
    final response = await _api.placeOrder(data, address);

    if (response.statusCode == 201) {
      await _db.clearCart();
      var data = jsonDecode(response.body);
      return data['id'] as String;
    } else {
      return null;
    }
  }
}
