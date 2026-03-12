// lib/screens/navScreen/community_screen.dart
// MiniGuru Community — live ecosystem hub
// Sections: T-LAB Happenings · Challenges · Ladder & Badges · Resources
// CMS-wired: stats strip + happenings fetched from GET /cms/community

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';

class CommunityScreen extends StatefulWidget {
  const CommunityScreen({super.key});
  static const String id = 'CommunityScreen';

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  int _activeTab = 0;

  // ── CMS state ────────────────────────────────────────────────────────────
  final _api = MiniguruApi();
  bool _cmsLoaded = false;

  // Stats strip values (overridden by CMS if available)
  String _statMakers = '2,400+';
  String _statVideos = '890';
  String _statLabs   = '34';

  // Happenings list (overridden by CMS if available)
  List<_Happening> _happenings = _defaultHappenings;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this)
      ..addListener(() => setState(() => _activeTab = _tabController.index));
    _loadCms();
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
        final happeningsList = data['happenings'] as List<dynamic>?;
        if (happeningsList != null && happeningsList.isNotEmpty) {
          _happenings = happeningsList.map((h) {
            final map = h as Map<String, dynamic>;
            // Parse hex colour string like '#FFD60A' → Color
            Color tagColor = const Color(0xFFFFD60A);
            try {
              final hex = (map['tagColor'] as String?)?.replaceFirst('#', '') ?? 'FFD60A';
              tagColor = Color(int.parse('FF$hex', radix: 16));
            } catch (_) {}
            return _Happening(
              emoji:    map['emoji']?.toString()  ?? '🏫',
              lab:      map['title']?.toString()    ?? '',
              city:     map['city']?.toString()   ?? '',
              update:   map['description']?.toString() ?? '',
              tag:      map['tag']?.toString()    ?? 'Update',
              tagColor: tagColor,
              date:     map['date']?.toString()   ?? '',
            );
          }).toList();
        }

        _cmsLoaded = true;
      });
    } catch (e) {
      debugPrint('❌ Community CMS load error: $e');
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  static const _tabs = [
    _Tab('🧪', 'T-LAB'),
    _Tab('🎯', 'Challenges'),
    _Tab('🏆', 'Ladder'),
    _Tab('📦', 'Resources'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FF),
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [_buildHeader()],
        body: TabBarView(
          controller: _tabController,
          children: [
            _TLabTab(happenings: _happenings),
            const _ChallengesTab(),
            const _LadderTab(),
            const _ResourcesTab(),
          ],
        ),
      ),
    );
  }

  SliverAppBar _buildHeader() {
    return SliverAppBar(
      pinned: true,
      expandedHeight: 160,
      backgroundColor: const Color(0xFF1A1A2E),
      elevation: 0,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF1A1A2E), Color(0xFF3B1F6E)],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(height: 28),
                  Row(children: [
                    const Text('🌍', style: TextStyle(fontSize: 28)),
                    const SizedBox(width: 10),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Community',
                          style: GoogleFonts.nunito(
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              color: Colors.white)),
                      Text('MiniGuru Maker Ecosystem',
                          style: GoogleFonts.nunito(
                              fontSize: 12,
                              color: Colors.white60,
                              fontWeight: FontWeight.w500)),
                    ]),
                  ]),
                  const SizedBox(height: 12),
                  // Live stats strip — driven by CMS
                  Row(children: [
                    _statPill('🔧', '$_statMakers makers'),
                    const SizedBox(width: 8),
                    _statPill('🎬', '$_statVideos videos'),
                    const SizedBox(width: 8),
                    _statPill('🏫', '$_statLabs T-LABs'),
                  ]),
                ],
              ),
            ),
          ),
        ),
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(48),
        child: Container(
          color: const Color(0xFF1A1A2E),
          child: TabBar(
            controller: _tabController,
            isScrollable: false,
            indicatorColor: const Color(0xFFFFD60A),
            indicatorWeight: 3,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white38,
            tabs: _tabs.map((t) => Tab(
              child: Text('${t.emoji} ${t.label}',
                  style: GoogleFonts.nunito(
                      fontSize: 12, fontWeight: FontWeight.w700)),
            )).toList(),
          ),
        ),
      ),
    );
  }

  Widget _statPill(String emoji, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.15)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(emoji, style: const TextStyle(fontSize: 11)),
        const SizedBox(width: 5),
        Text(label,
            style: GoogleFonts.nunito(
                fontSize: 11,
                color: Colors.white70,
                fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEFAULT (FALLBACK) HAPPENINGS — used when CMS is unavailable
// ─────────────────────────────────────────────────────────────────────────────

const _defaultHappenings = [
  _Happening(
    emoji: '🏫',
    lab: 'Sunrise School T-LAB',
    city: 'Pune',
    update: 'Students built a solar-powered water purifier in just 3 days!',
    tag: 'Featured',
    tagColor: Color(0xFFFFD60A),
    date: 'Mar 2, 2026',
  ),
  _Happening(
    emoji: '🏠',
    lab: 'Rohan\'s Home Corner',
    city: 'Mumbai',
    update: 'Completed 12 projects this month — youngest maker to hit Level 3!',
    tag: 'Milestone',
    tagColor: Color(0xFF10B981),
    date: 'Mar 1, 2026',
  ),
  _Happening(
    emoji: '🏢',
    lab: 'Maker Hub Bengaluru',
    city: 'Bengaluru',
    update: 'Opened doors to 40 new young makers from government schools.',
    tag: 'New Lab',
    tagColor: Color(0xFF3B82F6),
    date: 'Feb 28, 2026',
  ),
  _Happening(
    emoji: '🏫',
    lab: 'DPS Innovation Lab',
    city: 'Delhi',
    update: 'Won regional STEAM fair with their MiniGuru robotics project.',
    tag: 'Award',
    tagColor: Color(0xFFEC4899),
    date: 'Feb 25, 2026',
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 1 — T-LAB HAPPENINGS
// ─────────────────────────────────────────────────────────────────────────────

class _TLabTab extends StatelessWidget {
  /// Happenings list — injected from CMS or falls back to defaults.
  final List<_Happening> happenings;
  const _TLabTab({required this.happenings});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        const _SectionHeader(
          title: 'Live from T-LABs',
          subtitle: 'What makers are building right now',
          emoji: '🔴',
        ),
        const SizedBox(height: 12),
        ...happenings.map((h) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _HappeningCard(h: h),
            )),
        const SizedBox(height: 8),
        _SetupBanner(),
      ],
    );
  }
}

