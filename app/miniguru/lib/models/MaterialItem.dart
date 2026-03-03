// lib/models/MaterialItem.dart
// Represents a STEM material a child can pick for their project
// Named MaterialItem to avoid conflict with Flutter's Material widget

class MaterialItem {
  final String id;
  final String name;
  final String categoryId;
  final String categoryName;
  final int goinsPerUnit;    // Goins deducted per unit picked
  final String unit;         // "piece", "gram", "ml", "cm", "sheet", etc.
  final String? imageUrl;
  final bool isAvailable;

  const MaterialItem({
    required this.id,
    required this.name,
    required this.categoryId,
    required this.categoryName,
    required this.goinsPerUnit,
    required this.unit,
    this.imageUrl,
    this.isAvailable = true,
  });

  factory MaterialItem.fromJson(Map<String, dynamic> json) {
    return MaterialItem(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      categoryId: json['categoryId']?.toString() ?? '',
      categoryName: json['categoryName'] ?? '',
      goinsPerUnit: (json['goinsPerUnit'] ?? json['pointsPerUnit'] ?? json['price'] ?? 0).toInt(),
      unit: json['unit'] ?? 'piece',
      imageUrl: json['imageUrl'],
      isAvailable: json['isAvailable'] ?? true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'categoryId': categoryId,
      'categoryName': categoryName,
      'goinsPerUnit': goinsPerUnit,
      'unit': unit,
      'imageUrl': imageUrl,
      'isAvailable': isAvailable ? 1 : 0,
    };
  }

  factory MaterialItem.fromLocalMap(Map<String, dynamic> map) {
    return MaterialItem(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      categoryId: map['categoryId'] ?? '',
      categoryName: map['categoryName'] ?? '',
      goinsPerUnit: map['goinsPerUnit'] ?? 0,
      unit: map['unit'] ?? 'piece',
      imageUrl: map['imageUrl'],
      isAvailable: (map['isAvailable'] ?? 1) == 1,
    );
  }
}

// ─── Picked material entry (what the child selected) ─────────────────────────
class PickedMaterial {
  final MaterialItem item;
  int quantity;

  PickedMaterial({required this.item, required this.quantity});

  int get totalGoins => item.goinsPerUnit * quantity;

  Map<String, dynamic> toJson() => {
    'materialId': item.id,
    'materialName': item.name,
    'quantity': quantity,
    'unit': item.unit,
    'goinsPerUnit': item.goinsPerUnit,
    'totalGoins': totalGoins,
  };
}

// ─── Material category ────────────────────────────────────────────────────────
class MaterialCategory {
  final String id;
  final String name;
  final String emoji;        // e.g. "⚙️", "🔋", "🎨"

  const MaterialCategory({
    required this.id,
    required this.name,
    required this.emoji,
  });

  factory MaterialCategory.fromJson(Map<String, dynamic> json) {
    return MaterialCategory(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      emoji: json['emoji'] ?? '📦',
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'emoji': emoji,
  };
}