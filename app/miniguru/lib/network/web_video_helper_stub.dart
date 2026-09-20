// web_video_helper_stub.dart
//
// Default implementation, used on every platform EXCEPT web (mobile,
// desktop native). Real web behavior lives in web_video_helper_web.dart,
// selected automatically via the conditional import in MiniguruApi.dart /
// addDraftScreen.dart / projectDetailsScreen.dart:
//   import 'web_video_helper_stub.dart'
//       if (dart.library.html) 'web_video_helper_web.dart';
//
// This file exists purely so the app still compiles for mobile/desktop
// targets, where dart:html does not exist at all. Nothing here should
// ever actually run — mobile keeps using the original ImagePicker +
// XFile.readAsBytes() path, which was never affected by the web-only bug
// this pair of files exists to fix.

class WebFilePick {
  final String name;
  final int size;
  final Object nativeFile;
  WebFilePick(this.name, this.size, this.nativeFile);
}

Future<WebFilePick?> pickVideoFileWeb() async {
  throw UnsupportedError('pickVideoFileWeb is web-only.');
}

Future<int> uploadFileToSignedUrlWeb(
  String uploadUrl,
  Object nativeFile,
  String contentType, {
  void Function(double fraction)? onProgress,
}) async {
  throw UnsupportedError('uploadFileToSignedUrlWeb is web-only.');
}
