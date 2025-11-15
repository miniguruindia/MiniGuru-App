import 'dart:convert';

import 'package:miniguru/models/AuthToken.dart';
import 'package:miniguru/models/Draft.dart';
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

  DatabaseHelper._internal();

  factory DatabaseHelper() {
    return _instance;
  }

  Future<Database> get database async {
    if (_database != null) return _database!;

    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'miniguru.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
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

        //Create ProjectCategory Table
        await db.execute('''
        CREATE TABLE IF NOT EXISTS project_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon INTEGER NOT NULL
)
        ''');

        //Create Product Table
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

        //Create product categories
        await db.execute('''
      CREATE TABLE IF NOT EXISTS ProductCategories (
        id TEXT PRIMARY KEY,
        name TEXT,
        icon TEXT
      )
    ''');

        //For cart
        await db.execute(
          'CREATE TABLE IF NOT EXISTS cart(id TEXT PRIMARY KEY, name TEXT, price REAL, quantity INTEGER)',
        );

        //For orders
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

        //For drafts
        await db.execute(
          '''
          CREATE TABLE IF NOT EXISTS drafts(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            startDate TEXT,
            endDate TEXT,
            category TEXT NOT NULL,
            materials TEXT
          )
          ''',
        );
      },
    );
  }

  Future<bool> hasTokenExpired() async {
    final authToken = await getAuthToken();

    if (authToken != null) {
      int expiresIn = authToken.expiresIn;
      int currentTime = DateTime.now().millisecondsSinceEpoch ~/ 1000;

      // If currentTime is greater than or equal to expiresIn, the token has expired
      return currentTime >= expiresIn;
    }
    // If no token is found, consider it expired
    return true;
  }

  Future<void> insertAuthToken(String accessToken, String refreshToken) async {
    final db = await database;

    // Calculate the expiresIn value (3600 seconds + current time in seconds)
    int expiresIn = DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600;
    AuthToken token = AuthToken(
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresIn: expiresIn);

    // Insert data into the authToken table
    await db.insert(
      'authToken',
      token.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace, // Replace if exists
    );
  }

  Future<AuthToken?> getAuthToken() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('authToken');
    if (maps.isNotEmpty) {
      return AuthToken.fromMap(maps.first);
    }
    return null;
  }

  Future<void> insertUserData(User user) async {
    final db = await database;
    await db.insert('user', user.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<User?> getUserData() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('user');
    if (maps.isNotEmpty) {
      return User.fromMap(maps.first);
    }
    return null;
  }

  Future<void> insertProject(Project project) async {
    // Insert the Project into the 'projects' table
    final db = await database;

    await db.insert(
      'projects',
      project.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Project>> getProjects() async {
    final db = await database;
    // Fetch all projects
    final List<Map<String, dynamic>> projectMaps = await db.query('projects');

    // Create a list to hold the result
    List<Project> projects = [];

    for (var projectMap in projectMaps) {
      // Construct the Project object with the video and materials
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
        // Associated video object
        userId: projectMap['userId'],
        materials: projectMap['materials'],
        // List of associated materials
        createdAt: DateTime.parse(projectMap['createdAt']),
        updatedAt: DateTime.parse(projectMap['updatedAt']),
      ));
    }

    return projects;
  }

  Future<void> deleteProject() async {
    final db = await database;
    await db.delete('projects');
  }

  Future<void> insertProjectCategory(ProjectCategory category) async {
    final db = await database;
    await db.insert(
      'project_category',
      category.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Project>> getProjectsByQuery(String query) async {
    final db = await database; // Assuming you have a database getter

    // Query the projects table with a LIKE search on title or description
    final List<Map<String, dynamic>> projectMaps = await db.query(
      'projects',
      where: 'title LIKE ? OR description LIKE ?',
      whereArgs: ['%$query%', '%$query%'], // Wildcard search
    );

    // Create a list to hold the result
    List<Project> projects = [];

    for (var projectMap in projectMaps) {
      // Construct the Project object with the video and materials
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

  Future<List<ProjectCategory>> getProjectCategories() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('project_category');

    return List.generate(maps.length, (i) {
      return ProjectCategory.fromMap(maps[i]);
    });
  }

  Future<void> deleteProjectCategories() async {
    final db = await database;
    await db.delete('project_category');
  }

  // Insert a product into the database
  Future<void> insertProduct(Product product) async {
    final db = await database;
    await db.insert(
      'Products',
      product.toJson(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Get all products from the database
  Future<List<Product>> getProducts() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('Products');

    return List.generate(maps.length, (i) {
      return Product.fromJsonLocal(maps[i]);
    });
  }

  // Delete all products from the database
  Future<void> deleteProducts() async {
    final db = await database;
    await db.delete('Products');
  }

  // Insert a product category into the database
  Future<void> insertProductCategory(ProductCategory category) async {
    final db = await database;
    await db.insert(
      'ProductCategories',
      category.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Get all product categories from the database
  Future<List<ProductCategory>> getProductCategories() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('ProductCategories');

    return List.generate(maps.length, (i) {
      return ProductCategory.fromMap(maps[i]);
    });
  }

  // Delete all product categories from the database
  Future<void> deleteProductCategories() async {
    final db = await database;
    await db.delete('ProductCategories');
  }

  Future<Product?> getProductById(String productId) async {
    final List<Map<String, dynamic>> maps = await _database!.query(
      'Products',
      where: 'id = ?',
      whereArgs: [productId],
    );

    if (maps.isNotEmpty) {
      return Product.fromJsonLocal(maps.first);
    } else {
      return null;
    }
  }

  // Query products by name or description
  Future<List<Product>> getProductsByQuery(String query) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'Products',
      where: 'name LIKE ? OR description LIKE ?',
      whereArgs: ['%$query%', '%$query%'],
    );

    return List.generate(maps.length, (i) {
      return Product.fromJsonLocal(maps[i]);
    });
  }

  //Query all data in cart
  Future<List<Map<String, dynamic>>> getAllCartItems() async {
    if (_database != null) {
      return await _database!.query('cart');
    }
    return [];
  }

  // Get item quantity from the cart
  Future<int> getItemQuantity(String productId) async {
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

  // Add item to the cart or increase the quantity
  Future<void> addToCart(String productId, String name, double price) async {
    int currentQuantity = await getItemQuantity(productId);

    if (currentQuantity == 0) {
      await _database!.insert(
        'cart',
        {
          'id': productId,
          'name': name,
          'price': price,
          'quantity': 1,
        },
      );
    } else {
      await _database!.update(
        'cart',
        {'quantity': currentQuantity + 1},
        where: 'id = ?',
        whereArgs: [productId],
      );
    }
  }

  // Remove item from the cart or decrease the quantity
  Future<void> removeFromCart(String productId) async {
    int currentQuantity = await getItemQuantity(productId);

    if (currentQuantity > 1) {
      await _database!.update(
        'cart',
        {'quantity': currentQuantity - 1},
        where: 'id = ?',
        whereArgs: [productId],
      );
    } else {
      await _database!.delete(
        'cart',
        where: 'id = ?',
        whereArgs: [productId],
      );
    }
  }

  // Clear the cart for a product (if needed)
  Future<void> clearItemFromCart(String productId) async {
    await _database!.delete(
      'cart',
      where: 'id = ?',
      whereArgs: [productId],
    );
  }

  //Remove the entire cart
  Future<void> clearCart() async {
    final db = await database;
    db.delete('cart');
  }

  // Insert an order into the database
  Future<void> insertOrder(Order order) async {
    final db = await database;
    await db.insert(
      'orders',
      order.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

// Get all orders from the database
  Future<List<Order>> getOrders() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('orders');

    return List.generate(maps.length, (i) {
      return Order.fromMap(maps[i]);
    }).reversed.toList();
  }

  //Get all orders by payment Status
  Future<List<Order>> getOrdersByStatus(String status) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'orders',
      where: 'paymentStatus = ?',
      whereArgs: [status.toUpperCase()],
    );

    return List.generate(maps.length, (i) {
      return Order.fromMap(maps[i]);
    }).reversed.toList();
  }

  //Get all orders by payment Status
  Future<Order?> getOrdersById(String id) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'orders',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (maps.isNotEmpty) {
      return Order.fromMap(maps.first);
    } else {
      return null;
    }
  }

  //Remove all orders
  Future<void> clearOrders() async {
    final db = await database;
    db.delete('orders');
  }

  Future<int> insertDraft(Draft draft) async {
    final db = await database;
    int id = await db.insert(
      'drafts',
      draft.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return id;
  }

  Future<List<Draft>> drafts() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('drafts');

    return List.generate(maps.length, (i) {
      return Draft.fromMap(maps[i]);
    });
  }

  Future<void> updateDraft(Draft draft) async {
    final db = await database;
    await db.update(
      'drafts',
      draft.toMap(),
      where: 'id = ?',
      whereArgs: [draft.id],
    );
  }

  Future<void> deleteDraft(int id) async {
    final db = await database;
    await db.delete(
      'drafts',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<Draft?> getDraftById(int id) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'drafts',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (maps.isNotEmpty) {
      return Draft.fromMap(maps.first);
    } else {
      return null;
    }
  }

  Future<void> clearAllTables() async {
    final db = await database;

    // List of table names to be cleared
    final tables = [
      'authToken',
      'user',
      'projects',
      'video',
      'materials',
      'project_category',
      'Products',
      'ProductCategories',
      'cart',
      'orders',
      'drafts'
    ];

    Batch batch = db.batch();

    for (String table in tables) {
      batch.execute('DELETE FROM $table');
    }

    await batch.commit(noResult: true);
    await db.execute('VACUUM');
  }
}
