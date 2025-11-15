class AuthToken {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;

  AuthToken({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': 1,
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'expiresIn': expiresIn,
    };
  }

  // Convert a Map to a User instance.
  factory AuthToken.fromMap(Map<String, dynamic> map) {
    return AuthToken(
        accessToken: map['accessToken'],
        refreshToken: map['refreshToken'],
        expiresIn: map['expiresIn']);
  }
}
