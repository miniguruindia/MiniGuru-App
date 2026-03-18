class SessionState {
  static String? activeChildProfileId;
  static String? activeChildName;
  static String? activeChildAvatar;

  static bool get isChildSession => activeChildProfileId != null;
  static bool get isMentorSession => !isChildSession;

  static void setChild(String id, String name, String? avatar) {
    activeChildProfileId = id;
    activeChildName = name;
    activeChildAvatar = avatar;
  }

  static void clearChild() {
    activeChildProfileId = null;
    activeChildName = null;
    activeChildAvatar = null;
  }
}