class _HappeningCard extends StatelessWidget {
  final _Happening h;
  const _HappeningCard({required this.h});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EAFF)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF5B6EF5).withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(h.emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(h.lab,
                  style: GoogleFonts.nunito(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF1A1A2E))),
              Text('📍 ${h.city}',
                  style: GoogleFonts.nunito(
                      fontSize: 11, color: const Color(0xFF6B6B8A))),
            ]),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: h.tagColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(h.tag,
                style: GoogleFonts.nunito(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: h.tagColor == const Color(0xFFFFD60A)
                        ? const Color(0xFF8B6800)
                        : h.tagColor)),
          ),
        ]),
        const SizedBox(height: 10),
        Text(h.update,
            style: GoogleFonts.nunito(
                fontSize: 13,
                color: const Color(0xFF3D3D5C),
                height: 1.5)),
        const SizedBox(height: 8),
        Text(h.date,
            style: GoogleFonts.nunito(
                fontSize: 11, color: const Color(0xFFAAAAAC))),
      ]),
    );
  }
}

class _SetupBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(children: [
        const Text('🏫', style: TextStyle(fontSize: 32)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Start your own T-LAB',
                style: GoogleFonts.nunito(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Colors.white)),
            const SizedBox(height: 4),
            Text('Get expert help setting up your school or home lab.',
                style: GoogleFonts.nunito(fontSize: 12, color: Colors.white70)),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => Navigator.pushNamed(context, RegisterScreen.id),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text('Apply now →',
                    style: GoogleFonts.nunito(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF3B82F6))),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 2 — CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

class _ChallengesTab extends StatefulWidget {
  const _ChallengesTab();

  @override
  State<_ChallengesTab> createState() => _ChallengesTabState();
}

class _ChallengesTabState extends State<_ChallengesTab> {
  int _filter = 0; // 0=ongoing 1=upcoming 2=past

  static const _challenges = [
    _Challenge(
      title: 'Bridge Builder March',
      desc: 'Build the strongest bridge using only cardboard and rubber bands. Max span: 30cm.',
      category: 'Mechanics',
      categoryEmoji: '⚙️',
      status: 0,
      reward: 200,
      deadline: 'Mar 15, 2026',
      participants: 87,
      color: Color(0xFF3B82F6),
    ),
    _Challenge(
      title: 'Solar Science Sprint',
      desc: 'Build a device powered only by sunlight. Anything goes — fan, car, pump!',
      category: 'Science',
      categoryEmoji: '🔬',
      status: 0,
      reward: 300,
      deadline: 'Mar 20, 2026',
      participants: 54,
      color: Color(0xFF10B981),
    ),
    _Challenge(
      title: 'LED Art Festival',
      desc: 'Create illuminated artwork using LEDs. Judged on creativity and circuit design.',
      category: 'ArtCraft',
      categoryEmoji: '🎨',
      status: 1,
      reward: 150,
      deadline: 'Apr 1, 2026',
      participants: 0,
      color: Color(0xFFEC4899),
    ),
    _Challenge(
      title: 'Robo-Race Jan 2026',
      desc: 'Build the fastest line-following robot.',
      category: 'Robotics',
      categoryEmoji: '🤖',
      status: 2,
      reward: 500,
      deadline: 'Jan 31, 2026',
      participants: 143,
      color: Color(0xFF8B5CF6),
    ),
  ];

  List<_Challenge> get _filtered =>
      _challenges.where((c) => c.status == _filter).toList();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        const _SectionHeader(
          title: 'STEAM Challenges',
          subtitle: 'Compete, build, earn Goins',
          emoji: '🎯',
        ),
        const SizedBox(height: 12),
        Row(children: [
          _filterChip('Ongoing', 0, const Color(0xFF10B981)),
          const SizedBox(width: 8),
          _filterChip('Upcoming', 1, const Color(0xFF3B82F6)),
          const SizedBox(width: 8),
          _filterChip('Past', 2, const Color(0xFF6B6B8A)),
        ]),
        const SizedBox(height: 16),
        if (_filtered.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.all(40),
              child: Text('No challenges here yet!',
                  style: GoogleFonts.nunito(
                      color: const Color(0xFFAAAAAC), fontSize: 14)),
            ),
          )
        else
          ..._filtered.map((c) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ChallengeCard(c: c),
              )),
      ],
    );
  }

  Widget _filterChip(String label, int index, Color color) {
    final active = _filter == index;
    return GestureDetector(
      onTap: () => setState(() => _filter = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: active ? color : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? color : const Color(0xFFE8EAFF)),
        ),
        child: Text(label,
            style: GoogleFonts.nunito(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: active ? Colors.white : const Color(0xFF6B6B8A))),
      ),
    );
  }
}

