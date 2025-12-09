class Draft {
  int? id; // 👈 removed 'final' so it can be updated
  final String title;
  final String description;
  final DateTime? startDate;
  final DateTime? endDate;
  final String category;
  final Map<String, int> materials;

  Draft({
    this.id,
    required this.title,
    required this.description,
    this.startDate,
    this.endDate,
    required this.category,
    required this.materials,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'startDate': startDate?.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'category': category,
      'materials': materials.isNotEmpty ? _serializeMaterials(materials) : null,
    };
  }

  factory Draft.fromMap(Map<String, dynamic> map) {
    return Draft(
      id: map['id'],
      title: map['title'],
      description: map['description'],
      startDate:
          map['startDate'] != null ? DateTime.parse(map['startDate']) : null,
      endDate: map['endDate'] != null ? DateTime.parse(map['endDate']) : null,
      category: map['category'],
      materials: map['materials'] != null
          ? _deserializeMaterials(map['materials'])
          : {},
    );
  }

  static String _serializeMaterials(Map<String, int> materials) {
    return materials.entries.map((e) => '${e.key}:${e.value}').join(',');
  }

  static Map<String, int> _deserializeMaterials(String materials) {
    return Map.fromEntries(
      materials.split(',').map(
        (entry) {
          final parts = entry.split(':');
          return MapEntry(parts[0], int.parse(parts[1]));
        },
      ),
    );
  }
}
