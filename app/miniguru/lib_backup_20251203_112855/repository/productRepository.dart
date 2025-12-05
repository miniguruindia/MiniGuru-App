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

    if (response.statusCode == 200) {
      _dbHelper.deleteProducts();
      List<dynamic> data = jsonDecode(response.body);
      for (var item in data) {
        Product product = Product.fromJsonRemote(item);
        await _dbHelper.insertProduct(product);
      }
    } else {
      throw Exception('Failed to load projects');
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

    if (response.statusCode == 200) {
      _dbHelper.deleteProductCategories();
      List<dynamic> data = jsonDecode(response.body);
      for (var item in data) {
        ProductCategory category = ProductCategory.fromJson(item);
        await _dbHelper.insertProductCategory(category);
      }
    } else {
      throw Exception("Failed to load project categories");
    }
  }

  Future<List<ProductCategory>> getProductCategories() async {
    return await DatabaseHelper().getProductCategories();
  }

  Future<Product?> getProductById(String productId) async {
    return await _dbHelper.getProductById(productId);
  }
}