class _ChallengeCard extends StatelessWidget {
  final _Challenge c;
  const _ChallengeCard({required this.c});

  @override
  Widget build(BuildContext context) {
    final statusLabel = ['ONGOING', 'UPCOMING', 'ENDED'][c.status];
    final statusColor = [
      const Color(0xFF10B981),
      const Color(0xFF3B82F6),
      const Color(0xFF6B6B8A),
    ][c.status];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EAFF)),
        boxShadow: [
          BoxShadow(
            color: c.color.withOpacity(0.07),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(children: [
        Container(
          height: 4,
          decoration: BoxDecoration(
            color: c.color,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(16)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(c.categoryEmoji, style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(c.title,
                    style: GoogleFonts.nunito(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF1A1A2E))),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(statusLabel,
                    style: GoogleFonts.nunito(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: statusColor)),
              ),
            ]),
            const SizedBox(height: 8),
            Text(c.desc,
                style: GoogleFonts.nunito(
                    fontSize: 13,
                    color: const Color(0xFF3D3D5C),
                    height: 1.5)),
            const SizedBox(height: 12),
            Row(children: [
              _pill('🪙 ${c.reward}G reward', const Color(0xFFE8A000),
                  const Color(0xFFFFF3CC)),
              const SizedBox(width: 8),
              _pill('📅 ${c.deadline}', const Color(0xFF3B82F6),
                  const Color(0xFFDDE1FF)),
              if (c.participants > 0) ...[
                const SizedBox(width: 8),
                _pill('👥 ${c.participants}', const Color(0xFF10B981),
                    const Color(0xFFD4F5EE)),
              ],
            ]),
            if (c.status != 2) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () =>
                      Navigator.pushNamed(context, LoginScreen.id),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: c.color,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(
                      c.status == 0 ? 'Join Challenge →' : 'Get Notified →',
                      style: GoogleFonts.nunito(
                          fontWeight: FontWeight.w800, fontSize: 13)),
                ),
              ),
            ],
          ]),
        ),
      ]),
    );
  }

  Widget _pill(String label, Color color, Color bg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: GoogleFonts.nunito(
              fontSize: 10, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 3 — LADDER & BADGES
// ─────────────────────────────────────────────────────────────────────────────

class _LadderTab extends StatelessWidget {
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
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        const _SectionHeader(
          title: 'Maker Ladder',
          subtitle: 'Earn Goins → level up → earn badges',
          emoji: '🏆',
        ),
        const SizedBox(height: 16),

        Text('Progression Levels',
            style: GoogleFonts.nunito(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF1A1A2E))),
        const SizedBox(height: 10),
        ..._levels.map((l) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _LevelRow(l: l),
            )),

        const SizedBox(height: 24),

        Text('Badge Collection',
            style: GoogleFonts.nunito(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF1A1A2E))),
        const SizedBox(height: 10),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 0.85,
          children: _badges.map((b) => _BadgeCard(b: b)).toList(),
        ),

        const SizedBox(height: 24),

        Text('Top Makers This Month',
            style: GoogleFonts.nunito(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF1A1A2E))),
        const SizedBox(height: 10),
        Container(
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
        ),

        const SizedBox(height: 16),
        const _JoinCTA(
          title: 'Climb the ladder!',
          subtitle: 'Join free and start earning Goins today.',
        ),
      ],
    );
  }
}

