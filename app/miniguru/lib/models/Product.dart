class Product {
  final String id;
  final String name;
  final String description;
  final String? brand;
  final String? size;
  final String? howToUse;
  final double price;
  final int inventory;
  final String categoryId;
  final List<String> imageList;
  final String images;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String category;

  Product({
    required this.id,
    required this.name,
    required this.description,
    this.brand,
    this.size,
    this.howToUse,
    required this.price,
    required this.inventory,
    required this.categoryId,
    required this.imageList,
    required this.images,
    required this.createdAt,
    required this.updatedAt,
    required this.category,
  });

  factory Product.fromJsonRemote(Map<String, dynamic> json) {
    final rawImages = json['images'];
    final List<String> imgList = rawImages is List
        ? rawImages.map((e) => e.toString()).toList()
        : [];
    final firstImg = imgList.isNotEmpty ? imgList[0] : '';
    return Product(
      id:          json['id']?.toString() ?? '',
      name:        json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      brand:       json['brand']?.toString(),
      size:        json['size']?.toString(),
      howToUse:    json['howToUse']?.toString(),
      price:       double.tryParse(json['price']?.toString() ?? '0') ?? 0,
      inventory:   json['inventory'] as int? ?? 0,
      categoryId:  json['categoryId']?.toString() ?? '',
      category:    json['category'] is Map
                      ? json['category']['name']?.toString() ?? ''
                      : json['category']?.toString() ?? '',
      imageList:   imgList,
      images:      firstImg,
      createdAt:   DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      updatedAt:   DateTime.tryParse(json['updatedAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  factory Product.fromJsonLocal(Map<String, dynamic> json) {
    final rawImages = json['images'];
    List<String> imgList = [];
    if (rawImages is String && rawImages.isNotEmpty) {
      imgList = [rawImages];
    } else if (rawImages is List) {
      imgList = rawImages.map((e) => e.toString()).toList();
    }
    return Product(
      id:          json['id']?.toString() ?? '',
      name:        json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      brand:       json['brand']?.toString(),
      size:        json['size']?.toString(),
      howToUse:    json['howToUse']?.toString(),
      price:       (json['price'] is double) ? json['price'] : double.tryParse(json['price']?.toString() ?? '0') ?? 0,
      inventory:   json['inventory'] as int? ?? 0,
      categoryId:  json['categoryId']?.toString() ?? '',
      category:    json['category']?.toString() ?? '',
      imageList:   imgList,
      images:      imgList.isNotEmpty ? imgList[0] : '',
      createdAt:   DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      updatedAt:   DateTime.tryParse(json['updatedAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id':          id,
      'name':        name,
      'description': description,
      'brand':       brand,
      'size':        size,
      'howToUse':    howToUse,
      'price':       price,
      'inventory':   inventory,
      'categoryId':  categoryId,
      'images':      images,
      'createdAt':   createdAt.toIso8601String(),
      'updatedAt':   updatedAt.toIso8601String(),
      'category':    category,
    };
  }
}