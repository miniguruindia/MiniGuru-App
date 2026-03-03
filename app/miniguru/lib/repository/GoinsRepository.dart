// lib/repository/GoinsRepository.dart
import 'dart:convert';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/GoinTransaction.dart';
import 'package:miniguru/models/MaterialItem.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class GoinsRepository {
  final MiniguruApi _api = MiniguruApi();
  final DatabaseHelper _db = DatabaseHelper();

  // ──────────────────────────────────────────────────────────
  // MATERIALS
  // ──────────────────────────────────────────────────────────

  /// Fetch and cache materials from server, or return local cache
  Future<List<MaterialItem>> getMaterials({String? categoryId}) async {
    try {
      // 1. Try server
      final response = await _api.getMaterials(categoryId: categoryId);
      if (response != null && response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        final items = data.map((j) => MaterialItem.fromJson(j)).toList();
        await _db.cacheMaterials(items);
        return items;
      }
    } catch (e) {
      print('⚠️  Could not fetch materials from server: $e');
    }

    // 2. Fallback to local cache
    final cached = await _db.getCachedMaterials(categoryId: categoryId);
    if (cached.isNotEmpty) {
      print('📦 Using cached materials');
      return cached;
    }

    // 3. Fallback to hardcoded defaults so kids always have something to pick
    print('📦 Using default materials');
    return _defaultMaterials();
  }

  /// Fetch material categories
  Future<List<MaterialCategory>> getMaterialCategories() async {
    try {
      final response = await _api.getMaterialCategories();
      if (response != null && response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((j) => MaterialCategory.fromJson(j)).toList();
      }
    } catch (e) {
      print('⚠️  Could not fetch material categories: $e');
    }
    return _defaultCategories();
  }

  // ──────────────────────────────────────────────────────────
  // GOINS — BALANCE
  // ──────────────────────────────────────────────────────────

  /// Get current goins balance (server first, local fallback)
  Future<int> getGoinsBalance() async {
    try {
      final data = await _api.getGoinsBalance();
      if (data != null) {
        final balance = data['balance'] as int? ?? 0;
        await _db.cacheGoinsBalance(balance);
        return balance;
      }
    } catch (e) {
      print('⚠️  Could not fetch goins balance: $e');
    }
    return await _db.getCachedGoinsBalance();
  }

  // ──────────────────────────────────────────────────────────
  // GOINS — HISTORY
  // ──────────────────────────────────────────────────────────

  Future<List<GoinTransaction>> getGoinsHistory({int page = 1}) async {
    try {
      final response = await _api.getGoinsHistory(page: page);
      if (response != null && response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        final txns = data.map((j) => GoinTransaction.fromJson(j)).toList();
        if (page == 1) await _db.cacheGoinsHistory(txns);
        return txns;
      }
    } catch (e) {
      print('⚠️  Could not fetch goins history: $e');
    }
    return await _db.getCachedGoinsHistory();
  }

  // ──────────────────────────────────────────────────────────
  // GOINS — DEDUCTION (materials picked)
  // ──────────────────────────────────────────────────────────

  /// Deduct goins when materials are picked.
  /// Returns a DeductionResult with success, newBalance, and optional message.
  Future<DeductionResult> deductForMaterials({
    required String projectId,
    required List<PickedMaterial> pickedMaterials,
  }) async {
    final totalGoins = pickedMaterials.fold<int>(
      0,
      (sum, m) => sum + m.totalGoins,
    );

    if (totalGoins == 0) {
      return DeductionResult(
        success: true,
        newBalance: await getGoinsBalance(),
        deducted: 0,
      );
    }

    // 1. Check balance
    final balanceCheck = await _api.checkGoinsBalance(totalGoins);
    final currentBalance = balanceCheck?['balance'] as int? ?? 0;
    final sufficient = balanceCheck?['sufficient'] as bool? ?? false;

    if (!sufficient) {
      return DeductionResult(
        success: false,
        newBalance: currentBalance,
        deducted: 0,
        message:
            'Not enough Goins! You need $totalGoins but have $currentBalance.',
      );
    }

    // 2. Call API to deduct
    final materialsJson = pickedMaterials.map((m) => m.toJson()).toList();
    final result = await _api.deductGoinsForMaterials(
      projectId: projectId,
      materials: materialsJson,
      totalGoins: totalGoins,
    );

    if (result != null && result['success'] == true) {
      final newBalance =
          result['newBalance'] as int? ?? (currentBalance - totalGoins);
      await _db.cacheGoinsBalance(newBalance);

      // Log locally
      await _db.insertLocalGoinTransaction(
        GoinTransaction(
          id: 'local_${DateTime.now().millisecondsSinceEpoch}',
          type: GoinEventType.materialDeduction,
          amount: totalGoins,
          description: 'Materials for project $projectId',
          projectId: projectId,
          timestamp: DateTime.now(),
          balanceAfter: newBalance,
        ),
      );

      return DeductionResult(
        success: true,
        newBalance: newBalance,
        deducted: totalGoins,
      );
    }

    return DeductionResult(
      success: false,
      newBalance: currentBalance,
      deducted: 0,
      message: 'Server error. Please try again.',
    );
  }

  // ──────────────────────────────────────────────────────────
  // GOINS — AWARD (video uploaded)
  // ──────────────────────────────────────────────────────────

  /// Award 2× goins when a project video is uploaded
  Future<AwardResult> awardForVideoUpload({required String projectId}) async {
    final result =
        await _api.awardGoinsForVideoUpload(projectId: projectId);
    if (result != null && result['success'] == true) {
      final awarded = result['awarded'] as int? ?? 0;
      final newBalance = result['newBalance'] as int? ?? 0;
      await _db.cacheGoinsBalance(newBalance);

      await _db.insertLocalGoinTransaction(
        GoinTransaction(
          id: 'local_${DateTime.now().millisecondsSinceEpoch}',
          type: GoinEventType.videoUpload,
          amount: awarded,
          description: 'Video uploaded for project $projectId',
          projectId: projectId,
          timestamp: DateTime.now(),
          balanceAfter: newBalance,
        ),
      );

      return AwardResult(
        success: true,
        awarded: awarded,
        newBalance: newBalance,
      );
    }
    return AwardResult(success: false, awarded: 0, newBalance: 0);
  }

  // ──────────────────────────────────────────────────────────
  // HELPERS — Default fallback data (works with no internet)
  // ──────────────────────────────────────────────────────────

  List<MaterialCategory> _defaultCategories() => [
        const MaterialCategory(id: 'c1', name: 'Electronics', emoji: '🔋'),
        const MaterialCategory(id: 'c2', name: 'Mechanical', emoji: '⚙️'),
        const MaterialCategory(id: 'c3', name: 'Art & Craft', emoji: '🎨'),
        const MaterialCategory(id: 'c4', name: 'Sensors', emoji: '📡'),
        const MaterialCategory(id: 'c5', name: 'Structure', emoji: '🏗️'),
      ];

  List<MaterialItem> _defaultMaterials() => [
        // Electronics
        const MaterialItem(id: 'm1', name: 'LED (Red)', categoryId: 'c1', categoryName: 'Electronics', goinsPerUnit: 5, unit: 'piece'),
        const MaterialItem(id: 'm2', name: 'LED (Green)', categoryId: 'c1', categoryName: 'Electronics', goinsPerUnit: 5, unit: 'piece'),
        const MaterialItem(id: 'm3', name: 'Resistor 220Ω', categoryId: 'c1', categoryName: 'Electronics', goinsPerUnit: 3, unit: 'piece'),
        const MaterialItem(id: 'm4', name: 'Jumper Wires', categoryId: 'c1', categoryName: 'Electronics', goinsPerUnit: 2, unit: 'piece'),
        const MaterialItem(id: 'm5', name: 'Arduino Uno', categoryId: 'c1', categoryName: 'Electronics', goinsPerUnit: 80, unit: 'piece'),
        const MaterialItem(id: 'm6', name: '9V Battery', categoryId: 'c1', categoryName: 'Electronics', goinsPerUnit: 15, unit: 'piece'),
        const MaterialItem(id: 'm7', name: 'Breadboard', categoryId: 'c1', categoryName: 'Electronics', goinsPerUnit: 25, unit: 'piece'),
        // Mechanical
        const MaterialItem(id: 'm8', name: 'DC Motor', categoryId: 'c2', categoryName: 'Mechanical', goinsPerUnit: 30, unit: 'piece'),
        const MaterialItem(id: 'm9', name: 'Servo Motor', categoryId: 'c2', categoryName: 'Mechanical', goinsPerUnit: 45, unit: 'piece'),
        const MaterialItem(id: 'm10', name: 'Bolt M3', categoryId: 'c2', categoryName: 'Mechanical', goinsPerUnit: 2, unit: 'piece'),
        const MaterialItem(id: 'm11', name: 'Rubber Band', categoryId: 'c2', categoryName: 'Mechanical', goinsPerUnit: 1, unit: 'piece'),
        // Art & Craft
        const MaterialItem(id: 'm12', name: 'Cardboard Sheet', categoryId: 'c3', categoryName: 'Art & Craft', goinsPerUnit: 5, unit: 'sheet'),
        const MaterialItem(id: 'm13', name: 'Acrylic Paint', categoryId: 'c3', categoryName: 'Art & Craft', goinsPerUnit: 8, unit: 'ml'),
        const MaterialItem(id: 'm14', name: 'Craft Sticks', categoryId: 'c3', categoryName: 'Art & Craft', goinsPerUnit: 1, unit: 'piece'),
        const MaterialItem(id: 'm15', name: 'Foam Sheet', categoryId: 'c3', categoryName: 'Art & Craft', goinsPerUnit: 6, unit: 'sheet'),
        // Sensors
        const MaterialItem(id: 'm16', name: 'Temperature Sensor', categoryId: 'c4', categoryName: 'Sensors', goinsPerUnit: 20, unit: 'piece'),
        const MaterialItem(id: 'm17', name: 'Ultrasonic Sensor', categoryId: 'c4', categoryName: 'Sensors', goinsPerUnit: 35, unit: 'piece'),
        const MaterialItem(id: 'm18', name: 'Light Sensor (LDR)', categoryId: 'c4', categoryName: 'Sensors', goinsPerUnit: 10, unit: 'piece'),
        // Structure
        const MaterialItem(id: 'm19', name: 'PVC Pipe 1ft', categoryId: 'c5', categoryName: 'Structure', goinsPerUnit: 10, unit: 'piece'),
        const MaterialItem(id: 'm20', name: 'Wooden Block', categoryId: 'c5', categoryName: 'Structure', goinsPerUnit: 8, unit: 'piece'),
      ];
}

// ─── Result classes ───────────────────────────────────────────────────────────

class DeductionResult {
  final bool success;
  final int newBalance;
  final int deducted;
  final String? message;

  DeductionResult({
    required this.success,
    required this.newBalance,
    required this.deducted,
    this.message,
  });
}

class AwardResult {
  final bool success;
  final int awarded;
  final int newBalance;

  AwardResult({
    required this.success,
    required this.awarded,
    required this.newBalance,
  });
}