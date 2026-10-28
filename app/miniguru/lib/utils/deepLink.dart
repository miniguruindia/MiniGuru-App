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

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';

class DeepLink {
  static const communityTabs = ['ladder', 'challenges', 't-lab', 'resources'];
  static const consultTabs = ['school-t-lab', 'workshops', 'home-corner'];
  static const shopTabs = ['browse', 'kits', 'my-kit'];

  static const _bareDefault = {'shop': 'browse', 'consult': 'school-t-lab'};

  static List<String> _initial = const [];
  static final Map<String, String> _pending = {};
  static final Map<String, String> _sub = {};
  static String _active = '';

  /// Call once from main(), before runApp.
  static void capture() {
    if (!kIsWeb) return;
    try {
      _initial = Uri.base.pathSegments.where((s) => s.isNotEmpty).toList();
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
