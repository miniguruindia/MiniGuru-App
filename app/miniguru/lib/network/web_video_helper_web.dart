// web_video_helper_web.dart
//
// The REAL fix (Sept 2026) for large-video upload crashes on Flutter Web.
//
// Root cause, confirmed against the http package's own issue tracker
// (dart-lang/http#1030, "StreamedRequest is a lie"): on web,
// http.StreamedRequest does NOT actually stream at all — BrowserClient
// reads the entire request body into memory before sending it, no matter
// how the bytes are fed in. For a 300MB+ video this throws exactly the
// "RangeError: Array buffer allocation failed" / "Invalid array length"
// crash this project hit — on ANY browser, not just memory-limited phones,
// since the failure is in the library itself, not available RAM.
//
// The fix used by every other Flutter Web app that uploads large files to
// a signed URL (S3, GCS, Firebase Storage) is exactly what this file
// does: skip package:http entirely for this one call, and hand the
// browser's own native File object straight to a raw XMLHttpRequest.
// Browsers upload File/Blob objects using their own internal, disk-backed
// mechanism — never materializing the whole file as one JS array — which
// is the entire reason this approach doesn't hit the same wall.
//
// dart:html remains fully supported on Flutter 3.27.4 (this project's
// locked SDK version) — the newer package:web/js_interop replacement only
// became necessary starting around Flutter 3.29+.

import 'dart:async';
import 'dart:html' as html;

class WebFilePick {
  final String name;
  final int size;
  final Object nativeFile;
  WebFilePick(this.name, this.size, this.nativeFile);
}

/// Opens the browser's native file picker directly (bypassing
/// package:file_picker for video specifically) so we get a real
/// html.File back — the one object type a browser can upload natively
/// without Dart ever touching its bytes.
Future<WebFilePick?> pickVideoFileWeb() async {
  final input = html.FileUploadInputElement()..accept = 'video/*';
  input.click();
  await input.onChange.first;
  final files = input.files;
  if (files == null || files.isEmpty) return null;
  final file = files.first;
  return WebFilePick(file.name, file.size, file);
}

/// Uploads a native html.File (obtained from [pickVideoFileWeb]) directly
/// to a signed PUT URL via raw XMLHttpRequest — never via package:http,
/// and never via any Dart-side byte buffer of the whole file.
Future<int> uploadFileToSignedUrlWeb(
  String uploadUrl,
  Object nativeFile,
  String contentType, {
  void Function(double fraction)? onProgress,
}) async {
  final file = nativeFile as html.File;
  final request = html.HttpRequest();
  request.open('PUT', uploadUrl);
  request.setRequestHeader('Content-Type', contentType);

  final completer = Completer<int>();
  if (onProgress != null) {
    request.upload.onProgress.listen((event) {
      if (event.lengthComputable) {
        onProgress(event.loaded! / event.total!);
      }
    });
  }
  request.onLoadEnd.listen((_) {
    if (!completer.isCompleted) completer.complete(request.status ?? 0);
  });
  request.onError.listen((_) {
    if (!completer.isCompleted) {
      completer.completeError(Exception(
          'Network error during upload — please check your internet connection.'));
    }
  });

  request.send(file);
  return completer.future;
}
