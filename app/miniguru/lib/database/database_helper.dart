// lib/database/database_helper.dart

import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:miniguru/models/AuthToken.dart';
import 'package:miniguru/models/Draft.dart';
import 'package:miniguru/models/GoinTransaction.dart';
import 'package:miniguru/models/MaterialItem.dart';
import 'package:miniguru/models/Order.dart';
import 'package:miniguru/models/Product.dart';
import 'package:miniguru/models/ProductCategory.dart';
import 'package:miniguru/models/ProjectCategory.dart';
import 'package:miniguru/models/Projects.dart';
import 'package:miniguru/models/User.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  static Database? _database;

  // WEB STORAGE: In-memory storage for web platform (NOT used for auth token — see below)
  static final Map<String, dynamic> _webStorage = {
    'user': null,
    'projects': <Project>[],
    'project_category': <ProjectCategory>[],
    'Products': <Product>[],
    'ProductCategories': <ProductCategory>[],
    'cart': <Map<String, dynamic>>[],
    'orders': <Order>[],
    'drafts': <Draft>[],
    // ── Goins additions ──
    'materials': <MaterialItem>[],
    'goins_transactions': <GoinTransaction>[],
    'goins_balance': 500, // starter balance shown until server responds
  };

  DatabaseHelper._internal();

  factory DatabaseHelper() {
    return _instance;
  }

  Future<Database?> get database async {
    if (kIsWeb) {
      print('🌐 Running on WEB - using in-memory storage');
      return null;
    }

    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    if (kIsWeb) {
      throw Exception('SQLite not supported on web platform');
    }

    String path = join(await getDatabasesPath(), 'miniguru.db');
    return await openDatabase(
      path,
      version: 2,
      onCreate: (db, version) async {
        await _createAllTables(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await _createGoinsTables(db);
        }
      },
    );
  }

  Future<void> _createAllTables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS authToken (
        id INTEGER PRIMARY KEY,
        accessToken TEXT,
        refreshToken TEXT,
        expiresIn INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        age INTEGER,
        score INTEGER,
        walletBalance DOUBLE,
        scoreHistory TEXT,
        phoneNumber TEXT,
        totalProjects INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        author TEXT,
        startDate TEXT,
        comments TEXT,
        endDate TEXT,
        materials TEXT,
        thumbnail TEXT,
        video TEXT,
        userId TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS project_category (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon INTEGER NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS Products (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        price REAL,
        category TEXT,
        inventory INTEGER,
        categoryId TEXT,
        images TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS ProductCategories (
        id TEXT PRIMARY KEY,
        name TEXT,
        icon TEXT
      )
    ''');
    await db.execute(
      'CREATE TABLE IF NOT EXISTS cart(id TEXT PRIMARY KEY, name TEXT, price REAL, quantity INTEGER)',
    );
    await db.execute('''
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        userId TEXT,
        totalAmount REAL,
        paymentStatus TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        products TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS drafts(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        startDate TEXT,
        endDate TEXT,
        category TEXT NOT NULL,
        materials TEXT
      )
    ''');
    await _createGoinsTables(db);
  }

  Future<void> _createGoinsTables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        categoryId TEXT,
        categoryName TEXT,
        goinsPerUnit INTEGER NOT NULL,
        unit TEXT,
        imageUrl TEXT,
        isAvailable INTEGER DEFAULT 1
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS goins_transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT,
        projectId TEXT,
        videoId TEXT,
        timestamp TEXT,
        balanceAfter INTEGER
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS goins_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    ''');
  }

  // ==================== AUTH TOKEN ====================
  // ✅ FIXED: Uses SharedPreferences on web so token survives page refresh.
  //           Old code used _webStorage (in-memory) which wiped on every reload → 401.

  Future<bool> hasTokenExpired() async {
    final authToken = await getAuthToken();
    if (authToken != null) {
      int expiresIn = authToken.expiresIn;
      int currentTime = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      return currentTime >= expiresIn;
    }
    return true;
  }

  Future<void> insertAuthToken(String accessToken, String refreshToken) async {
    int expiresIn = DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600;
    AuthToken token = AuthToken(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: expiresIn,
    );

    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('authToken', jsonEncode(token.toMap()));
      print('💾 [WEB] Token saved to SharedPreferences (persists on reload)');
      return;
    }

    final db = await database;
    await db?.insert('authToken', token.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<AuthToken?> getAuthToken() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      final tokenJson = prefs.getString('authToken');
      if (tokenJson == null) return null;
      return AuthToken.fromMap(jsonDecode(tokenJson));
    }

    final db = await database;
    final List<Map<String, dynamic>> maps = await db?.query('authToken') ?? [];
    if (maps.isNotEmpty) {
      return AuthToken.fromMap(maps.first);
    }
    return null;
  }

  Future<void> deleteAuthToken() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('authToken');
      print('🗑️ [WEB] Auth token deleted from SharedPreferences');
      return;
    }

    final db = await database;
    await db?.delete('authToken');
    print('🗑️ Auth token deleted from database');
  }

  // ==================== USER DATA ====================

  Future<void> insertUserData(User user) async {
    if (kIsWeb) {
      _webStorage['user'] = user.toMap();
      print('💾 [WEB] User data saved');
      return;
    }

    final db = await database;
    await db?.insert('user', user.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<User?> getUserData() async {
    if (kIsWeb) {
      final userMap = _webStorage['user'];
      if (userMap == null) return null;
      return User.fromMap(userMap);
    }

    final db = await database;
    final List<Map<String, dynamic>> maps = await db?.query('user') ?? [];
    if (maps.isNotEmpty) {
      return User.fromMap(maps.first);
    }
    return null;
  }

  // ==================== PROJECTS ====================

  Future<void> insertProject(Project project) async {
    if (kIsWeb) {
      final projects = _webStorage['projects'] as List<Project>;
      projects.removeWhere((p) => p.id == project.id);
      projects.add(project);
      print('💾 [WEB] Project saved');
      return;
    }

    final db = await database;
    await db?.insert('projects', project.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Project>> getProjects() async {
    if (kIsWeb) {
      return _webStorage['projects'] as List<Project>;
    }

    final db = await database;
    final List<Map<String, dynamic>> projectMaps =
        await db?.query('projects') ?? [];

    List<Project> projects = [];
    for (var projectMap in projectMaps) {
      projects.add(Project(
        id: projectMap['id'],
        title: projectMap['title'],
        description: projectMap['description'],
        category: projectMap['category'],
        author: projectMap['author'],
        comments: projectMap['comments'],
        startDate: DateTime.parse(projectMap['startDate']),
        endDate: DateTime.parse(projectMap['endDate']),
        thumbnail: projectMap['thumbnail'],
        video: jsonDecode(projectMap['video']),
        userId: projectMap['userId'],
        materials: projectMap['materials'],
        createdAt: DateTime.parse(projectMap['createdAt']),
        updatedAt: DateTime.parse(projectMap['updatedAt']),
      ));
    }
    return projects;
  }

  Future<void> deleteProject() async {
    if (kIsWeb) {
      (_webStorage['projects'] as List).clear();
      return;
    }

    final db = await database;
    await db?.delete('projects');
  }

  Future<List<Project>> getProjectsByQuery(String query) async {
    if (kIsWeb) {
      final projects = _webStorage['projects'] as List<Project>;
      return projects
          .where((p) =>
              p.title.toLowerCase().contains(query.toLowerCase()) ||
              p.description.toLowerCase().contains(query.toLowerCase()))
          .toList();
    }

    final db = await database;
    final List<Map<String, dynamic>> projectMaps = await db?.query(
          'projects',
          where: 'title LIKE ? OR description LIKE ?',
          whereArgs: ['%$query%', '%$query%'],
        ) ??
        [];

    List<Project> projects = [];
    for (var projectMap in projectMaps) {
      projects.add(Project(
        id: projectMap['id'],
        title: projectMap['title'],
        description: projectMap['description'],
        startDate: DateTime.parse(projectMap['startDate']),
        endDate: DateTime.parse(projectMap['endDate']),
        thumbnail: projectMap['thumbnail'],
        video: projectMap['video'],
        comments: projectMap['comments'],
        author: projectMap['author'],
        category: projectMap['category'],
        userId: projectMap['userId'],
        materials: projectMap['materials'],
        createdAt: DateTime.parse(projectMap['createdAt']),
        updatedAt: DateTime.parse(projectMap['updatedAt']),
      ));
    }
    return projects;
  }

  // ==================== PROJECT CATEGORIES ====================

  Future<void> insertProjectCategory(ProjectCategory category) async {
    if (kIsWeb) {
      final categories =
          _webStorage['project_category'] as List<ProjectCategory>;
      categories.removeWhere((c) => c.id == category.id);
      categories.add(category);
      return;
    }

    final db = await database;
    await db?.insert('project_category', category.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<ProjectCategory>> getProjectCategories() async {
    if (kIsWeb) {
      return _webStorage['project_category'] as List<ProjectCategory>;
    }

    final db = await database;
    final List<Map<String, dynamic>> maps =
        await db?.query('project_category') ?? [];
    return List.generate(maps.length, (i) => ProjectCategory.fromMap(maps[i]));
  }

  Future<void> deleteProjectCategories() async {
    if (kIsWeb) {
      (_webStorage['project_category'] as List).clear();
      return;
    }

    final db = await database;
    await db?.delete('project_category');
  }

  // ==================== PRODUCTS ====================

  Future<void> insertProduct(Product product) async {
    if (kIsWeb) {
      final products = _webStorage['Products'] as List<Product>;
      products.removeWhere((p) => p.id == product.id);
      products.add(product);
      return;
    }

    final db = await database;
    await db?.insert('Products', product.toJson(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Product>> getProducts() async {
    if (kIsWeb) {
      return _webStorage['Products'] as List<Product>;
    }

    final db = await database;
    final List<Map<String, dynamic>> maps = await db?.query('Products') ?? [];
    return List.generate(maps.length, (i) => Product.fromJsonLocal(maps[i]));
  }

  Future<void> deleteProducts() async {
    if (kIsWeb) {
      (_webStorage['Products'] as List).clear();
      return;
    }

    final db = await database;
    await db?.delete('Products');
  }

  Future<Product?> getProductById(String productId) async {
    if (kIsWeb) {
      final products = _webStorage['Products'] as List<Product>;
      try {
        return products.firstWhere((p) => p.id == productId);
      } catch (e) {
        return null;
      }
    }

    final List<Map<String, dynamic>> maps = await _database?.query(
          'Products',
          where: 'id = ?',
          whereArgs: [productId],
        ) ??
        [];

    if (maps.isNotEmpty) {
      return Product.fromJsonLocal(maps.first);
    }
    return null;
  }

  Future<List<Product>> getProductsByQuery(String query) async {
    if (kIsWeb) {
      final products = _webStorage['Products'] as List<Product>;
      return products
          .where((p) =>
              p.name.toLowerCase().contains(query.toLowerCase()) ||
              p.description.toLowerCase().contains(query.toLowerCase()))
          .toList();
    }

    final db = await database;
    final List<Map<String, dynamic>> maps = await db?.query(
          'Products',
          where: 'name LIKE ? OR description LIKE ?',
          whereArgs: ['%$query%', '%$query%'],
        ) ??
        [];
    return List.generate(maps.length, (i) => Product.fromJsonLocal(maps[i]));
  }

  // ==================== PRODUCT CATEGORIES ====================

  Future<void> insertProductCategory(ProductCategory category) async {
    if (kIsWeb) {
      final categories =
          _webStorage['ProductCategories'] as List<ProductCategory>;
      categories.removeWhere((c) => c.id == category.id);
      categories.add(category);
      return;
    }

    final db = await database;
    await db?.insert('ProductCategories', category.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<ProductCategory>> getProductCategories() async {
    if (kIsWeb) {
      return _webStorage['ProductCategories'] as List<ProductCategory>;
    }

    final db = await database;
    final List<Map<String, dynamic>> maps =
        await db?.query('ProductCategories') ?? [];
    return List.generate(maps.length, (i) => ProductCategory.fromMap(maps[i]));
  }

  Future<void> deleteProductCategories() async {
    if (kIsWeb) {
      (_webStorage['ProductCategories'] as List).clear();
      return;
    }

    final db = await database;
    await db?.delete('ProductCategories');
  }

  // ==================== CART ====================

  Future<List<Map<String, dynamic>>> getAllCartItems() async {
    if (kIsWeb) {
      return List<Map<String, dynamic>>.from(_webStorage['cart']);
    }

    if (_database != null) {
      return await _database!.query('cart');
    }
    return [];
  }

  Future<int> getItemQuantity(String productId) async {
    if (kIsWeb) {
      final cart = _webStorage['cart'] as List<Map<String, dynamic>>;
      try {
        final item = cart.firstWhere((item) => item['id'] == productId);
        return item['quantity'] as int;
      } catch (e) {
        return 0;
      }
    }

    if (_database != null) {
      final result = await _database!.query(
        'cart',
        where: 'id = ?',
        whereArgs: [productId],
      );
      if (result.isNotEmpty) {
        return result.first['quantity'] as int;
      }
    }
    return 0;
  }

  Future<void> addToCart(String productId, String name, double price) async {
    int currentQuantity = await getItemQuantity(productId);

    if (kIsWeb) {
      final cart = _webStorage['cart'] as List<Map<String, dynamic>>;
      if (currentQuantity == 0) {
        cart.add(
            {'id': productId, 'name': name, 'price': price, 'quantity': 1});
      } else {
        final item = cart.firstWhere((item) => item['id'] == productId);
        item['quantity'] = currentQuantity + 1;
      }
      return;
    }

    if (currentQuantity == 0) {
      await _database?.insert('cart', {
        'id': productId,
        'name': name,
        'price': price,
        'quantity': 1,
      });
    } else {
      await _database?.update(
        'cart',
        {'quantity': currentQuantity + 1},
        where: 'id = ?',
        whereArgs: [productId],
      );
    }
  }

  Future<void> removeFromCart(String productId) async {
    int currentQuantity = await getItemQuantity(productId);

    if (kIsWeb) {
      final cart = _webStorage['cart'] as List<Map<String, dynamic>>;
      if (currentQuantity > 1) {
        final item = cart.firstWhere((item) => item['id'] == productId);
        item['quantity'] = currentQuantity - 1;
      } else {
        cart.removeWhere((item) => item['id'] == productId);
      }
      return;
    }

    if (currentQuantity > 1) {
      await _database?.update(
        'cart',
        {'quantity': currentQuantity - 1},
        where: 'id = ?',
        whereArgs: [productId],
      );
    } else {
      await _database
          ?.delete('cart', where: 'id = ?', whereArgs: [productId]);
    }
  }

  Future<void> clearItemFromCart(String productId) async {
    if (kIsWeb) {
      final cart = _webStorage['cart'] as List<Map<String, dynamic>>;
      cart.removeWhere((item) => item['id'] == productId);
      return;
    }

    await _database?.delete('cart', where: 'id = ?', whereArgs: [productId]);
  }

  Future<void> clearCart() async {
    if (kIsWeb) {
      (_webStorage['cart'] as List).clear();
      return;
    }

    final db = await database;
    db?.delete('cart');
  }

  // ==================== ORDERS ====================

  Future<void> insertOrder(Order order) async {
    if (kIsWeb) {
      final orders = _webStorage['orders'] as List<Order>;
      orders.add(order);
      return;
    }

    final db = await database;
    await db?.insert('orders', order.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Order>> getOrders() async {
    if (kIsWeb) {
      return (_webStorage['orders'] as List<Order>).reversed.toList();
    }

    final db = await database;
    final List<Map<String, dynamic>> maps = await db?.query('orders') ?? [];
    return List.generate(maps.length, (i) => Order.fromMap(maps[i]))
        .reversed
        .toList();
  }

  Future<List<Order>> getOrdersByStatus(String status) async {
    if (kIsWeb) {
      final orders = _webStorage['orders'] as List<Order>;
      return orders
          .where((o) => o.paymentStatus.toUpperCase() == status.toUpperCase())
          .toList()
          .reversed
          .toList();
    }

    final db = await database;
    final List<Map<String, dynamic>> maps = await db?.query(
          'orders',
          where: 'paymentStatus = ?',
          whereArgs: [status.toUpperCase()],
        ) ??
        [];
    return List.generate(maps.length, (i) => Order.fromMap(maps[i]))
        .reversed
        .toList();
  }

  Future<Order?> getOrdersById(String id) async {
    if (kIsWeb) {
      final orders = _webStorage['orders'] as List<Order>;
      try {
        return orders.firstWhere((o) => o.id == id);
      } catch (e) {
        return null;
      }
    }

    final db = await database;
    final List<Map<String, dynamic>> maps = await db?.query(
          'orders',
          where: 'id = ?',
          whereArgs: [id],
        ) ??
        [];

    if (maps.isNotEmpty) {
      return Order.fromMap(maps.first);
    }
    return null;
  }

  Future<void> clearOrders() async {
    if (kIsWeb) {
      (_webStorage['orders'] as List).clear();
      return;
    }

    final db = await database;
    db?.delete('orders');
  }

  // ==================== DRAFTS ====================

  Future<int> insertDraft(Draft draft) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getStringList('drafts') ?? [];
      final existing = stored.map((s) => Draft.fromJson(jsonDecode(s))).toList();
      final newId = existing.isEmpty ? 1 : existing.map((d) => d.id ?? 0).reduce((a, b) => a > b ? a : b) + 1;
      draft.id = newId;
      existing.add(draft);
      await prefs.setStringList('drafts', existing.map((d) => jsonEncode(d.toJson())).toList());
      return newId;
    }
    final db = await database;
    return await db?.insert('drafts', draft.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace) ?? 0;
  }

  Future<List<Draft>> drafts() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getStringList('drafts') ?? [];
      return stored.map((s) => Draft.fromJson(jsonDecode(s))).toList();
    }
    final db = await database;
    final maps = await db?.query('drafts') ?? [];
    return List.generate(maps.length, (i) => Draft.fromMap(maps[i]));
  }

  Future<void> updateDraft(Draft draft) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getStringList('drafts') ?? [];
      final existing = stored.map((s) => Draft.fromJson(jsonDecode(s))).toList();
      final idx = existing.indexWhere((d) => d.id == draft.id);
      if (idx != -1) existing[idx] = draft;
      await prefs.setStringList('drafts', existing.map((d) => jsonEncode(d.toJson())).toList());
      return;
    }
    final db = await database;
    await db?.update('drafts', draft.toMap(),
        where: 'id = ?', whereArgs: [draft.id]);
  }

  Future<void> deleteDraft(int id) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getStringList('drafts') ?? [];
      final existing = stored.map((s) => Draft.fromJson(jsonDecode(s))).toList();
      existing.removeWhere((d) => d.id == id);
      await prefs.setStringList('drafts', existing.map((d) => jsonEncode(d.toJson())).toList());
      return;
    }
    final db = await database;
    await db?.delete('drafts', where: 'id = ?', whereArgs: [id]);
  }

  Future<Draft?> getDraftById(int id) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getStringList('drafts') ?? [];
      final existing = stored.map((s) => Draft.fromJson(jsonDecode(s))).toList();
      try {
        return existing.firstWhere((d) => d.id == id);
      } catch (_) {
        return null;
      }
    }
    final db = await database;
    final maps = await db?.query('drafts', where: 'id = ?', whereArgs: [id]) ?? [];
    return maps.isNotEmpty ? Draft.fromMap(maps.first) : null;
  }

  // ==================== MATERIALS CACHE ====================

  Future<void> cacheMaterials(List<MaterialItem> items) async {
    if (kIsWeb) {
      _webStorage['materials'] = items;
      return;
    }
    final db = await database;
    final batch = db!.batch();
    batch.delete('materials');
    for (final item in items) {
      batch.insert('materials', item.toMap(),
          conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<MaterialItem>> getCachedMaterials({String? categoryId}) async {
    if (kIsWeb) {
      final all = (_webStorage['materials'] as List).cast<MaterialItem>();
      if (categoryId != null) {
        return all.where((m) => m.categoryId == categoryId).toList();
      }
      return all;
    }
    final db = await database;
    final maps = categoryId != null
        ? await db?.query('materials',
                where: 'categoryId = ?', whereArgs: [categoryId]) ??
            []
        : await db?.query('materials') ?? [];
    return maps.map((m) => MaterialItem.fromLocalMap(m)).toList();
  }

  // ==================== GOINS BALANCE CACHE ====================

  Future<void> cacheGoinsBalance(int balance) async {
    if (kIsWeb) {
      _webStorage['goins_balance'] = balance;
      return;
    }
    final db = await database;
    await db?.insert(
      'goins_meta',
      {'key': 'balance', 'value': balance.toString()},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<int> getCachedGoinsBalance() async {
    if (kIsWeb) {
      return _webStorage['goins_balance'] as int? ?? 0;
    }
    final db = await database;
    final rows = await db?.query(
          'goins_meta',
          where: 'key = ?',
          whereArgs: ['balance'],
        ) ??
        [];
    if (rows.isNotEmpty) {
      return int.tryParse(rows.first['value'].toString()) ?? 0;
    }
    return 0;
  }

  // ==================== GOINS TRANSACTION LOG ====================

  Future<void> insertLocalGoinTransaction(GoinTransaction txn) async {
    if (kIsWeb) {
      final list =
          (_webStorage['goins_transactions'] as List).cast<GoinTransaction>();
      list.insert(0, txn);
      return;
    }
    final db = await database;
    await db?.insert(
      'goins_transactions',
      txn.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<GoinTransaction>> getCachedGoinsHistory() async {
    if (kIsWeb) {
      return (_webStorage['goins_transactions'] as List)
          .cast<GoinTransaction>();
    }
    final db = await database;
    final maps = await db?.query(
          'goins_transactions',
          orderBy: 'timestamp DESC',
          limit: 50,
        ) ??
        [];
    return maps.map((m) => GoinTransaction.fromLocalMap(m)).toList();
  }

  Future<void> cacheGoinsHistory(List<GoinTransaction> txns) async {
    if (kIsWeb) {
      _webStorage['goins_transactions'] = txns;
      return;
    }
    final db = await database;
    final batch = db!.batch();
    batch.delete('goins_transactions');
    for (final t in txns) {
      batch.insert('goins_transactions', t.toMap(),
          conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  // ==================== CLEAR ALL ====================

  Future<void> clearAllTables() async {
    if (kIsWeb) {
      // ✅ Also clear auth token from SharedPreferences on logout
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('authToken');
      await prefs.remove('drafts');

      _webStorage['user'] = null;
      (_webStorage['projects'] as List).clear();
      (_webStorage['project_category'] as List).clear();
      (_webStorage['Products'] as List).clear();
      (_webStorage['ProductCategories'] as List).clear();
      (_webStorage['cart'] as List).clear();
      (_webStorage['orders'] as List).clear();
      (_webStorage['drafts'] as List).clear();
      (_webStorage['materials'] as List).clear();
      (_webStorage['goins_transactions'] as List).clear();
      _webStorage['goins_balance'] = 500;
      print('🗑️  [WEB] All data cleared');
      return;
    }

    final db = await database;
    final tables = [
      'authToken',
      'user',
      'projects',
      'project_category',
      'Products',
      'ProductCategories',
      'cart',
      'orders',
      'drafts',
      'materials',
      'goins_transactions',
      'goins_meta',
    ];

    Batch batch = db!.batch();
    for (String table in tables) {
      batch.execute('DELETE FROM $table');
    }
    await batch.commit(noResult: true);
    await db.execute('VACUUM');
  }
}