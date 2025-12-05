import 'dart:convert';

class Video {
  final String url;
  final String uploadedAt;

  Video({required this.url, required this.uploadedAt});

  factory Video.fromJson(String data) {
    print(jsonDecode(data));
    return Video(url: "", uploadedAt: "");
  }

  Map<String, dynamic> toMap() {
    return {
      'url': url,
      'uploadedAt': uploadedAt,
    };
  }
}
