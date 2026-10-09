// app/miniguru/lib/network/phoneAuthWeb.dart — web builds.
// Talks to window.mgPhoneAuth defined in web/index.html.

import 'dart:convert';
import 'dart:js_interop';

@JS('mgPhoneAuth.start')
external JSPromise _jsStart(JSString configJson, JSString phone);

@JS('mgPhoneAuth.confirm')
external JSPromise _jsConfirm(JSString code);

Map<String, dynamic> _parse(JSAny? raw) {
  try {
    final text = (raw as JSString).toDart;
    return Map<String, dynamic>.from(jsonDecode(text) as Map);
  } catch (_) {
    return {'ok': false, 'error': 'Phone check is not available right now. Please refresh and try again.'};
  }
}

Future<Map<String, dynamic>> phoneAuthStart(String configJson, String phone) async {
  try {
    return _parse(await _jsStart(configJson.toJS, phone.toJS).toDart);
  } catch (_) {
    return {'ok': false, 'error': 'Phone check is not available right now. Please refresh and try again.'};
  }
}

Future<Map<String, dynamic>> phoneAuthConfirm(String code) async {
  try {
    return _parse(await _jsConfirm(code.toJS).toDart);
  } catch (_) {
    return {'ok': false, 'error': 'Phone check is not available right now. Please refresh and try again.'};
  }
}
