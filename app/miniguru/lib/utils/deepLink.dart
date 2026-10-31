// lib/utils/deepLink.dart
//
// Real web addresses for every screen (Oct 2026), e.g. miniguru.in/shop,
// miniguru.in/community/ladder, miniguru.in/consult/home-corner.
//
// - capture() remembers the address the visitor opened, before the app starts.
// - HomeScreen reads it once, opens the matching tab, and keeps the address bar
//   in step as the child taps tabs.
// - Inner tabs (Ladder, Workshops, Preset Kits ...) report their own name here.
// Every call is safe: on phones/tablets (not web) nothing happens.

import 'package:flutter/foundation.dart' show kIsWeb, ValueNotifier;
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class DeepLink {
  static const communityTabs = ['ladder', 'challenges', 't-lab', 'resources'];
  static const consultTabs = ['school-t-lab', 'workshops', 'home-corner'];
  static const shopTabs = ['browse', 'kits', 'my-kit'];

  static const _bareDefault = {'shop': 'browse', 'consult': 'school-t-lab'};

  static List<String> _initial = const [];
  static final Map<String, String> _pending = {};
  static final Map<String, String> _sub = {};
  static String _active = '';

  /// Where this visitor came from, e.g. ?src=whatsapp (used only to count sign-ups by channel).
  static String signupSource = '';

  /// Call once from main(), before runApp.
  static void capture() {
    if (!kIsWeb) return;
    try {
      _initial = Uri.base.pathSegments.where((s) => s.isNotEmpty).toList();
      final q = Uri.base.queryParameters;
      signupSource = (q['src'] ?? q['utm_source'] ?? q['ref'] ?? '')
          .toLowerCase().replaceAll(RegExp(r'[^a-z0-9._-]'), '');
      if (signupSource.length > 40) signupSource = signupSource.substring(0, 40);
    } catch (_) {}
  }

  /// True when the visitor opened a specific page address (not just miniguru.in).
  static bool get hasTarget => _initial.isNotEmpty && _initial.first != 'index.html';

  /// First segment of the opened address, once (then cleared).
  static String? takeBase() {
    if (!hasTarget) {
      _initial = const [];
      return null;
    }
    final base = _initial.first.toLowerCase();
    if (_initial.length > 1) _pending[base] = _initial[1].toLowerCase();
    _initial = const [];
    return base;
  }

  /// Inner-tab position asked for by the opened address (0 when none).
  static int takeTab(String base, List<String> names) {
    final s = _pending.remove(base);
    final i = s == null ? -1 : names.indexOf(s);
    if (i > 0) _sub[base] = names[i];
    return i < 0 ? 0 : i;
  }

  // ── One page, one address ──────────────────────────────────────────
  // Buttons that used to open a second copy of a tab (Events, Home Corner)
  // call openPage('community/resources'); HomeScreen switches to the real
  // tab instead. Returns false when this kind of user has no such tab.
  static bool Function(String)? opener;
  static bool openPage(String path) => opener?.call(path) ?? false;

  /// Inner-tab request for an already open tab, e.g. 'resources'.
  static final ValueNotifier<String> communityTabRequest = ValueNotifier<String>('');
  static final ValueNotifier<String> consultTabRequest = ValueNotifier<String>('');

  /// A full-screen page with its own address (/privacy, /terms) while it is open.
  static void showTemp(String path) {
    if (!kIsWeb) return;
    try {
      SystemNavigator.routeInformationUpdated(uri: Uri.parse(path), replace: true);
    } catch (_) {}
  }

  /// Put the address bar back to the tab behind the page that just closed.
  static void restore() => _write();

  /// The About page is the public web page (miniguru.in/about/): one About for everyone.
  static Future<void> openAboutPage() async {
    final uri = Uri.parse('https://miniguru.in/about/');
    try {
      await launchUrl(uri,
          mode: kIsWeb ? LaunchMode.platformDefault : LaunchMode.externalApplication,
          webOnlyWindowName: '_self');
    } catch (_) {}
  }

  /// The Consult page is the public web page (miniguru.in/consult/) for visitors.
  static Future<void> openConsultPage([String sub = '']) async {
    final frag = (sub.isEmpty || sub == 'school-t-lab') ? '' : '#$sub';
    final uri = Uri.parse('https://miniguru.in/consult/$frag');
    try {
      await launchUrl(uri,
          mode: kIsWeb ? LaunchMode.platformDefault : LaunchMode.externalApplication,
          webOnlyWindowName: '_self');
    } catch (_) {}
  }

  static void setActive(String base) {
    _active = base;
    _write();
  }

  static void setSub(String base, String name) {
    _sub[base] = name;
    if (_active == base) _write();
  }

  static void _write() {
    if (!kIsWeb || _active.isEmpty) return;
    var path = '/$_active';
    final s = _sub[_active];
    // The first tab of Shop and Consult is the bare address (/shop, /consult)
    if (s != null && s.isNotEmpty && s != _bareDefault[_active]) path += '/$s';
    try {
      SystemNavigator.routeInformationUpdated(uri: Uri.parse(path), replace: true);
    } catch (_) {}
  }
}
