import 'dart:convert';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/Order.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class OrderRepository {
  final _db = DatabaseHelper();
  final _api = MiniguruApi();

  Future<void> fetchAndStoreAllOrders() async {
    final response = await _api.getOrders();

    // ✅ NULL SAFETY FIX
    if (response != null && response.statusCode == 200) {
      _db.clearOrders();
      List<dynamic> data = jsonDecode(response.body);
      for (var item in data) {
        Order order = Order.fromApiJson(item);
        await _db.insertOrder(order);
      }
    } else {
      print('❌ Failed to load orders: ${response?.statusCode}');
    }
  }

  Future<List<Order>> getAllOrders() async {
    return await _db.getOrders();
  }

  Future<List<Order>> getOrdersByStatus(String status) async {
    return await _db.getOrdersByStatus(status);
  }

  Future<Order?> getOrderById(String id) async {
    return await _db.getOrdersById(id);
  }
}