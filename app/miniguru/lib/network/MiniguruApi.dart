import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/AuthToken.dart';
import 'package:miniguru/models/User.dart';
import 'package:path/path.dart';
import 'package:http_parser/http_parser.dart';
import 'package:miniguru/secrets.dart';


class MiniguruApi {
  static const String _baseUrl = apiBaseUrl;
  DatabaseHelper? _db;

  MiniguruApi() {
    _db = DatabaseHelper();
  }

  // ========================= AUTHENTICATION =========================

  // Login API
  Future<http.Response> login(String email, String password) async {
    final url = Uri.parse('$_baseUrl/auth/login');
    print('🔵 Login Request: $url');
    
    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );
    _handleResponse(response);
    
    if (response.statusCode == 200) {
      final body = jsonDecode(response.body);
      print('✅ Refresh token received: ${body['refreshToken']?.substring(0, 20)}...');
    }
    
    return response;
  }

  // Register API
  Future<http.Response> register(String name, String email, String password,
      int age, String phoneNumber) async {
    final url = Uri.parse('$_baseUrl/auth/register');
    print('🔵 Register Request: $url');
    print('📦 Data: name=$name, email=$email, age=$age, phone=$phoneNumber');
    
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

  // ✨ Password Reset Request API
  Future<http.Response> requestPasswordReset(String email) async {
    final url = Uri.parse('$_baseUrl/auth/forgot-password');
    print('🔐 Password Reset Request: $url');
    print('📧 Email: $email');
    
    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: jsonEncode({
        'email': email,
      }),
    );
    
    print('📦 Reset Response Status: ${response.statusCode}');
    print('📦 Reset Response: ${response.body}');
    
    return response;
  }

  // ✨ Reset Password with Token API
  Future<http.Response> resetPassword(String token, String newPassword) async {
    final url = Uri.parse('$_baseUrl/auth/reset-password');
    print('🔐 Reset Password Request: $url');
    
    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: jsonEncode({
        'token': token,
        'newPassword': newPassword,
      }),
    );
    
    print('📦 Reset Response Status: ${response.statusCode}');
    print('📦 Reset Response: ${response.body}');
    
    return response;
  }

  // ✨ NEW: Change Password API (for logged-in users)
  Future<http.Response> changePassword(String currentPassword, String newPassword) async {
    final authToken = await _getValidToken();
    if (authToken == null) {
      throw Exception('User not logged in');
    }

    final url = Uri.parse('$_baseUrl/auth/change-password');
    print('🔐 Change Password Request: $url');
    
    final response = await http.post(
      url,
      headers: _buildHeaders(authToken.accessToken),
      body: jsonEncode({
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      }),
    );
    
    print('📦 Change Password Status: ${response.statusCode}');
    print('📦 Change Password Response: ${response.body}');
    
    return response;
  }

  // Refresh the accessToken - FIXED NULL SAFETY
  Future<AuthToken?> refreshToken() async {
    try {
      print("🔄 Refreshing tokens...");
      
      // Check if token exists first
      final authToken = await _db!.getAuthToken();
      if (authToken == null) {
        print("❌ No refresh token found in database");
        return null;
      }
      
      final url = Uri.parse('$_baseUrl/auth/refresh-token');

      final response = await http.post(
        url,
        headers: _buildHeaders(),
        body: jsonEncode({'refreshToken': authToken.refreshToken}),
      );
      
      if (response.statusCode != 200) {
        print('❌ Token refresh failed: ${response.statusCode}');
        return null;
      }

      final newAuthToken = jsonDecode(response.body);
      await _db!.insertAuthToken(
        newAuthToken['accessToken']!,
        authToken.refreshToken,
      );

      final newToken = await _db!.getAuthToken();
      print('✅ Tokens refreshed successfully');
      return newToken;
    } catch (e) {
      print('❌ Error refreshing token: $e');
      return null;
    }
  }

  // Get User Data API - FIXED NULL SAFETY
  Future<User?> getUserData() async {
    try {
      // First check if user has any token
      final storedToken = await _db!.getAuthToken();
      if (storedToken == null) {
        print('ℹ️  No user logged in (no token found)');
        return null;
      }

      // Check if token expired
      var hasTokenExpired = await _db!.hasTokenExpired();
      
      AuthToken? authToken;
      if (hasTokenExpired) {
        authToken = await refreshToken();
        if (authToken == null) {
          print('❌ Token refresh failed - user needs to login again');
          return null;
        }
      } else {
        authToken = storedToken;
      }

      final url = Uri.parse('$_baseUrl/me');
      final response = await http.get(
        url,
        headers: _buildHeaders(authToken.accessToken),
      );

      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        data = data['user'];
        return User(
          id: data['id'],
          name: data['name'],
          email: data['email'],
          age: data['age'],
          score: data['score'] ?? 0,
          walletBalance: data['wallet']?['balance']?.toDouble() ?? 0.0,
          scoreHistory: data['scoreHistory'] ?? [],
          phoneNumber: data['phoneNumber'],
          totalProjects: data['totalProjects'] ?? 0,
        );
      } else if (response.statusCode == 401) {
        print('❌ Unauthorized - token invalid');
        return null;
      } else {
        throw Exception('Failed to load user data: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Error fetching user data: $e');
      return null;
    }
  }

  // Logout API - FIXED NULL SAFETY
  Future<http.Response?> logout() async {
    try {
      final storedToken = await _db!.getAuthToken();
      if (storedToken == null) {
        print('ℹ️  No user logged in');
        return null;
      }

      var hasTokenExpired = await _db!.hasTokenExpired();
      final authToken = (!hasTokenExpired) ? storedToken : await refreshToken();
      
      if (authToken == null) {
        print('❌ Cannot logout - no valid token');
        return null;
      }

      final url = Uri.parse('$_baseUrl/auth/logout');
      final response = await http.post(
        url,
        headers: _buildHeaders(authToken.refreshToken),
      );
      _handleResponse(response);
      
      // Clear local tokens
      await _db!.deleteAuthToken();
      
      return response;
    } catch (e) {
      print('❌ Logout error: $e');
      return null;
    }
  }

  // ========================= HELPER METHOD - FIXED NULL SAFETY =========================
  
  // Get valid auth token or return null
  Future<AuthToken?> _getValidToken() async {
    try {
      final storedToken = await _db!.getAuthToken();
      if (storedToken == null) {
        print('⚠️  No token - user needs to login');
        return null;
      }

      var hasTokenExpired = await _db!.hasTokenExpired();
      if (hasTokenExpired) {
        print('⏰ Token expired, refreshing...');
        return await refreshToken();
      }

      return storedToken;
    } catch (e) {
      print('❌ Error getting token: $e');
      return null;
    }
  }

  // ========================= PROJECTS =========================

  // Get all projects API - FIXED NULL SAFETY
  Future<http.Response?> getAllProjects({required int page, required int limit}) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final url = Uri.parse('$_baseUrl/project/all?page=$page&limit=$limit');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  // Get all projects categories API - FIXED NULL SAFETY
  Future<http.Response?> getProjectCategories() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final url = Uri.parse('$_baseUrl/project/categories');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  // Get all projects for a user - FIXED NULL SAFETY
  Future<http.Response?> getAllProjectsForUser() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final url = Uri.parse('$_baseUrl/project/');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  Future<http.Response?> uploadProjectWithMedia(
    Map<String, dynamic> data,
    XFile video,
    XFile thumbnail,
  ) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

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
    request.headers.addAll(_buildHeaders(authToken.accessToken));

    // Add video file
    var videoStream = http.ByteStream(video.openRead());
    var videoLength = await video.length();
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

  Future<http.Response?> addComment(String projectId, String content) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final response = await http.post(
      Uri.parse("$_baseUrl/project/$projectId/comment"),
      headers: _buildHeaders(authToken.accessToken),
      body: jsonEncode({"content": content}),
    );

    if (response.statusCode == 201) {
      return response;
    } else {
      _handleResponse(response);
      return null;
    }
  }

  // ========================= PRODUCTS =========================

  // Get all products API - FIXED NULL SAFETY
  Future<http.Response?> getAllProducts() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final url = Uri.parse('$_baseUrl/products/');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  // Get all product categories API - FIXED NULL SAFETY
  Future<http.Response?> getProductCategories() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final url = Uri.parse('$_baseUrl/products/categories/all');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  // ========================= ORDERS =========================

  // Add a order to the server - FIXED NULL SAFETY
  Future<http.Response?> placeOrder(List<Map<String, dynamic>> data, String address) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final url = Uri.parse('$_baseUrl/order');
    final response = await http.post(
      url,
      headers: _buildHeaders(authToken.accessToken),
      body: jsonEncode({"products": data, "deliveryAddress": address}),
    );
    _handleResponse(response);
    return response;
  }

  // Get all the orders by the user - FIXED NULL SAFETY
  Future<http.Response?> getOrders() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final url = Uri.parse('$_baseUrl/order/me');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  // ========================= PAYMENTS =========================

  // Create Razorpay Order - FIXED NULL SAFETY
  Future<Map<String, dynamic>?> createOrder(String userId, int amount) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final response = await http.post(
      Uri.parse("$_baseUrl/payment/create-order"),
      headers: _buildHeaders(authToken.accessToken),
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

  // Verify Razorpay Transaction - FIXED NULL SAFETY
  Future<bool> verifyTransaction(
      String userId, String transactionId, String razorpayOrderId) async {
    final authToken = await _getValidToken();
    if (authToken == null) return false;

    final response = await http.post(
      Uri.parse("$_baseUrl/payment/verify-order"),
      headers: _buildHeaders(authToken.accessToken),
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

  // ========================= WALLET =========================

  Future<Map<String, dynamic>?> fetchWallet() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final response = await http.get(
      Uri.parse("$_baseUrl/me/wallet"),
      headers: _buildHeaders(authToken.accessToken),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      print("Failed to fetch wallet data: ${response.body}");
      return null;
    }
  }

  // ========================= YOUTUBE INTEGRATION =========================

  // Track video view
  Future<void> trackVideoView(String videoId) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) {
        print('⚠️  Cannot track view - user not logged in');
        return;
      }

      await http.post(
        Uri.parse('$_baseUrl/youtube/track-view'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({'videoId': videoId}),
      );
      print('✅ View tracked for video: $videoId');
    } catch (e) {
      print('❌ Failed to track view: $e');
    }
  }

  // Get video view count
  Future<Map<String, dynamic>> getVideoViews(String videoId) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/youtube/views/$videoId'),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          'appViews': data['appViews'] ?? 0,
          'youtubeViews': data['youtubeViews'] ?? 0,
          'totalViews': data['totalViews'] ?? 0,
        };
      }
      return {
        'appViews': 0,
        'youtubeViews': 0,
        'totalViews': 0,
      };
    } catch (e) {
      print('❌ Failed to get views: $e');
      return {
        'appViews': 0,
        'youtubeViews': 0,
        'totalViews': 0,
      };
    }
  }

  // Post comment to video
  Future<Map<String, dynamic>?> postVideoComment(String videoId, String comment) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return null;

      final response = await http.post(
        Uri.parse('$_baseUrl/youtube/comments'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({
          'videoId': videoId,
          'comment': comment,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success']) {
          return data['comment'];
        }
      }
      return null;
    } catch (e) {
      print('❌ Failed to post comment: $e');
      throw Exception('Failed to post comment');
    }
  }

  // Get video comments
  Future<List<Map<String, dynamic>>> getVideoComments(String videoId, {int limit = 20}) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/youtube/comments/$videoId?limit=$limit'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success']) {
          return List<Map<String, dynamic>>.from(data['comments']);
        }
      }
      return [];
    } catch (e) {
      print('❌ Failed to get comments: $e');
      return [];
    }
  }

  // Delete comment
  Future<bool> deleteVideoComment(String commentId) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return false;

      final response = await http.delete(
        Uri.parse('$_baseUrl/youtube/comments/$commentId'),
        headers: _buildHeaders(authToken.accessToken),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['success'] == true;
      }
      return false;
    } catch (e) {
      print('❌ Failed to delete comment: $e');
      return false;
    }
  }

  // ========================= UTILITIES =========================

  // Health check method for testing backend connection
  Future<bool> checkConnection() async {
    try {
      final url = Uri.parse('$_baseUrl/health');
      print('🔍 Checking connection: $url');
      
      final response = await http.get(url).timeout(
        const Duration(seconds: 5),
      );
      
      print('🟢 Connection status: ${response.statusCode}');
      return response.statusCode == 200;
    } catch (e) {
      print('❌ Connection check failed: $e');
      return false;
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
      print('❌ Error: ${response.statusCode} - ${response.reasonPhrase}');
      print('📦 Response Body: ${response.body}');
    } else {
      print('✅ Success: ${response.statusCode}');
    }
  }
}