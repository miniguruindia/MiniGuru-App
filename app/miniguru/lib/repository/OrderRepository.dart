import 'dart:convert';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/Order.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class OrderRepository {
  final _db = DatabaseHelper();
  final _api = MiniguruApi();

  // Fetch and store
  Future<void> fetchAndStoreAllOrders() async {
    final response = await _api.getOrders();

    if (response.statusCode == 200) {
      _db.clearOrders();
      List<dynamic> data = jsonDecode(response.body);
      for (var item in data) {
        Order order = Order.fromApiJson(item);
        await _db.insertOrder(order);
      }
    } else {
      throw Exception('Failed to load projects');
    }
  }

  // Get all orders
  Future<List<Order>> getAllOrders() async {
    return await _db.getOrders();
  }

  // Get orders by status
  Future<List<Order>> getOrdersByStatus(String status) async {
    return await _db.getOrdersByStatus(status);
  }

  // Get order by ID
  Future<Order?> getOrderById(String id) async {
    return await _db.getOrdersById(id);
  }
}