class _LevelRow extends StatelessWidget {
  final _Level l;
  const _LevelRow({required this.l});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: l.color.withOpacity(0.4)),
      ),
      child: Row(children: [
        Text(l.emoji, style: const TextStyle(fontSize: 22)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(l.title,
                  style: GoogleFonts.nunito(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF1A1A2E))),
              const SizedBox(width: 8),
              Text(l.range,
                  style: GoogleFonts.nunito(
                      fontSize: 11,
                      color: const Color(0xFF6B6B8A),
                      fontWeight: FontWeight.w600)),
            ]),
            Text(l.desc,
                style: GoogleFonts.nunito(
                    fontSize: 11, color: const Color(0xFFAAAAAC))),
          ]),
        ),
      ]),
    );
  }
}

class _BadgeCard extends StatelessWidget {
  final _Badge b;
  const _BadgeCard({required this.b});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: b.color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: b.color.withOpacity(0.25)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(b.emoji, style: const TextStyle(fontSize: 26)),
          const SizedBox(height: 6),
          Text(b.name,
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1A1A2E))),
          const SizedBox(height: 3),
          Text(b.desc,
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                  fontSize: 9,
                  color: const Color(0xFF6B6B8A),
                  height: 1.3),
              maxLines: 2,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

class _LeaderRow extends StatelessWidget {
  final _Leader leader;
  final bool isLast;
  const _LeaderRow({required this.leader, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final topColors = [
      const Color(0xFFFFD60A),
      const Color(0xFFB0BEC5),
      const Color(0xFFCD7F32),
    ];
    final rankColor = leader.rank <= 3
        ? topColors[leader.rank - 1]
        : const Color(0xFFE8EAFF);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(
                bottom: BorderSide(color: Color(0xFFE8EAFF))),
      ),
      child: Row(children: [
        Container(
          width: 30, height: 30,
          decoration: BoxDecoration(
            color: rankColor.withOpacity(0.2),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text('${leader.rank}',
                style: GoogleFonts.nunito(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: leader.rank <= 3
                        ? rankColor
                        : const Color(0xFF6B6B8A))),
          ),
        ),
        const SizedBox(width: 12),
        Text(leader.badge, style: const TextStyle(fontSize: 16)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(leader.name,
                style: GoogleFonts.nunito(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1A1A2E))),
            Text('📍 ${leader.city}',
                style: GoogleFonts.nunito(
                    fontSize: 11, color: const Color(0xFF6B6B8A))),
          ]),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF3CC),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text('🪙 ${leader.score}G',
              style: GoogleFonts.nunito(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF8B6800))),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB 4 — RESOURCES
