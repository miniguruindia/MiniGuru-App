// Hindi / English switch (Nov 2026).
// Use tr('English text') for any word shown to a child. In English it returns the same text.
// In Hindi it returns the approved Hindi from the server if there is one, else the built-in (machine-translated) Hindi
// from hi_strings.dart, else the English text. For words with a changing part use tr('Sent to {mail}', {'mail': x}).
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:miniguru/secrets.dart';
import 'package:miniguru/utils/hi_strings.dart';
import 'package:miniguru/utils/hi_strings_signup_home.dart';

class I18n {
  /// 'en' or 'hi'. A screen that shows translated words listens to this and rebuilds when it changes.
  static final ValueNotifier<String> lang = ValueNotifier<String>('en');
  static Map<String, String> _overrides = {};
  // All built-in Hindi, one file per area of the app.
  static final Map<String, String> _builtin = {...hiStrings, ...hiStringsSignupHome};

  static bool get isHindi => lang.value == 'hi';

  static Future<void> init() async {
    try {
      final p = await SharedPreferences.getInstance();
      if (p.getString('mg_lang') == 'hi') {
        lang.value = 'hi';
        _fetchOverrides();
      }
    } catch (_) {}
  }

  static Future<void> setLang(String l) async {
    lang.value = l == 'hi' ? 'hi' : 'en';
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString('mg_lang', lang.value);
    } catch (_) {}
    if (isHindi) _fetchOverrides();
  }

  // Approved corrections from the team. Best effort: if it fails, the built-in Hindi is used.
  static Future<void> _fetchOverrides() async {
    try {
      final r = await http.get(Uri.parse('$apiBaseUrl/i18n/hi')).timeout(const Duration(seconds: 8));
      if (r.statusCode != 200) return;
      final m = jsonDecode(r.body)['overrides'];
      if (m is Map) {
        _overrides = m.map((k, v) => MapEntry(k.toString(), v.toString()));
        final l = lang.value;
        lang.value = '';   // nudge listeners so screens pick up the corrections
        lang.value = l;
      }
    } catch (_) {}
  }

  static String? hindiFor(String en) => _overrides[en] ?? _builtin[en];

  static String t(String en, [Map<String, String>? args]) {
    var out = en;
    if (isHindi) out = hindiFor(en) ?? en;
    if (args != null) args.forEach((k, v) => out = out.replaceAll('{$k}', v));
    return out;
  }

  /// Words (English or Hindi) containing [q], for the "suggest a better word" box.
  static List<MapEntry<String, String>> search(String q) {
    final s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    final out = <MapEntry<String, String>>[];
    final keys = {..._builtin.keys, ..._overrides.keys};
    for (final k in keys) {
      final hi = hindiFor(k) ?? '';
      if (k.toLowerCase().contains(s) || hi.toLowerCase().contains(s)) out.add(MapEntry(k, hi));
      if (out.length >= 8) break;
    }
    return out;
  }

  /// Sends a suggestion to the team. Returns null if sent, or a short message if not.
  static Future<String?> suggest(String key, String suggestion, String screen) async {
    try {
      final r = await http
          .post(Uri.parse('$apiBaseUrl/i18n/suggest'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({'key': key, 'suggestion': suggestion, 'screen': screen}))
          .timeout(const Duration(seconds: 15));
      if (r.statusCode == 200) return null;
      try {
        return jsonDecode(r.body)['error']?.toString() ?? 'Could not send. Please try again.';
      } catch (_) {
        return 'Could not send. Please try again.';
      }
    } catch (_) {
      return 'Could not send. Please check your internet and try again.';
    }
  }
}

String tr(String en, [Map<String, String>? args]) => I18n.t(en, args);
