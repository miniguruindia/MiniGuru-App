#!/usr/bin/env python3
"""
mg_fix_community_cms_parsing.py

Fixes TWO bugs in app/miniguru/lib/screens/navScreen/community_screen.dart:

BUG A — field-name/type mismatches vs. what admin/app/content/page.tsx
        actually saves for Challenges/Happenings/Resources (goinsReward vs
        reward, endDate vs deadline, description vs desc, status string vs
        int). Almost nothing admin entered ever displayed correctly.

BUG B — `if (list != null && list.isNotEmpty)` meant an admin-emptied list
        (after deleting all items) was silently ignored and the original
        hardcoded dummy Dart list kept showing forever. Fixed to trust the
        CMS list once it has loaded, including when it's empty.

Also adds sensible auto-derived fallbacks (category emoji/color, resource
type emoji/color, happening tag color) so admin doesn't have to manually
pick a color for every single entry unless they want to override it.

Run from repo root:
    cd /workspaces/MiniGuru-App
    python3 mg_fix_community_cms_parsing.py
"""
import sys

PATH = "app/miniguru/lib/screens/navScreen/community_screen.dart"

with open(PATH, "r") as f:
    content = f.read()

OLD_BLOCK = '''  Future<void> _loadCms() async {
    try {
      final data = await _api.getCmsContent('community');
      if (data == null || !mounted) return;

      setState(() {
        // ── Stats strip ──────────────────────────────────────────────────
        final stats = data['stats'] as Map<String, dynamic>?;
        if (stats != null) {
          _statMakers = stats['makers']?.toString() ?? _statMakers;
          _statVideos = stats['videos']?.toString() ?? _statVideos;
          _statLabs   = stats['labs']?.toString()   ?? _statLabs;
        }

        // ── Happenings list ──────────────────────────────────────────────
        final happeningsList = data['happenings'] as List<dynamic>?;
        if (happeningsList != null && happeningsList.isNotEmpty) {
          _happenings = happeningsList.map((h) {
            final map = h as Map<String, dynamic>;
            Color tagColor = const Color(0xFFFFD60A);
            try {
              final hex = (map['tagColor'] as String?)?.replaceFirst('#', '') ?? 'FFD60A';
              tagColor = Color(int.parse('FF$hex', radix: 16));
            } catch (_) {}
            return _Happening(
              emoji:    map['emoji']?.toString()       ?? '🏫',
              lab:      map['title']?.toString()       ?? '',
              city:     map['city']?.toString()        ?? '',
              update:   map['description']?.toString() ?? '',
              tag:      map['tag']?.toString()         ?? 'Update',
              tagColor: tagColor,
              date:     map['date']?.toString()        ?? '',
            );
          }).toList();
        }

        // ── Challenges list ──────────────────────────────────────────────
        // CMS shape: { title, desc, category, categoryEmoji, status (0/1/2),
        //              reward, deadline, participants, color (hex) }
        final challengesList = data['challenges'] as List<dynamic>?;
        if (challengesList != null && challengesList.isNotEmpty) {
          _challenges = challengesList.map((c) {
            final map = c as Map<String, dynamic>;
            Color color = const Color(0xFF3B82F6);
            try {
              final hex = (map['color'] as String?)?.replaceFirst('#', '') ?? '3B82F6';
              color = Color(int.parse('FF$hex', radix: 16));
            } catch (_) {}
            return _Challenge(
              title:         map['title']?.toString()         ?? '',
              desc:          map['desc']?.toString()          ?? '',
              category:      map['category']?.toString()      ?? '',
              categoryEmoji: map['categoryEmoji']?.toString() ?? '🔬',
              status:        (map['status'] as num?)?.toInt() ?? 0,
              reward:        (map['reward'] as num?)?.toInt() ?? 0,
              deadline:      map['deadline']?.toString()      ?? '',
              participants:  (map['participants'] as num?)?.toInt() ?? 0,
              color:         color,
            );
          }).toList();
        }

        // ── Resources list ───────────────────────────────────────────────
        // CMS shape: { emoji, title, desc, tag, tagColor (hex), type, url }
        final resourcesList = data['resources'] as List<dynamic>?;
        if (resourcesList != null && resourcesList.isNotEmpty) {
          _resources = resourcesList.map((r) {
            final map = r as Map<String, dynamic>;
            Color tagColor = const Color(0xFF3B82F6);
            try {
              final hex = (map['tagColor'] as String?)?.replaceFirst('#', '') ?? '3B82F6';
              tagColor = Color(int.parse('FF$hex', radix: 16));
            } catch (_) {}
            return _Resource(
              emoji:    map['emoji']?.toString() ?? '📄',
              title:    map['title']?.toString() ?? '',
              desc:     map['desc']?.toString()  ?? '',
              tag:      map['tag']?.toString()   ?? '',
              tagColor: tagColor,
              type:     map['type']?.toString()  ?? 'PDF',
              url:      map['url']?.toString()   ?? '',
            );
          }).toList();
        }

        _cmsLoaded = true;
      });
    } catch (e) {
      debugPrint('❌ Community CMS load error: $e');
    }'''

