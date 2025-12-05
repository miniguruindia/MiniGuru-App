import 'dart:convert';

class User {
  final String id;
  final String name;
  final String email;
  final int age;
  final int score;
  final double walletBalance;
  final List<dynamic> scoreHistory;
  final String phoneNumber;
  final int totalProjects;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.age,
    required this.score,
    required this.walletBalance,
    required this.scoreHistory,
    required this.phoneNumber,
    required this.totalProjects,
  });

  // Convert a User instance to a Map.
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'age': age,
      'score': score,
      'walletBalance': walletBalance,
      'scoreHistory': jsonEncode(scoreHistory),
      'phoneNumber': phoneNumber,
      'totalProjects': totalProjects
    };
  }

  // Convert a Map to a User instance.
  factory User.fromMap(Map<String, dynamic> map) {
    return User(
        id: map['id'],
        name: map['name'],
        email: map['email'],
        age: map['age'],
        score: map['score'],
        walletBalance: map['walletBalance'].toDouble(),
        scoreHistory: List<Map<String, dynamic>>.from(
            jsonDecode(map['scoreHistory'] ?? [])),
        phoneNumber: map['phoneNumber'],
        totalProjects: map['totalProjects']);
  }
}
