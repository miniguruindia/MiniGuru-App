import 'package:flutter/material.dart';

class ProductCategory {
  final String id;
  final String name;
  final IconData icon;

  ProductCategory({
    required this.id,
    required this.name,
    required this.icon,
  });

  // Convert JSON to ProductCategory object
  factory ProductCategory.fromJson(Map<String, dynamic> json) {
    return ProductCategory(
      id: json['id'],
      name: json['name'],
      icon: _iconMap[json['icon']] ??
          Icons.help, // Fallback to Icons.help if no match
    );
  }

  // Convert ProductCategory object to Map for SQLite or other purposes
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'icon': icon.codePoint, // Store the icon's code point for later retrieval
    };
  }

  // Convert stored data (e.g. SQLite) back to ProductCategory object
  factory ProductCategory.fromMap(Map<String, dynamic> map) {
    return ProductCategory(
      id: map['id'],
      name: map['name'],
      icon: IconData(int.parse(map['icon']),
          fontFamily:
              'MaterialIcons'), // Use fontFamily MaterialIcons for Material Icons
    );
  }

  // A map that links string names to Material icons
  static final Map<String, IconData> _iconMap = {
    'hecker': Icons.computer,
    'cloud': Icons.cloud,
    'security': Icons.security,
    'build': Icons.build,
    'settings': Icons.settings,
    'home': Icons.home,
    // Add more mappings here...
  };
}