// ─────────────────────────────────────────────────────────────────────────────

class _ResourcesTab extends StatelessWidget {
  const _ResourcesTab();

  static const _resources = [
    _Resource(
      emoji: '📋',
      title: 'Project Planning Template',
      desc: 'A fillable PDF to plan your next STEAM project step by step.',
      tag: 'Students',
      tagColor: Color(0xFF3B82F6),
      type: 'PDF',
    ),
    _Resource(
      emoji: '🏫',
      title: 'T-LAB Setup Guide',
      desc: 'Complete guide for schools to set up a tinkering lab from scratch.',
      tag: 'Schools',
      tagColor: Color(0xFF10B981),
      type: 'PDF',
    ),
    _Resource(
      emoji: '🎓',
      title: 'Mentor Handbook',
      desc: 'How to guide young makers — facilitation tips for parents and teachers.',
      tag: 'Mentors',
      tagColor: Color(0xFF8B5CF6),
      type: 'PDF',
    ),
    _Resource(
      emoji: '🔋',
      title: 'Electronics Starter Kit List',
      desc: 'Curated list of components every home T-LAB should have under ₹2,000.',
      tag: 'Students',
      tagColor: Color(0xFF3B82F6),
      type: 'List',
    ),
    _Resource(
      emoji: '🤖',
      title: 'Robotics Challenge Toolkit',
      desc: 'Worksheets, circuit diagrams and tips for the monthly robot challenge.',
      tag: 'Challenge',
      tagColor: Color(0xFFEC4899),
      type: 'ZIP',
    ),
    _Resource(
      emoji: '📊',
      title: 'STEAM Skills Rubric',
      desc: 'Assessment rubric for teachers to evaluate project quality and creativity.',
      tag: 'Schools',
      tagColor: Color(0xFF10B981),
      type: 'XLSX',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        const _SectionHeader(
          title: 'Resource Library',
          subtitle: 'Free downloads for makers, schools & mentors',
          emoji: '📦',
        ),
        const SizedBox(height: 16),
        ..._resources.map((r) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ResourceCard(r: r),
            )),
        const SizedBox(height: 8),
        const _JoinCTA(
          title: 'Want exclusive resources?',
          subtitle: 'Join free to unlock member-only toolkits and guides.',
        ),
      ],
    );
  }
}

