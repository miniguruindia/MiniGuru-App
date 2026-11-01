class Draft {
  int? id;
  final String title;
  final String description;
  final DateTime? startDate;
  final DateTime? endDate;
  final String category;
  final Map<String, int> materials;
  final String? childKey; // NEW — which child (or 'self') this draft belongs to
  final String? planId;        // MG-SSK-PK-0042, given by the server
  final String? planCreatedAt; // ISO time the ID was created
  final String? sketch;        // optional sketch, PNG/JPEG as base64 (planning only — never sent with the video)

  Draft({
    this.id,
    required this.title,
    required this.description,
    this.startDate,
    this.endDate,
    required this.category,
    required this.materials,
    this.childKey,
    this.planId,
    this.planCreatedAt,
    this.sketch,
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
      'childKey': childKey,
      'planId': planId,
      'planCreatedAt': planCreatedAt,
      'sketch': sketch,
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
      childKey: map['childKey'],
      planId: map['planId'],
      planCreatedAt: map['planCreatedAt'],
      sketch: map['sketch'],
      materials: map['materials'] != null
          ? _deserializeMaterials(map['materials'])
          : {},
    );
  }

  // JSON methods for SharedPreferences web storage
  Map<String, dynamic> toJson() => toMap();
  factory Draft.fromJson(Map<String, dynamic> json) => Draft.fromMap(json);

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
