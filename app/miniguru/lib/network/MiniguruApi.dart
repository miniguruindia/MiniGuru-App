import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/AuthToken.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/models/ChildProfile.dart';
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

  Future<http.Response> login(String email, String password) async {
    final url = Uri.parse('$_baseUrl/auth/login');
    print('🔵 Login Request: $url');
    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: jsonEncode({'email': email, 'password': password}),
    );
    _handleResponse(response);
    if (response.statusCode == 200) {
      final body = jsonDecode(response.body);
      print('✅ Refresh token received: ${body['refreshToken']?.substring(0, 20)}...');
    }
    return response;
  }

  Future<http.Response> register(String name, String email, String password,
      int age, String phoneNumber) async {
    final url = Uri.parse('$_baseUrl/auth/register');
    print('🔵 Register Request: $url');
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

  Future<http.Response> requestPasswordReset(String email) async {
    final url = Uri.parse('$_baseUrl/auth/forgot-password');
    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: jsonEncode({'email': email}),
    );
    print('📦 Reset Response Status: ${response.statusCode}');
    return response;
  }

  Future<http.Response> resetPassword(String token, String newPassword) async {
    final url = Uri.parse('$_baseUrl/auth/reset-password');
    final response = await http.post(
      url,
      headers: _buildHeaders(),
      body: jsonEncode({'token': token, 'newPassword': newPassword}),
    );
    print('📦 Reset Response Status: ${response.statusCode}');
    return response;
  }

  Future<http.Response> changePassword(String currentPassword, String newPassword) async {
    final authToken = await _getValidToken();
    if (authToken == null) throw Exception('User not logged in');
    final url = Uri.parse('$_baseUrl/auth/change-password');
    final response = await http.post(
      url,
      headers: _buildHeaders(authToken.accessToken),
      body: jsonEncode({'currentPassword': currentPassword, 'newPassword': newPassword}),
    );
    print('📦 Change Password Status: ${response.statusCode}');
    return response;
  }

  Future<AuthToken?> refreshToken() async {
    try {
      print("🔄 Refreshing tokens...");
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
      await _db!.insertAuthToken(newAuthToken['accessToken']!, authToken.refreshToken);
      final newToken = await _db!.getAuthToken();
      print('✅ Tokens refreshed successfully');
      return newToken;
    } catch (e) {
      print('❌ Error refreshing token: $e');
      return null;
    }
  }

  Future<User?> getUserData() async {
    try {
      final storedToken = await _db!.getAuthToken();
      if (storedToken == null) {
        print('ℹ️  No user logged in (no token found)');
        return null;
      }
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
      final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
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
          isMentor: data['isMentor'] ?? false,
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
      final response = await http.post(url, headers: _buildHeaders(authToken.refreshToken));
      _handleResponse(response);
      await _db!.deleteAuthToken();
      return response;
    } catch (e) {
      print('❌ Logout error: $e');
      return null;
    }
  }

  // ========================= HELPER METHOD =========================

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

  Future<http.Response?> getAllProjects({required int page, required int limit}) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;
    final url = Uri.parse('$_baseUrl/project/all?page=$page&limit=$limit');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  Future<http.Response?> getProjectCategories() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;
    final url = Uri.parse('$_baseUrl/project/categories');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

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

    request.fields['title']        = data['title'];
    request.fields['description']  = data['description'];
    request.fields['startDate']    = data['startDate'];
    request.fields['endDate']      = data['endDate'];
    request.fields['categoryName'] = data['categoryName'];
    request.fields['materials']    = jsonEncode(data['materials']);

    request.headers.addAll(_buildHeaders(authToken.accessToken));

    if (kIsWeb) {
      final videoBytes = await video.readAsBytes();
      request.files.add(http.MultipartFile.fromBytes(
        'video', videoBytes,
        filename: video.name,
        contentType: MediaType.parse('video/mp4'),
      ));
      final thumbBytes = await thumbnail.readAsBytes();
      request.files.add(http.MultipartFile.fromBytes(
        'thumbnail', thumbBytes,
        filename: thumbnail.name,
        contentType: MediaType.parse('image/jpeg'),
      ));
    } else {
      var videoStream = http.ByteStream(video.openRead());
      var videoLength = await video.length();
      request.files.add(http.MultipartFile(
        'video', videoStream, videoLength,
        filename: basename(video.path),
        contentType: MediaType.parse('video/mp4'),
      ));
      var thumbnailStream = http.ByteStream(thumbnail.openRead());
      var thumbnailLength = await thumbnail.length();
      request.files.add(http.MultipartFile(
        'thumbnail', thumbnailStream, thumbnailLength,
        filename: basename(thumbnail.path),
        contentType: MediaType.parse('image/jpeg'),
      ));
    }

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
    if (response.statusCode == 201) return response;
    _handleResponse(response);
    return null;
  }

  // ========================= PRODUCTS =========================

  Future<http.Response?> getAllProducts() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;
    final url = Uri.parse('$_baseUrl/products/');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  Future<http.Response?> getProductCategories() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;
    final url = Uri.parse('$_baseUrl/products/categories/all');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  // ========================= ORDERS =========================

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

  Future<http.Response?> getOrders() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;
    final url = Uri.parse('$_baseUrl/order/me');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  // ========================= PAYMENTS =========================

  Future<Map<String, dynamic>?> createOrder(String userId, int amount) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;
    final response = await http.post(
      Uri.parse("$_baseUrl/payment/create-order"),
      headers: _buildHeaders(authToken.accessToken),
      body: jsonEncode({"userId": userId, "amount": amount}),
    );
    if (response.statusCode == 201) return jsonDecode(response.body)["data"];
    print("Failed to create order: ${response.body}");
    return null;
  }

  Future<bool> verifyTransaction(String userId, String transactionId, String razorpayOrderId) async {
    final authToken = await _getValidToken();
    if (authToken == null) return false;
    final response = await http.post(
      Uri.parse("$_baseUrl/payment/verify-order"),
      headers: _buildHeaders(authToken.accessToken),
      body: jsonEncode({"userId": userId, "transactionId": transactionId, "razorpayOrderId": razorpayOrderId}),
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data["success"] ?? false;
    }
    print("Failed to verify transaction: ${response.statusCode}");
    return false;
  }

  // ========================= WALLET =========================

  Future<Map<String, dynamic>?> fetchWallet() async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;
    final response = await http.get(
      Uri.parse("$_baseUrl/me/wallet"),
      headers: _buildHeaders(authToken.accessToken),
    );
    if (response.statusCode == 200) return jsonDecode(response.body);
    print("Failed to fetch wallet data: ${response.body}");
    return null;
  }

  // ========================= MATERIALS =========================

  Future<http.Response?> getMaterials({String? categoryId}) async {
    try {
      final queryParam = categoryId != null ? '?categoryId=$categoryId' : '';
      final url = Uri.parse('$_baseUrl/materials$queryParam');
      final authToken = await _getValidToken();
      final response = await http.get(url, headers: _buildHeaders(authToken?.accessToken));
      _handleResponse(response);
      return response;
    } catch (e) {
      print('❌ Failed to fetch materials: $e');
      return null;
    }
  }

  Future<http.Response?> getMaterialCategories() async {
    try {
      final url = Uri.parse('$_baseUrl/materials/categories');
      final response = await http.get(url, headers: _buildHeaders());
      _handleResponse(response);
      return response;
    } catch (e) {
      print('❌ Failed to fetch material categories: $e');
      return null;
    }
  }

  // ========================= GOINS =========================

  Future<Map<String, dynamic>?> getGoinsBalance() async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return null;
      final response = await http.get(
        Uri.parse('$_baseUrl/goins/balance'),
        headers: _buildHeaders(authToken.accessToken),
      );
      if (response.statusCode == 200) return jsonDecode(response.body);
      print('❌ Failed to get goins balance: ${response.statusCode}');
      return null;
    } catch (e) {
      print('❌ Goins balance error: $e');
      return null;
    }
  }

  Future<http.Response?> getGoinsHistory({int page = 1, int limit = 20}) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;
    final url = Uri.parse('$_baseUrl/goins/history?page=$page&limit=$limit');
    final response = await http.get(url, headers: _buildHeaders(authToken.accessToken));
    _handleResponse(response);
    return response;
  }

  Future<Map<String, dynamic>?> deductGoinsForMaterials({
    required String projectId,
    required List<Map<String, dynamic>> materials,
    required int totalGoins,
  }) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) {
        print('⚠️  Cannot deduct goins — user not logged in');
        return null;
      }
      final response = await http.post(
        Uri.parse('$_baseUrl/goins/deduct'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({'projectId': projectId, 'materials': materials, 'totalGoins': totalGoins, 'reason': 'material_deduction'}),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        print('✅ Goins deducted: -$totalGoins | New balance: ${data['newBalance']}');
        return data;
      }
      print('❌ Goins deduction failed: ${response.statusCode} ${response.body}');
      return null;
    } catch (e) {
      print('❌ Goins deduction error: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> awardGoinsForVideoUpload({required String projectId}) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return null;
      final response = await http.post(
        Uri.parse('$_baseUrl/goins/award/video-upload'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({'projectId': projectId, 'reason': 'video_upload'}),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        print('🎉 Goins awarded for upload: +${data['awarded']} | Balance: ${data['newBalance']}');
        return data;
      }
      return null;
    } catch (e) {
      print('❌ Award upload goins error: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> awardGoinsForLike({required String videoId, required String likeCategory}) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return null;
      final response = await http.post(
        Uri.parse('$_baseUrl/goins/award/like'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({'videoId': videoId, 'likeCategory': likeCategory, 'reason': 'like_received'}),
      );
      if (response.statusCode == 200 || response.statusCode == 201) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('❌ Award like goins error: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> awardGoinsForComment({required String videoId}) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return null;
      final response = await http.post(
        Uri.parse('$_baseUrl/goins/award/comment'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({'videoId': videoId, 'reason': 'comment_received'}),
      );
      if (response.statusCode == 200 || response.statusCode == 201) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('❌ Award comment goins error: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> checkGoinsBalance(int required) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return {'sufficient': false, 'balance': 0, 'required': required};
      final response = await http.get(
        Uri.parse('$_baseUrl/goins/check?required=$required'),
        headers: _buildHeaders(authToken.accessToken),
      );
      if (response.statusCode == 200) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('❌ Check goins error: $e');
      return null;
    }
  }

  // ========================= VIDEO INTERACTION =========================

  Future<void> trackVideoView(String videoId) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return;
      await http.post(
        Uri.parse('$_baseUrl/api/videos/$videoId/view'),
        headers: _buildHeaders(authToken.accessToken),
      );
    } catch (e) {
      print('❌ Failed to track view: $e');
    }
  }

  Future<Map<String, dynamic>> getVideoViews(String videoId) async {
    try {
      final response = await http.get(Uri.parse('$_baseUrl/api/videos/$videoId/views'));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          'totalViews': data['totalViews'] ?? 0,
          'uniqueViewers': data['uniqueViewers'] ?? 0,
          'appViews': data['appViews'] ?? 0,
          'youtubeViews': data['youtubeViews'] ?? 0,
        };
      }
    } catch (e) {
      print('❌ Failed to get views: $e');
    }
    return {'totalViews': 0, 'uniqueViewers': 0, 'appViews': 0, 'youtubeViews': 0};
  }

  Future<void> likeVideo(String videoId, String category, bool liked) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) throw Exception('User not logged in');
      final response = await http.post(
        Uri.parse('$_baseUrl/api/videos/$videoId/like'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({'category': category, 'liked': liked}),
      );
      if (response.statusCode != 200) throw Exception('Failed to update like');
    } catch (e) {
      print('❌ Like video error: $e');
      rethrow;
    }
  }

  Future<Map<String, bool>> getUserVideoLikes(String videoId) async {
    final empty = {'aesthetic': false, 'functional': false, 'sturdy': false, 'creative': false, 'educational': false};
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return empty;
      final response = await http.get(
        Uri.parse('$_baseUrl/api/videos/$videoId/likes/user'),
        headers: _buildHeaders(authToken.accessToken),
      );
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        return {
          'aesthetic': data['aesthetic'] ?? false,
          'functional': data['functional'] ?? false,
          'sturdy': data['sturdy'] ?? false,
          'creative': data['creative'] ?? false,
          'educational': data['educational'] ?? false,
        };
      }
    } catch (e) {
      print('❌ Get user likes error: $e');
    }
    return empty;
  }

  Future<Map<String, dynamic>?> postVideoComment(String videoId, String comment) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return null;
      final response = await http.post(
        Uri.parse('$_baseUrl/api/videos/$videoId/comments'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({'comment': comment}),
      );
      if (response.statusCode == 201) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('❌ Failed to post comment: $e');
      throw Exception('Failed to post comment');
    }
  }

  Future<List<Map<String, dynamic>>> getVideoComments(String videoId, {int limit = 50}) async {
    try {
      final response = await http.get(Uri.parse('$_baseUrl/api/videos/$videoId/comments?limit=$limit'));
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.cast<Map<String, dynamic>>();
      }
    } catch (e) {
      print('❌ Failed to get comments: $e');
    }
    return [];
  }

  Future<bool> deleteVideoComment(String commentId) async {
    try {
      final authToken = await _getValidToken();
      if (authToken == null) return false;
      final response = await http.delete(
        Uri.parse('$_baseUrl/api/videos/comments/$commentId'),
        headers: _buildHeaders(authToken.accessToken),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('❌ Failed to delete comment: $e');
      return false;
    }
  }

  // ========================= UTILITIES =========================

  Future<bool> checkConnection() async {
    try {
      final url = Uri.parse('$_baseUrl/health');
      final response = await http.get(url).timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (e) {
      print('❌ Connection check failed: $e');
      return false;
    }
  }

  Map<String, String> _buildHeaders([String? accessToken]) {
    return {
      'Content-Type': 'application/json',
      if (accessToken != null) 'Authorization': 'Bearer $accessToken',
    };
  }

  void _handleResponse(http.Response response) {
    if (response.statusCode >= 400) {
      print('❌ Error: ${response.statusCode} - ${response.reasonPhrase}');
      print('📦 Response Body: ${response.body}');
    } else {
      print('✅ Success: ${response.statusCode}');
    }
  }

  Future<Map<String, dynamic>?> getAnalytics() async {
    try {
      final authToken = await _db!.getAuthToken();
      if (authToken == null) return null;
      final response = await http.get(
        Uri.parse('$_baseUrl/users/me/analytics'),
        headers: _buildHeaders(authToken.accessToken),
      );
      if (response.statusCode == 200) return jsonDecode(response.body) as Map<String, dynamic>;
    } catch (e) { print('❌ getAnalytics: $e'); }
    return null;
  }

  Future<List<dynamic>?> getBadges() async {
    try {
      final authToken = await _db!.getAuthToken();
      if (authToken == null) return null;
      final response = await http.get(
        Uri.parse('$_baseUrl/users/me/badges'),
        headers: _buildHeaders(authToken.accessToken),
      );
      if (response.statusCode == 200) {
        return (jsonDecode(response.body))['badges'] as List<dynamic>;
      }
    } catch (e) { print('❌ getBadges: $e'); }
    return null;
  }

  Future<List<dynamic>?> getNotifications() async {
    try {
      final authToken = await _db!.getAuthToken();
      if (authToken == null) return null;
      final response = await http.get(
        Uri.parse('$_baseUrl/users/me/notifications'),
        headers: _buildHeaders(authToken.accessToken),
      );
      if (response.statusCode == 200) {
        return (jsonDecode(response.body))['notifications'] as List<dynamic>;
      }
    } catch (e) { print('❌ getNotifications: $e'); }
    return null;
  }

  Future<bool> uploadProfilePhoto(String base64Photo) async {
    try {
      final authToken = await _db!.getAuthToken();
      if (authToken == null) return false;
      final response = await http.post(
        Uri.parse('$_baseUrl/users/me/photo'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({'photo': base64Photo}),
      );
      return response.statusCode == 200;
    } catch (e) { print('❌ uploadProfilePhoto: $e'); }
    return false;
  }

  Future<String?> getProfilePhoto() async {
    try {
      final authToken = await _db!.getAuthToken();
      if (authToken == null) return null;
      final response = await http.get(
        Uri.parse('$_baseUrl/users/me/photo'),
        headers: _buildHeaders(authToken.accessToken),
      );
      if (response.statusCode == 200) {
        return (jsonDecode(response.body))['photo'] as String?;
      }
    } catch (e) { print('❌ getProfilePhoto: $e'); }
    return null;
  }

  // ========================= MENTOR =========================
  Future<http.Response> registerMentor({
    required String name,
    required String email,
    required String phoneNumber,
    required String password,
    required String mentorType,
    String? institutionName,
    String? city,
    String? state,
  }) async {
    return await http.post(
      Uri.parse('$_baseUrl/mentor/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'name': name,
        'email': email,
        'phoneNumber': phoneNumber,
        'password': password,
        'mentorType': mentorType,
        if (institutionName != null) 'institutionName': institutionName,
        if (city != null) 'city': city,
        if (state != null) 'state': state,
      }),
    );
  }

  // ========================= MENTOR — CHILDREN =========================
  Future<List<ChildProfile>> getMentorChildren() async {
    try {
      final authToken = await _db!.getAuthToken();
      if (authToken == null) return [];
      final response = await http.get(
        Uri.parse('$_baseUrl/mentor/children'),
        headers: _buildHeaders(authToken.accessToken),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = data['children'] as List<dynamic>;
        return list.map((e) => ChildProfile.fromMap(e as Map<String, dynamic>)).toList();
      }
    } catch (e) { print('❌ getMentorChildren: $e'); }
    return [];
  }

  Future<bool> addChildProfile({required String name, required int age, String? grade, required String pin}) async {
    try {
      final authToken = await _db!.getAuthToken();
      if (authToken == null) return false;
      final response = await http.post(
        Uri.parse('$_baseUrl/mentor/children'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({
          'name': name,
          'age': age,
          if (grade != null) 'grade': grade,
          'pin': pin,
        }),
      );
      return response.statusCode == 201;
    } catch (e) { print('❌ addChildProfile: $e'); }
    return false;
  }

  Future<bool> verifyChildPin(String childId, String pin) async {
    try {
      final authToken = await _db!.getAuthToken();
      if (authToken == null) return false;
      final response = await http.post(
        Uri.parse('$_baseUrl/mentor/children/$childId/verify-pin'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({'pin': pin}),
      );
      if (response.statusCode == 200) {
        return (jsonDecode(response.body))['valid'] == true;
      }
    } catch (e) { print('❌ verifyChildPin: $e'); }
    return false;
  }

  // ========================= CMS (PUBLIC — no auth needed) =========================

  /// Fetches CMS content for a given key from GET /cms/:key.
  /// Keys: community | about | consultancy | legal_privacy | legal_terms | legal_child_safety
  Future<Map<String, dynamic>?> getCmsContent(String key) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/cms/$key'),
        headers: {'Content-Type': 'application/json'},
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return data['value'] as Map<String, dynamic>?;
      }
      print('⚠️  getCmsContent($key): ${response.statusCode}');
    } catch (e) {
      print('❌ getCmsContent($key): $e');
    }
    return null;
  }
}