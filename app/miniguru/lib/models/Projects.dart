import 'dart:convert';

class Project {
  final String id;
  final String title;
  final String description;
  final DateTime startDate;
  final DateTime endDate;
  final String author;
  final String thumbnail;
  final String category;
  final String video; // Nullable Video object
  final String userId;
  final String comments;
  final String materials; // List of Material objects
  final DateTime createdAt;
  final DateTime updatedAt;

  Project({
    required this.id,
    required this.title,
    required this.description,
    required this.startDate,
    required this.endDate,
    required this.author,
    required this.category,
    required this.comments,
    required this.thumbnail,
    required this.video, // Updated to include Video object
    required this.userId,
    required this.materials, // Updated to include list of Materials
    required this.createdAt,
    required this.updatedAt,
  });

  // Convert JSON to Project object
  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      startDate: DateTime.parse(json['startDate']),
      endDate: DateTime.parse(json['endDate']),
      category: json['category']['name'],
      author: json['user']['name'],
      thumbnail: json['thumbnail'],
      video: jsonEncode(json['video']),
      userId: json['userId'],
      comments: jsonEncode(json['comments']),
      materials: jsonEncode(json['materials']), // Handle list of materials
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }

  // Convert Project object to Map for SQLite
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'author': author,
      'category': category,
      'comments': jsonEncode(comments),
      'startDate': startDate.toIso8601String(),
      'endDate': endDate.toIso8601String(),
      'thumbnail': thumbnail,
      'video': jsonEncode(video), // Store videoId, or null if no video
      'userId': userId,
      'materials': jsonEncode(materials),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  // Convert list of Material objects to Map for SQLite
  // Map<String, dynamic> materialsToMap() {
  //   return {
  //     'materials': materials.map((material) => material.toMap()).toList(),
  //   };
  // }
}
