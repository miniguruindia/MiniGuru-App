// app/miniguru/lib/network/phoneAuth.dart
//
// Browser-side phone check (Firebase Phone Auth) without adding any Dart
// firebase package: index.html carries a tiny wrapper (window.mgPhoneAuth)
// that loads the Firebase JS SDK on first use. On non-web builds the stub
// answers "web only". Both functions never throw — they return
// { ok: bool, error?: String, idToken?: String }.
export 'phoneAuthStub.dart' if (dart.library.js_interop) 'phoneAuthWeb.dart';
