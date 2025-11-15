class Product {
  final String id;
  final String name;
  final String description;
  final double price;
  final int inventory;
  final String categoryId;
  final String images;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String category;

  Product({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.inventory,
    required this.categoryId,
    required this.images,
    required this.createdAt,
    required this.updatedAt,
    required this.category,
  });

  factory Product.fromJsonRemote(Map<String, dynamic> json) {
    String category = json['category']['name'];
    return Product(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      price: double.parse(json['price'].toString()),
      category: category.toString(),
      inventory: json['inventory'] as int,
      categoryId: json['categoryId'],
      images: json['images'][0] as String,
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }

  factory Product.fromJsonLocal(Map<String, dynamic> json) {
    String category = json['category'];
    return Product(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      price: json['price'] as double,
      category: category.toString(),
      inventory: json['inventory'] as int,
      categoryId: json['categoryId'],
      images: json['images'] as String,
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'price': price,
      'inventory': inventory,
      'categoryId': categoryId,
      'images': images,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'category': category,
    };
  }
}
