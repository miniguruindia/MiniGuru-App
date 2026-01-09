import 'dart:convert';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/Product.dart';
import 'package:miniguru/models/ProductCategory.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class ProductRepository {
  final MiniguruApi _api = MiniguruApi();
  final DatabaseHelper _dbHelper = DatabaseHelper();

  Future<void> fetchAndStoreProducts() async {
    final response = await _api.getAllProducts();

    // ✅ NULL SAFETY FIX
    if (response != null && response.statusCode == 200) {
      _dbHelper.deleteProducts();
      List<dynamic> data = jsonDecode(response.body);
      for (var item in data) {
        Product product = Product.fromJsonRemote(item);
        await _dbHelper.insertProduct(product);
      }
    } else {
      print('❌ Failed to load products: ${response?.statusCode}');
    }
  }

  Future<List<Product>> getProducts() async {
    return await DatabaseHelper().getProducts();
  }

  Future<List<Product>> getProductsByQuery(String query) async {
    return await DatabaseHelper().getProductsByQuery(query);
  }

  Future<void> fetchAndStoreProductCategories() async {
    final response = await _api.getProductCategories();

    // ✅ NULL SAFETY FIX
    if (response != null && response.statusCode == 200) {
      _dbHelper.deleteProductCategories();
      List<dynamic> data = jsonDecode(response.body);
      for (var item in data) {
        ProductCategory category = ProductCategory.fromMap(item);
        await _dbHelper.insertProductCategory(category);
      }
    } else {
      print('❌ Failed to load product categories: ${response?.statusCode}');
    }
  }

  Future<List<ProductCategory>> getProductCategories() async {
    return await DatabaseHelper().getProductCategories();
  }

  Future<Product?> getProductById(String productId) async {
    return await _dbHelper.getProductById(productId);
  }
}