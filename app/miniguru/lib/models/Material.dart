class Material {
  final String id;
  final String name;
  final int quantity;
  final String projectId;

  Material(
      {required this.id,
      required this.name,
      required this.quantity,
      required this.projectId});

  factory Material.fromJson(Map<String, dynamic> json, String projectId) {
    if (json['material'] != null) {
      return Material(
        id: json['material']['id'],
        name: json['material']['name'],
        quantity: json['quantity'],
        projectId: projectId,
      );
    } else {
      return Material(
        id: '',
        name: '',
        quantity: 0,
        projectId: projectId,
      );
    }
  }

  factory Material.fromMap(Map<String, dynamic> json, String projectId) {
    return Material(
      id: json['id'],
      name: json['name'],
      quantity: json['quantity'],
      projectId: projectId,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'quantity': quantity,
      'projectId': projectId
    };
  }
}
