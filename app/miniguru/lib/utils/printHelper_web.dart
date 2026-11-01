// Web: prints an HTML page through a hidden frame (no pop-up window, so browsers don't block it).
// In the print window the child can choose "Save as PDF" to download it.
import 'dart:async';
import 'dart:html' as html;
import 'dart:js_util' as jsu;

Future<bool> printHtmlDocument(String doc) async {
  try {
    final f = html.IFrameElement()
      ..style.position = 'fixed'
      ..style.right = '0'
      ..style.bottom = '0'
      ..style.width = '0'
      ..style.height = '0'
      ..style.border = '0'
      ..srcdoc = doc;
    html.document.body!.append(f);
    f.onLoad.first.then((_) {
      Future.delayed(const Duration(milliseconds: 500), () {
        try {
          jsu.callMethod(f.contentWindow!, 'print', []);
        } catch (_) {}
      });
    });
    Future.delayed(const Duration(minutes: 3), () => f.remove());
    return true;
  } catch (_) {
    return false;
  }
}
