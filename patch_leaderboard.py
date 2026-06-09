#!/usr/bin/env python3
"""
Patch: wires real leaderboard API to community_screen.dart
1. Converts _LadderTab from StatelessWidget to StatefulWidget
2. Fetches GET /leaderboard on init
3. Shows real data, falls back to hardcoded if API fails
4. Adds leaderboardRoutes to backend index.ts
Run from repo root: python3 patch_leaderboard.py
"""
import os, shutil

# ── Part 1: Flutter community_screen.dart ─────────────────────────────────
FLUTTER_TARGET = '/workspaces/MiniGuru-App/app/miniguru/lib/screens/navScreen/community_screen.dart'

with open(FLUTTER_TARGET, 'r') as f:
    content = f.read()

shutil.copy(FLUTTER_TARGET, FLUTTER_TARGET + '.bak')

# Add dart:convert import if not present
if "import 'dart:convert'" not in content:
    content = content.replace(
        "import 'package:flutter/material.dart';",
        "import 'dart:convert';\nimport 'package:flutter/material.dart';"
    )

# Add http import if not present
if "import 'package:http/http.dart'" not in content:
    content = content.replace(
        "import 'package:miniguru/constants.dart';",
        "import 'package:http/http.dart' as http;\nimport 'package:miniguru/constants.dart';"
    )

# Add apiBaseUrl import if not present
if "import 'package:miniguru/secrets.dart'" not in content:
    content = content.replace(
        "import 'package:miniguru/network/MiniguruApi.dart';",
        "import 'package:miniguru/network/MiniguruApi.dart';\nimport 'package:miniguru/secrets.dart';"
    )

# Replace the _LadderTab StatelessWidget with StatefulWidget version
OLD_LADDER = """class _LadderTab extends StatelessWidget {
  const _LadderTab();

  static const _levels = [
    _Level('🌱', 'Sprout',    '0–99G',   'Just starting out', Color(0xFF86EFAC), 0.0),
    _Level('🔩', 'Tinkerer',  '100–299G', 'Getting handy',     Color(0xFF93C5FD), 0.15),
    _Level('⚙️', 'Builder',   '300–599G', 'Serious maker',     Color(0xFFFDE68A), 0.35),
    _Level('🔬', 'Inventor',  '600–999G', 'Creating new things',Color(0xFFFCA5A5), 0.60),
    _Level('🚀', 'Innovator', '1000G+',   'Top of the ladder', Color(0xFFD8B4FE), 1.0),
  ];

  static const _badges = [
    _Badge('🎬', 'Director',   'Upload 5 project videos',  Color(0xFFEC4899)),
    _Badge('⭐', 'Star Maker', 'Get 50 likes total',        Color(0xFFE8A000)),
    _Badge('🤝', 'Mentor',     'Help 10 other makers',      Color(0xFF3B82F6)),
    _Badge('🔥', 'Streak',     '7-day activity streak',     Color(0xFFEF4444)),
    _Badge('🏅', 'Champion',   'Win a challenge',           Color(0xFF8B5CF6)),
    _Badge('🌏', 'Global',     'Project viewed in 5 countries', Color(0xFF10B981)),
  ];

  static const _leaderboard = [
    _Leader(rank: 1, name: 'Aarav M.',   city: 'Mumbai',     score: 1240, badge: '🚀'),
    _Leader(rank: 2, name: 'Priya K.',   city: 'Bengaluru',  score: 980,  badge: '🔬'),
    _Leader(rank: 3, name: 'Rohan S.',   city: 'Pune',       score: 870,  badge: '🔬'),
    _Leader(rank: 4, name: 'Diya T.',    city: 'Hyderabad',  score: 710,  badge: '⚙️'),
    _Leader(rank: 5, name: 'Aryan P.',   city: 'Delhi',      score: 650,  badge: '⚙️'),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView("""

