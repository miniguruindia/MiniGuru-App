import 'package:flutter/material.dart';

class ProjectCategory {
  final String id;
  final String name;
  final IconData icon;

  ProjectCategory({
    required this.id,
    required this.name,
    required this.icon,
  });

  // Convert JSON to ProjectCategory object
  factory ProjectCategory.fromJson(Map<String, dynamic> json) {
    return ProjectCategory(
      id: json['id'],
      name: json['name'],
      icon: _iconMap[json['icon']] ??
          Icons.help, // Fallback to Icons.help if no match
    );
  }

  // Convert ProjectCategory object to Map for SQLite or other purposes
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'icon': icon.codePoint, // Store the icon's code point for later retrieval
    };
  }

  // Convert stored data (e.g. SQLite) back to ProjectCategory object
  factory ProjectCategory.fromMap(Map<String, dynamic> map) {
    return ProjectCategory(
      id: map['id'],
      name: map['name'],
      icon: IconData(map['icon'],
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