NEW_BLOCK = '''  // ── CMS field-mapping helpers ────────────────────────────────────────────
  // Admin (admin/app/content/page.tsx) saves goinsReward/endDate/description/
  // status-as-string; these map admin's real field names + provide sensible
  // auto-derived fallbacks (emoji/color) so admin doesn't have to pick a
  // color for every single entry. Keep in sync with MINIGURU_RULES.md.

  Color? _parseHex(dynamic v) {
    if (v is! String || v.isEmpty) return null;
    try {
      final hex = v.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return null;
    }
  }

  Color _happeningTagColor(String tag) {
    switch (tag.toUpperCase()) {
      case 'NEW':
      case 'FEATURED':
        return const Color(0xFFFFD60A);
      case 'UPCOMING':
        return const Color(0xFF3B82F6);
      case 'MILESTONE':
        return const Color(0xFF10B981);
      case 'AWARD':
        return const Color(0xFFEC4899);
      case 'PAST':
      case 'PAST HIGHLIGHT':
        return const Color(0xFF6B6B8A);
      default:
        return const Color(0xFFFFD60A);
    }
  }

  String _categoryEmoji(String category) {
    final c = category.toLowerCase();
    if (c.contains('electr')) return '🔌';
    if (c.contains('robot')) return '🤖';
    if (c.contains('scien')) return '🔬';
    if (c.contains('mechan')) return '⚙️';
    if (c.contains('art') || c.contains('craft')) return '🎨';
    return '🏆';
  }

  Color _categoryColor(String category) {
    final c = category.toLowerCase();
    if (c.contains('electr')) return const Color(0xFFF59E0B);
    if (c.contains('robot')) return const Color(0xFF8B5CF6);
    if (c.contains('scien')) return const Color(0xFF10B981);
    if (c.contains('mechan')) return const Color(0xFF3B82F6);
    if (c.contains('art') || c.contains('craft')) return const Color(0xFFEC4899);
    return const Color(0xFF3B82F6);
  }

  String _resourceEmoji(String type) {
    switch (type.toUpperCase()) {
      case 'PDF':
        return '📄';
      case 'DOC':
        return '📝';
      case 'VIDEO':
        return '🎬';
      case 'LIST':
        return '📋';
      default:
        return '📄';
    }
  }

  Color _resourceColor(String type) {
    switch (type.toUpperCase()) {
      case 'PDF':
        return const Color(0xFF3B82F6);
      case 'DOC':
        return const Color(0xFF8B5CF6);
      case 'VIDEO':
        return const Color(0xFFEC4899);
      case 'LIST':
        return const Color(0xFF10B981);
      default:
        return const Color(0xFF3B82F6);
    }
  }

  // Admin's Status dropdown stores 'ongoing'/'upcoming'/'past' (a string).
  // A handful of legacy/seed entries may still have an int (0/1/2) —
  // support both so nothing already in the DB breaks.
  int _statusToInt(dynamic v) {
    if (v is num) return v.toInt();
    switch (v?.toString().toLowerCase()) {
      case 'ongoing':
        return 0;
      case 'upcoming':
        return 1;
      case 'past':
        return 2;
      default:
        return 1;
    }
  }

  Future<void> _loadCms() async {
    try {
      final data = await _api.getCmsContent('community');
      if (data == null || !mounted) return;

      setState(() {
        // ── Stats strip ──────────────────────────────────────────────────
        final stats = data['stats'] as Map<String, dynamic>?;
        if (stats != null) {
          _statMakers = stats['makers']?.toString() ?? _statMakers;
          _statVideos = stats['videos']?.toString() ?? _statVideos;
          _statLabs   = stats['labs']?.toString()   ?? _statLabs;
        }

        // ── Happenings list ──────────────────────────────────────────────
        // BUGFIX: trust the CMS as source of truth once it has loaded — an
        // admin-emptied list must render as empty, not silently keep the
        // original hardcoded defaults (this was the root cause of "I
        // deleted it in admin but it's still showing").
        final happeningsList = data['happenings'] as List<dynamic>?;
        if (happeningsList != null) {
          _happenings = happeningsList.map((h) {
            final map = h as Map<String, dynamic>;
            final tag = map['tag']?.toString() ?? 'Update';
            return _Happening(
              emoji:    map['emoji']?.toString()       ?? '🏫',
              lab:      map['title']?.toString()       ?? '',
              city:     map['city']?.toString()        ?? '',
              update:   map['description']?.toString() ?? '',
              tag:      tag,
              tagColor: _parseHex(map['tagColor']) ?? _happeningTagColor(tag),
              date:     map['date']?.toString()        ?? '',
            );
          }).toList();
        }

        // ── Challenges list ──────────────────────────────────────────────
        // Admin field names: title, category, difficulty, goinsReward,
        // endDate, status ('ongoing'/'upcoming'/'past'), description.
        // categoryEmoji/participants/color are optional admin fields —
        // auto-derived from category when not explicitly set.
        final challengesList = data['challenges'] as List<dynamic>?;
        if (challengesList != null) {
          _challenges = challengesList.map((c) {
            final map = c as Map<String, dynamic>;
            final category = map['category']?.toString() ?? '';
            return _Challenge(
              title:         map['title']?.toString() ?? '',
              desc:          (map['description'] ?? map['desc'])?.toString() ?? '',
              category:      category,
              categoryEmoji: map['categoryEmoji']?.toString() ?? _categoryEmoji(category),
              status:        _statusToInt(map['status']),
              reward:        ((map['goinsReward'] ?? map['reward']) as num?)?.toInt() ?? 0,
              deadline:      (map['endDate'] ?? map['deadline'])?.toString() ?? '',
              participants:  (map['participants'] as num?)?.toInt() ?? 0,
              color:         _parseHex(map['color']) ?? _categoryColor(category),
            );
          }).toList();
        }

        // ── Resources list ───────────────────────────────────────────────
        // Admin field names: title, type, tag, url, description.
        // emoji/tagColor auto-derived from type when not explicitly set.
        final resourcesList = data['resources'] as List<dynamic>?;
        if (resourcesList != null) {
          _resources = resourcesList.map((r) {
            final map = r as Map<String, dynamic>;
            final type = map['type']?.toString() ?? 'PDF';
            return _Resource(
              emoji:    map['emoji']?.toString() ?? _resourceEmoji(type),
              title:    map['title']?.toString() ?? '',
              desc:     (map['description'] ?? map['desc'])?.toString() ?? '',
              tag:      map['tag']?.toString() ?? '',
              tagColor: _parseHex(map['tagColor']) ?? _resourceColor(type),
              type:     type,
              url:      map['url']?.toString() ?? '',
            );
          }).toList();
        }

        _cmsLoaded = true;
      });
    } catch (e) {
      debugPrint('❌ Community CMS load error: $e');
    }'''

count = content.count(OLD_BLOCK)
if count != 1:
    print(f"❌ ABORTING — expected exactly 1 match, found {count}")
    sys.exit(1)

content = content.replace(OLD_BLOCK, NEW_BLOCK)

with open(PATH, "w") as f:
    f.write(content)

print(f"✅ Patched {PATH}")
