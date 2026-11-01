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
      ..style.width = '2px'
      ..style.height = '2px'
      ..style.border = '0'
      ..srcdoc = doc;
    html.document.body!.append(f);
    f.onLoad.first.then((_) {
      Future.delayed(const Duration(milliseconds: 900), () {
        try {
          // Use the raw browser window of the frame: dart:html wraps it, and the wrapper cannot print.
          final w = jsu.getProperty(f, 'contentWindow');
          jsu.callMethod(w, 'focus', []);
          jsu.callMethod(w, 'print', []);
        } catch (_) {
          // Fallback: open the page in a new tab, where the child can press Ctrl+P / Save as PDF.
          try {
            final blob = html.Blob([doc], 'text/html');
            html.window.open(html.Url.createObjectUrlFromBlob(blob), '_blank');
          } catch (_) {}
        }
      });
    });
    Future.delayed(const Duration(minutes: 3), () => f.remove());
    return true;
  } catch (_) {
    return false;
  }
}
