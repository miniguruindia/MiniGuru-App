import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/AuthToken.dart';
import 'package:miniguru/models/User.dart';
import 'package:path/path.dart';
import 'package:http_parser/http_parser.dart';

class MiniguruApi {
  static const String _baseUrl = "http://203.18.51.39:443";
  // static const String _baseUrl = "http://172.29.156.16:3000";
  DatabaseHelper? _db;

  MiniguruApi() {
    _db = DatabaseHelper();
  }

  // Login API
  Future<http.Response> login(String email, String password) async {
    final url = Uri.parse('$_baseUrl/auth/login');
    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );
    _handleResponse(response);
    print(jsonDecode(response.body)['refreshToken']);
    return response;
  }

  // Register API
  Future<http.Response> register(String name, String email, String password,
      int age, String phoneNumber) async {
    final url = Uri.parse('$_baseUrl/auth/register');
    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: jsonEncode({
        'name': name,
        'email': email,
        'password': password,
        'age': age,
        'phoneNumber': phoneNumber
      }),
    );
    _handleResponse(response);
    return response;
  }

  //Refresh the accessToken
  Future<AuthToken> refreshToken() async {
    print("Refreshing tokens ...");
    final authToken = await _db!.getAuthToken();
    final url = Uri.parse('$_baseUrl/auth/refresh-token');

    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: jsonEncode({'refreshToken': authToken!.refreshToken}),
    );
    _handleResponse(response);
    print(authToken.accessToken);

    final newAuthToken = jsonDecode(response.body);
    await _db!
        .insertAuthToken(newAuthToken['accessToken']!, authToken.refreshToken);

    final newToken = await _db!.getAuthToken();

    return newToken!;
  }

  // Get User Data API
  Future<User?> getUserData() async {
    try {
      var hasTokenExpired = await _db!.hasTokenExpired();
      final authToken =
          (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

      final url = Uri.parse('$_baseUrl/me');
      final response = await http.get(
        url,
        headers: _buildHeaders(authToken!.accessToken),
      );
      _handleResponse(response);

      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        data = data['user'];
        return User(
            id: data['id'],
            name: data['name'],
            email: data['email'],
            age: data['age'],
            score: data['score'],
            walletBalance: data['wallet']['balance'].toDouble(),
            scoreHistory: data['scoreHistory'],
            phoneNumber: data['phoneNumber'],
            totalProjects: data['totalProjects']);
      } else {
        throw Exception('Failed to load user data');
      }
    } catch (e) {
      print('Error fetching user data: $e');
      return null;
    }
  }

  // Logout API
  Future<http.Response> logout() async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final url = Uri.parse('$_baseUrl/auth/logout');
    final response = await http.post(
      url,
      headers: _buildHeaders(authToken!.refreshToken),
    );
    _handleResponse(response);
    return response;
  }

  //Get all projects API
  Future<http.Response> getAllProjects(
      {required int page, required int limit}) async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final url = Uri.parse('$_baseUrl/project/all?page=$page&limit=$limit');
    final response =
        await http.get(url, headers: _buildHeaders(authToken!.accessToken));
    _handleResponse(response);
    return response;
  }

  //Get all projects categories API
  Future<http.Response> getProjectCategories() async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final url = Uri.parse('$_baseUrl/project/categories');
    final response =
        await http.get(url, headers: _buildHeaders(authToken!.accessToken));
    _handleResponse(response);
    return response;
  }

  //Get all products API
  Future<http.Response> getAllProducts() async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final url = Uri.parse('$_baseUrl/products/');
    final response =
        await http.get(url, headers: _buildHeaders(authToken!.accessToken));
    _handleResponse(response);
    return response;
  }

  //Get all projects categories API
  Future<http.Response> getProductCategories() async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final url = Uri.parse('$_baseUrl/products/categories/all');
    final response =
        await http.get(url, headers: _buildHeaders(authToken!.accessToken));
    _handleResponse(response);
    return response;
  }

  //Add a order to the server
  Future<http.Response> placeOrder(
      List<Map<String, dynamic>> data, String address) async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final url = Uri.parse('$_baseUrl/order');
    final response = await http.post(url,
        headers: _buildHeaders(authToken!.accessToken),
        body: jsonEncode({"products": data, "deliveryAddress": address}));
    _handleResponse(response);
    return response;
  }

  //Get all the orders by the user
  Future<http.Response> getOrders() async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final url = Uri.parse('$_baseUrl/order/me');
    final response =
        await http.get(url, headers: _buildHeaders(authToken!.accessToken));
    _handleResponse(response);
    return response;
  }

  //Get all projects for a user
  Future<http.Response> getAllProjectsForUser() async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final url = Uri.parse('$_baseUrl/project/');
    final response =
        await http.get(url, headers: _buildHeaders(authToken!.accessToken));
    _handleResponse(response);
    return response;
  }

  Future<http.Response> uploadProjectWithMedia(
    Map<String, dynamic> data,
    XFile video,
    XFile thumbnail,
  ) async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final url = Uri.parse('$_baseUrl/project/');
    var request = http.MultipartRequest('POST', url);

    // Adding form fields
    request.fields['title'] = data['title'];
    request.fields['description'] = data['description'];
    request.fields['startDate'] = data['startDate'];
    request.fields['endDate'] = data['endDate'];
    request.fields['categoryName'] = data['categoryName'];
    request.fields['materials'] = jsonEncode(data['materials']);

    // Add authorization headers
    request.headers.addAll(_buildHeaders(authToken!.accessToken));

    // Add video file
    var videoStream = http.ByteStream(video.openRead());
    var videoLength = await video.length();
    print(videoLength);
    request.files.add(
      http.MultipartFile(
        'video',
        videoStream,
        videoLength,
        filename: basename(video.path),
        contentType: MediaType.parse('video/mp4'),
      ),
    );

    // Add thumbnail file
    var thumbnailStream = http.ByteStream(thumbnail.openRead());
    var thumbnailLength = await thumbnail.length();
    print(thumbnailLength);
    request.files.add(
      http.MultipartFile(
        'thumbnail',
        thumbnailStream,
        thumbnailLength,
        filename: basename(thumbnail.path),
        contentType: MediaType.parse('image/jpeg'),
      ),
    );

    // Send request
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    _handleResponse(response);
    return response;
  }

  // Create Razorpay Order
  Future<Map<String, dynamic>?> createOrder(String userId, int amount) async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final response = await http.post(
      Uri.parse("$_baseUrl/payment/create-order"),
      headers: _buildHeaders(authToken!.accessToken),
      body: jsonEncode({
        "userId": userId,
        "amount": amount,
      }),
    );

    if (response.statusCode == 201) {
      return jsonDecode(response.body)["data"];
    } else {
      print("Failed to create order: ${response.body}");
      return null;
    }
  }

  // Verify Razorpay Transaction
  Future<bool> verifyTransaction(
      String userId, String transactionId, String razorpayOrderId) async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final response = await http.post(
      Uri.parse("$_baseUrl/payment/verify-order"),
      headers: _buildHeaders(authToken!.accessToken),
      body: jsonEncode({
        "userId": userId,
        "transactionId": transactionId,
        "razorpayOrderId": razorpayOrderId,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data["success"] ?? false;
    } else {
      print("Failed to verify transaction: ${response.statusCode}");
      return false;
    }
  }

  Future<Map<String, dynamic>?> fetchWallet() async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final response = await http.get(
      Uri.parse("$_baseUrl/me/wallet"),
      headers: _buildHeaders(authToken!.accessToken),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      print("Failed to fetch wallet data: ${response.body}");
      return null;
    }
  }

  Future<http.Response?> addComment(String projectId, String content) async {
    var hasTokenExpired = await _db!.hasTokenExpired();
    final authToken =
        (!hasTokenExpired) ? await _db!.getAuthToken() : await refreshToken();

    final response = await http.post(
        Uri.parse("$_baseUrl/project/$projectId/comment"),
        headers: _buildHeaders(authToken!.accessToken),
        body: jsonEncode({"content": content}));

    if (response.statusCode == 201) {
      return response;
    } else {
      _handleResponse(response);
      return null;
    }
  }

  // Helper method to build headers (including Authorization)
  Map<String, String> _buildHeaders([String? accessToken]) {
    return {
      'Content-Type': 'application/json',
      if (accessToken != null) 'Authorization': 'Bearer $accessToken',
    };
  }

  // Handle the response, including logging and error checking
  void _handleResponse(http.Response response) {
    if (response.statusCode >= 400) {
      print('Error: ${response.statusCode} - ${response.reasonPhrase}');
      print(response.body);
    } else {
      print('Success: ${response.statusCode}');
    }
  }
}
