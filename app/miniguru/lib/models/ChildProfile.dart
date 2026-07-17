class ChildProfile {
  final String id;
  final String name;
  final int age;
  final String? grade;
  final String? avatar;
  final int score;
  final bool isActive;
  final String? linkedUserId; // the child's own independent-login User id —
                               // required to add them as a project collaborator

  ChildProfile({
    required this.id,
    required this.name,
    required this.age,
    this.grade,
    this.avatar,
    required this.score,
    this.isActive = true,
    this.linkedUserId,
  });

  factory ChildProfile.fromMap(Map<String, dynamic> map) {
    return ChildProfile(
      id: map['id'] as String,
      name: map['name'] as String,
      age: map['age'] as int,
      grade: map['grade'] as String?,
      avatar: map['avatar'] as String?,
      score: map['score'] as int? ?? 0,
      isActive: map['isActive'] as bool? ?? true,
      linkedUserId: map['linkedUserId'] as String?,
    );
  }
}