NEW_LADDER = """class _LadderTab extends StatefulWidget {
  const _LadderTab();
  @override
  State<_LadderTab> createState() => _LadderTabState();
}

class _LadderTabState extends State<_LadderTab> {

  static const _levels = [
    _Level('🌱', 'Sprout',    '0–99G',   'Just starting out', Color(0xFF86EFAC), 0.0),
    _Level('🔩', 'Tinkerer',  '100–299G', 'Getting handy',     Color(0xFF93C5FD), 0.15),
    _Level('⚙️', 'Builder',   '300–599G', 'Serious maker',     Color(0xFFFDE68A), 0.35),
    _Level('🔬', 'Inventor',  '600–999G', 'Creating new things',Color(0xFFFCA5A5), 0.60),
    _Level('🚀', 'Innovator', '1000G+',   'Top of the ladder', Color(0xFFD8B4FE), 1.0),
  ];

  static const _badges = [
    _Badge('🎬', 'Director',   'Upload 5 project videos',  Color(0xFFEC4899)),
    _Badge('⭐', 'Star Maker', 'Get 50 likes total',        Color(0xFFE8A000)),
    _Badge('🤝', 'Mentor',     'Help 10 other makers',      Color(0xFF3B82F6)),
    _Badge('🔥', 'Streak',     '7-day activity streak',     Color(0xFFEF4444)),
    _Badge('🏅', 'Champion',   'Win a challenge',           Color(0xFF8B5CF6)),
    _Badge('🌏', 'Global',     'Project viewed in 5 countries', Color(0xFF10B981)),
  ];

  // Fallback hardcoded leaderboard — shown if API fails or returns empty
  static const _fallbackLeaderboard = [
    _Leader(rank: 1, name: 'Aarav M.',  city: '', score: 1240, badge: '🚀'),
    _Leader(rank: 2, name: 'Priya K.',  city: '', score: 980,  badge: '🔬'),
    _Leader(rank: 3, name: 'Rohan S.',  city: '', score: 870,  badge: '🔬'),
    _Leader(rank: 4, name: 'Diya T.',   city: '', score: 710,  badge: '⚙️'),
    _Leader(rank: 5, name: 'Aryan P.',  city: '', score: 650,  badge: '⚙️'),
  ];

  List<_Leader> _leaderboard = _fallbackLeaderboard;
  bool _loadingLeaderboard = true;

  @override
  void initState() {
    super.initState();
    _fetchLeaderboard();
  }

  Future<void> _fetchLeaderboard() async {
    try {
      final res = await http.get(
        Uri.parse('$apiBaseUrl/leaderboard'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      if (!mounted) return;
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final list = (data['leaderboard'] as List<dynamic>? ?? []);
        if (list.isNotEmpty) {
          setState(() {
            _leaderboard = list.map((item) {
              final m = item as Map<String, dynamic>;
              return _Leader(
                rank:  m['rank']  as int? ?? 0,
                name:  m['name']  as String? ?? 'Maker',
                city:  '',
                score: m['score'] as int? ?? 0,
                badge: m['badge'] as String? ?? '🌱',
              );
            }).toList();
            _loadingLeaderboard = false;
          });
          return;
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingLeaderboard = false);
  }

  @override
  Widget build(BuildContext context) {
    return ListView("""

if OLD_LADDER in content:
    content = content.replace(OLD_LADDER, NEW_LADDER)
    print('✅ _LadderTab converted to StatefulWidget with real API call')
else:
    print('ERROR: Could not find _LadderTab class — check community_screen.dart')
    exit(1)

# Replace the hardcoded _leaderboard reference in build method
# The build method references _leaderboard directly — now it's an instance variable
# Also update the ListView children to show loading state
OLD_LEADERBOARD_WIDGET = """        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE8EAFF)),
          ),
          child: Column(
            children: _leaderboard.asMap().entries.map((e) {
              final i = e.key;
              final l = e.value;
              return _LeaderRow(
                leader: l,
                isLast: i == _leaderboard.length - 1,
              );
            }).toList(),
          ),
        ),"""

NEW_LEADERBOARD_WIDGET = """        _loadingLeaderboard
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(
                  color: Color(0xFF5B6EF5), strokeWidth: 2),
              ))
          : Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE8EAFF)),
              ),
              child: Column(
                children: _leaderboard.asMap().entries.map((e) {
                  final i = e.key;
                  final l = e.value;
                  return _LeaderRow(
                    leader: l,
                    isLast: i == _leaderboard.length - 1,
                  );
                }).toList(),
              ),
            ),"""

if OLD_LEADERBOARD_WIDGET in content:
    content = content.replace(OLD_LEADERBOARD_WIDGET, NEW_LEADERBOARD_WIDGET)
    print('✅ Leaderboard widget shows loading state + real data')
else:
    print('⚠️  Could not find leaderboard widget block — may need manual check')

with open(FLUTTER_TARGET, 'w') as f:
    f.write(content)

print(f'\n✅ community_screen.dart patched')

# ── Part 2: Backend index.ts — register leaderboard route ─────────────────
INDEX_TARGET = '/workspaces/MiniGuru-App/backend/src/index.ts'

with open(INDEX_TARGET, 'r') as f:
    idx = f.read()

if '/leaderboard' in idx:
    print('ℹ️  Leaderboard route already registered in index.ts')
else:
    # Add import
    idx = idx.replace(
        "import materialsRouter from './routes/materialsRoutes';",
        "import materialsRouter from './routes/materialsRoutes';\nimport leaderboardRouter from './routes/leaderboardRoutes';"
    )
    # Register route — add after materials route
    idx = idx.replace(
        "app.use('/materials', materialsRouter);",
        "app.use('/materials', materialsRouter);\n  app.use('/leaderboard', leaderboardRouter);"
    )
    with open(INDEX_TARGET, 'w') as f:
        f.write(idx)
    print('✅ /leaderboard route registered in index.ts')

print('\nNext:')
print('  cd /workspaces/MiniGuru-App/backend && npx tsc --noEmit')