class _ResourceCard extends StatelessWidget {
  final _Resource r;
  const _ResourceCard({required this.r});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE8EAFF)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(
            color: r.tagColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(r.emoji, style: const TextStyle(fontSize: 22)),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(r.title,
                    style: GoogleFonts.nunito(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF1A1A2E))),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(r.type,
                    style: GoogleFonts.nunito(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF6B6B8A))),
              ),
            ]),
            const SizedBox(height: 3),
            Text(r.desc,
                style: GoogleFonts.nunito(
                    fontSize: 11,
                    color: const Color(0xFF6B6B8A),
                    height: 1.4),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: r.tagColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(r.tag,
                    style: GoogleFonts.nunito(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: r.tagColor)),
              ),
            ]),
          ]),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () => Navigator.pushNamed(context, LoginScreen.id),
          child: Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.download_rounded,
                color: Color(0xFF3B82F6), size: 18),
          ),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED WIDGETS
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title, subtitle, emoji;
  const _SectionHeader(
      {required this.title, required this.subtitle, required this.emoji});

  @override
  Widget build(BuildContext context) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(emoji, style: const TextStyle(fontSize: 24)),
      const SizedBox(width: 10),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: GoogleFonts.nunito(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF1A1A2E))),
        Text(subtitle,
            style: GoogleFonts.nunito(
                fontSize: 12, color: const Color(0xFF6B6B8A))),
      ]),
    ]);
  }
}

class _JoinCTA extends StatelessWidget {
  final String title, subtitle;
  const _JoinCTA({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1A1A2E), Color(0xFF3B1F6E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(children: [
        Text(title,
            style: GoogleFonts.nunito(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: Colors.white)),
        const SizedBox(height: 4),
        Text(subtitle,
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(fontSize: 12, color: Colors.white60)),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: ElevatedButton(
              onPressed: () =>
                  Navigator.pushNamed(context, RegisterScreen.id),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFD60A),
                foregroundColor: const Color(0xFF1A1A2E),
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: Text('Join Free',
                  style: GoogleFonts.nunito(
                      fontWeight: FontWeight.w800, fontSize: 14)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton(
              onPressed: () =>
                  Navigator.pushNamed(context, LoginScreen.id),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white30, width: 1.5),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: Text('Login',
                  style: GoogleFonts.nunito(
                      fontWeight: FontWeight.w800, fontSize: 14)),
            ),
          ),
        ]),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DATA MODELS
// ─────────────────────────────────────────────────────────────────────────────

class _Tab {
  final String emoji, label;
  const _Tab(this.emoji, this.label);
}

class _Happening {
  final String emoji, lab, city, update, tag, date;
  final Color tagColor;
  const _Happening({
    required this.emoji, required this.lab, required this.city,
    required this.update, required this.tag, required this.tagColor,
    required this.date,
  });
}

class _Challenge {
  final String title, desc, category, categoryEmoji, deadline;
  final int status, reward, participants;
  final Color color;
  const _Challenge({
    required this.title, required this.desc, required this.category,
    required this.categoryEmoji, required this.status, required this.reward,
    required this.deadline, required this.participants, required this.color,
  });
}

class _Level {
  final String emoji, title, range, desc;
  final Color color;
  final double progress;
  const _Level(this.emoji, this.title, this.range, this.desc, this.color, this.progress);
}

class _Badge {
  final String emoji, name, desc;
  final Color color;
  const _Badge(this.emoji, this.name, this.desc, this.color);
}

class _Leader {
  final int rank, score;
  final String name, city, badge;
  const _Leader({
    required this.rank, required this.name, required this.city,
    required this.score, required this.badge,
  });
}

class _Resource {
  final String emoji, title, desc, tag, type;
  final Color tagColor;
  const _Resource({
    required this.emoji, required this.title, required this.desc,
    required this.tag, required this.tagColor, required this.type,
  });
}