// lib/models/GoinTransaction.dart
// Tracks every Goin earned or spent by a child

enum GoinEventType {
  materialDeduction,  // Child picked materials for a project  → negative
  videoUpload,        // Child uploaded a project video        → positive (2× materials)
  likeReceived,       // Someone liked their video             → positive
  commentReceived,    // Someone commented on their video      → positive
  bonusAward,         // Admin manually awarded bonus goins    → positive
  penalty,            // Admin penalty                         → negative
}

extension GoinEventTypeExtension on GoinEventType {
  String get key {
    switch (this) {
      case GoinEventType.materialDeduction: return 'material_deduction';
      case GoinEventType.videoUpload:       return 'video_upload';
      case GoinEventType.likeReceived:      return 'like_received';
      case GoinEventType.commentReceived:   return 'comment_received';
      case GoinEventType.bonusAward:        return 'bonus_award';
      case GoinEventType.penalty:           return 'penalty';
    }
  }

  String get label {
    switch (this) {
      case GoinEventType.materialDeduction: return 'Materials Used';
      case GoinEventType.videoUpload:       return 'Video Uploaded';
      case GoinEventType.likeReceived:      return 'Like Received';
      case GoinEventType.commentReceived:   return 'Comment Received';
      case GoinEventType.bonusAward:        return 'Bonus Awarded';
      case GoinEventType.penalty:           return 'Penalty';
    }
  }

  String get emoji {
    switch (this) {
      case GoinEventType.materialDeduction: return '🧰';
      case GoinEventType.videoUpload:       return '🎬';
      case GoinEventType.likeReceived:      return '⭐';
      case GoinEventType.commentReceived:   return '💬';
      case GoinEventType.bonusAward:        return '🎁';
      case GoinEventType.penalty:           return '⚠️';
    }
  }

  bool get isCredit {
    return this != GoinEventType.materialDeduction &&
           this != GoinEventType.penalty;
  }

  static GoinEventType fromKey(String key) {
    return GoinEventType.values.firstWhere(
      (e) => e.key == key,
      orElse: () => GoinEventType.bonusAward,
    );
  }
}

class GoinTransaction {
  final String id;
  final GoinEventType type;
  final int amount;          // Always positive — sign is inferred from type
  final String description;
  final String? projectId;
  final String? videoId;
  final DateTime timestamp;
  final int balanceAfter;    // Goins balance after this transaction

  const GoinTransaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.description,
    this.projectId,
    this.videoId,
    required this.timestamp,
    required this.balanceAfter,
  });

  // Net change in goins (negative for deductions)
  int get netAmount => type.isCredit ? amount : -amount;

  factory GoinTransaction.fromJson(Map<String, dynamic> json) {
    return GoinTransaction(
      id: json['id']?.toString() ?? '',
      type: GoinEventTypeExtension.fromKey(json['type'] ?? ''),
      amount: (json['amount'] ?? 0).abs() as int,
      description: json['description'] ?? json['reason'] ?? '',
      projectId: json['projectId']?.toString(),
      videoId: json['videoId']?.toString(),
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : DateTime.now(),
      balanceAfter: (json['balanceAfter'] ?? json['balance'] ?? 0) as int,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'type': type.key,
    'amount': amount,
    'description': description,
    'projectId': projectId,
    'videoId': videoId,
    'timestamp': timestamp.toIso8601String(),
    'balanceAfter': balanceAfter,
  };

  factory GoinTransaction.fromLocalMap(Map<String, dynamic> map) {
    return GoinTransaction(
      id: map['id'] ?? '',
      type: GoinEventTypeExtension.fromKey(map['type'] ?? ''),
      amount: map['amount'] ?? 0,
      description: map['description'] ?? '',
      projectId: map['projectId'],
      videoId: map['videoId'],
      timestamp: DateTime.tryParse(map['timestamp'] ?? '') ?? DateTime.now(),
      balanceAfter: map['balanceAfter'] ?? 0,
    );
  }
}