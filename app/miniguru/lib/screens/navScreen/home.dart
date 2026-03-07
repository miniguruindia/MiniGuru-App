// lib/screens/navScreen/home.dart
import 'package:flutter/material.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/services/youtube_service.dart';
import 'package:miniguru/screens/unifiedVideoPlayer.dart';
import 'package:google_fonts/google_fonts.dart';

class Home extends StatefulWidget {
  const Home({super.key});

  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  User? user;
  final _miniguruApi = MiniguruApi();
  bool _isLoading = true;
  bool _isAuthenticated = false;
  bool _isLoadingVideos = true;
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory = 'All';

  final List<Map<String, dynamic>> _categories = [
    {'name': 'Robotics',  'icon': Icons.precision_manufacturing, 'color': Color(0xFF93C5FD)},
    {'name': 'Mechanics', 'icon': Icons.handyman,                'color': Color(0xFFFDE68A)},
    {'name': 'ArtCraft',  'icon': Icons.palette,                 'color': Color(0xFFFCA5A5)},
    {'name': 'Science',   'icon': Icons.science,                 'color': Color(0xFF86EFAC)},
  ];

  List<Map<String, dynamic>> _allVideos = [];
  List<Map<String, dynamic>> _filteredVideos = [];

  @override
  void initState() {
    super.initState();
    _checkAuthAndLoadData();
    _loadYouTubeVideos();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _checkAuthAndLoadData() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    try {
      final userData = await _miniguruApi.getUserData();
      if (mounted) {
        setState(() {
          user = userData;
          _isAuthenticated = userData != null;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          user = null;
          _isAuthenticated = false;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadYouTubeVideos() async {
    setState(() => _isLoadingVideos = true);
    try {
      final videos = await YouTubeService.getChannelVideos(maxResults: 50);
      if (mounted) {
        setState(() {
          _allVideos = videos;
          _filteredVideos = videos;
          _isLoadingVideos = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingVideos = false);
    }
  }

  void _filterVideos(String category) {
    setState(() {
      _selectedCategory = category;
      _filteredVideos = category == 'All'
          ? _allVideos
          : YouTubeService.filterByCategory(_allVideos, category);
    });
  }

  Future<void> _refreshAll() async {
    await Future.wait([_checkAuthAndLoadData(), _loadYouTubeVideos()]);
  }

  Future<void> _logout() async {
    try {
      await _miniguruApi.logout();
      if (mounted) {
        setState(() { user = null; _isAuthenticated = false; });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Logged out successfully',
              style: GoogleFonts.nunito()),
          backgroundColor: Colors.green,
        ));
      }
    } catch (e) {
      print('Logout error: $e');
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refreshAll,
          child: CustomScrollView(
            slivers: [
              _buildAppBar(),
              if (_isAuthenticated && user != null)
                _buildAuthenticatedContent()
              else
                _buildGuestContent(),
            ],
          ),
        ),
      ),
    );
  }

  // ── App bar ───────────────────────────────────────────────────────────────

  Widget _buildAppBar() {
    return SliverAppBar(
      floating: true,
      backgroundColor: Colors.white,
      elevation: 0,
      title: Row(
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: const Color(0xFF3B82F6),
              borderRadius: BorderRadius.circular(8),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                'assets/mg-logo.png',
                width: 32, height: 32, fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    const Icon(Icons.lightbulb, color: Colors.white, size: 20),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text('MiniGuru',
              style: GoogleFonts.nunito(fontWeight: FontWeight.w900, 
                  fontSize: 22, color: Colors.black87)),
        ],
      ),
      actions: [
        if (_isAuthenticated && user != null)
          _buildUserAvatar()
        else
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton(
              onPressed: () => Navigator.pushNamed(context, LoginScreen.id),
              child: Text('Login / Signup',
                  style: GoogleFonts.nunito(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF3B82F6),
                  )),
            ),
          ),
      ],
    );
  }

  Widget _buildUserAvatar() {
    final userName = user?.name ?? 'User';
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: PopupMenuButton<String>(
        offset: const Offset(0, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            Text('Hi, ', style: GoogleFonts.nunito(fontSize: 14, color: Colors.black54)),
            Text(userName.split(' ')[0],
                style: GoogleFonts.nunito(
                    fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black87)),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_drop_down, color: Colors.black54, size: 20),
          ],
        ),
        onSelected: (v) { if (v == 'logout') _logout(); },
        itemBuilder: (_) => [
          PopupMenuItem(
            value: 'profile',
            child: Row(children: [
              const Icon(Icons.person_outline, size: 18, color: Color(0xFF3B82F6)),
              const SizedBox(width: 12),
              Text('Profile', style: GoogleFonts.nunito(fontSize: 14)),
            ]),
          ),
          const PopupMenuDivider(),
          PopupMenuItem(
            value: 'logout',
            child: Row(children: [
              const Icon(Icons.logout, size: 18, color: Colors.red),
              const SizedBox(width: 12),
              Text('Logout',
                  style: GoogleFonts.nunito(fontSize: 14, color: Colors.red)),
            ]),
          ),
        ],
      ),
    );
  }

  // ── Authenticated content ─────────────────────────────────────────────────

  Widget _buildAuthenticatedContent() {
    return SliverList(
      delegate: SliverChildListDelegate([
        _buildStatsCards(),
        const SizedBox(height: 24),
        _buildContinueWatching(),
        const SizedBox(height: 24),
        _buildForYou(),
        const SizedBox(height: 24),
        _buildTrendingNow(),
        const SizedBox(height: 24),
      ]),
    );
  }

  Widget _buildStatsCards() {
    final score = user?.score?.toString() ?? '0';
    final projects = user?.totalProjects?.toString() ?? '0';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: LayoutBuilder(builder: (context, constraints) {
        if (constraints.maxWidth < 600) {
          return Column(children: [
            _buildStatCard('Daily Quest', 'Watch 5 Projects', '3/5 • +50 pts',
                Icons.emoji_events, const Color(0xFFFDE68A), const Color(0xFFD97706)),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                  child: _buildStatCard('Score', score, 'Rank #42',
                      Icons.stars, const Color(0xFFF3F4F6), const Color(0xFF3B82F6))),
              const SizedBox(width: 12),
              Expanded(
                  child: _buildStatCard('Your', projects, 'Projects',
                      Icons.work_outline, const Color(0xFFF3F4F6), const Color(0xFF10B981))),
            ]),
          ]);
        }
        return Row(children: [
          Expanded(
              child: _buildStatCard('Daily Quest', 'Watch 5 Projects', '3/5 • +50 pts',
                  Icons.emoji_events, const Color(0xFFFDE68A), const Color(0xFFD97706))),
          const SizedBox(width: 12),
          Expanded(
              child: _buildStatCard('Score', score, 'Rank #42',
                  Icons.stars, const Color(0xFFF3F4F6), const Color(0xFF3B82F6))),
          const SizedBox(width: 12),
          Expanded(
              child: _buildStatCard('Your', projects, 'Projects',
                  Icons.work_outline, const Color(0xFFF3F4F6), const Color(0xFF10B981))),
        ]);
      }),
    );
  }

  Widget _buildStatCard(String label, String value, String subtitle,
      IconData icon, Color bgColor, Color iconColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: bgColor, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(icon, color: iconColor, size: 18),
          const SizedBox(width: 4),
          Flexible(
            child: Text(label,
                style: GoogleFonts.nunito(
                    fontSize: 11, color: iconColor, fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis),
          ),
        ]),
        const SizedBox(height: 8),
        Text(value,
            style: GoogleFonts.nunito(fontWeight: FontWeight.w900, 
              fontSize: label == 'Score' || label == 'Your' ? 24 : 14,
              color: Colors.black87,
            )),
        const SizedBox(height: 4),
        Text(subtitle,
            style: GoogleFonts.nunito(fontSize: 11, color: Colors.black54)),
      ]),
    );
  }

  Widget _buildContinueWatching() {
    if (_filteredVideos.isEmpty) return const SizedBox.shrink();
    return _buildHorizontalSection(
        'Continue Watching', _filteredVideos.take(5).toList(), height: 180, cardWidth: 280);
  }

  Widget _buildForYou() {
    if (_filteredVideos.length < 6) return const SizedBox.shrink();
    return _buildHorizontalSection(
        'For You', _filteredVideos.skip(5).take(5).toList(), height: 140, cardWidth: 120);
  }

  Widget _buildTrendingNow() {
    if (_filteredVideos.length < 11) return const SizedBox.shrink();
    return _buildHorizontalSection(
        '🔥 Trending Now', _filteredVideos.skip(10).take(5).toList(),
        height: 140, cardWidth: 120);
  }

  Widget _buildHorizontalSection(
    String title,
    List<Map<String, dynamic>> videos, {
    required double height,
    required double cardWidth,
  }) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Text(title,
            style: GoogleFonts.nunito(
                fontSize: 18, fontWeight: FontWeight.w800, color: Colors.black87)),
      ),
      const SizedBox(height: 12),
      SizedBox(
        height: height,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: videos.length,
          itemBuilder: (_, i) => cardWidth >= 200
              ? _buildVideoCard(videos[i], width: cardWidth)
              : _buildSmallVideoCard(videos[i]),
        ),
      ),
    ]);
  }

  // ── Guest content ─────────────────────────────────────────────────────────

  Widget _buildGuestContent() {
    return SliverList(
      delegate: SliverChildListDelegate([
        _buildSearchBar(),
        const SizedBox(height: 24),
        _buildCategories(),
        const SizedBox(height: 24),
        _buildFeatured(),
        const SizedBox(height: 24),
        _buildAllProjects(),
        const SizedBox(height: 24),
      ]),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: TextField(
        controller: _searchController,
        style: GoogleFonts.nunito(fontSize: 14),
        onChanged: (query) {
          setState(() {
            _filteredVideos = query.isEmpty
                ? _allVideos
                : _allVideos.where((v) {
                    final t = v['title']?.toLowerCase() ?? '';
                    final c = v['channelTitle']?.toLowerCase() ?? '';
                    final q = query.toLowerCase();
                    return t.contains(q) || c.contains(q);
                  }).toList();
          });
        },
        decoration: InputDecoration(
          hintText: 'Search projects, makers...',
          hintStyle: GoogleFonts.nunito(fontSize: 14, color: Colors.black38),
          prefixIcon: const Icon(Icons.search, color: Colors.black38, size: 20),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, color: Colors.black38, size: 20),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _filteredVideos = _allVideos);
                  },
                )
              : const Icon(Icons.tune, color: Colors.black38, size: 20),
          filled: true,
          fillColor: const Color(0xFFF3F4F6),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none),
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }

  Widget _buildCategories() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Text('Categories',
            style: GoogleFonts.nunito(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Colors.black87)),
      ),
      const SizedBox(height: 12),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // All
            Expanded(
              child: GestureDetector(
                onTap: () => _filterVideos('All'),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  child: Column(children: [
                    Container(
                      width: 60, height: 60,
                      decoration: BoxDecoration(
                        color: _selectedCategory == 'All'
                            ? const Color(0xFF3B82F6)
                            : const Color(0xFFE5E7EB),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(Icons.apps,
                          color: _selectedCategory == 'All'
                              ? Colors.white
                              : Colors.black54,
                          size: 28),
                    ),
                    const SizedBox(height: 8),
                    Text('All',
                        style: GoogleFonts.nunito(
                          fontSize: 11,
                          fontWeight: _selectedCategory == 'All'
                              ? FontWeight.w700
                              : FontWeight.normal,
                          color: _selectedCategory == 'All'
                              ? const Color(0xFF3B82F6)
                              : Colors.black87,
                        ),
                        textAlign: TextAlign.center),
                  ]),
                ),
              ),
            ),
            // Other categories
            ..._categories.map((cat) {
              final isSelected = _selectedCategory == cat['name'];
              return Expanded(
                child: GestureDetector(
                  onTap: () => _filterVideos(cat['name']),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    child: Column(children: [
                      Container(
                        width: 60, height: 60,
                        decoration: BoxDecoration(
                          color: isSelected
                              ? cat['color']
                              : const Color(0xFFF3F4F6),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(cat['icon'],
                            color: isSelected ? Colors.white : Colors.black54,
                            size: 28),
                      ),
                      const SizedBox(height: 8),
                      Text(cat['name'],
                          style: GoogleFonts.nunito(
                            fontSize: 11,
                            fontWeight:
                                isSelected ? FontWeight.w700 : FontWeight.normal,
                            color: isSelected
                                ? cat['color'] as Color
                                : Colors.black87,
                          ),
                          textAlign: TextAlign.center),
                    ]),
                  ),
                ),
              );
            }).toList(),
          ],
        ),
      ),
    ]);
  }

  Widget _buildFeatured() {
    if (_filteredVideos.isEmpty) return const SizedBox.shrink();
    final featured = _filteredVideos.first;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Featured',
                style: GoogleFonts.nunito(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.black87)),
            TextButton(
              onPressed: () {},
              child: Text('See All →',
                  style: GoogleFonts.nunito(
                      fontSize: 12, color: const Color(0xFF3B82F6))),
            ),
          ],
        ),
      ),
      const SizedBox(height: 8),

      // ── Featured card — image only, NO white section underneath ──
      GestureDetector(
        onTap: () => _openVideo(featured),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          // ✅ FIX: height is ONLY the image — no extra white area below
          height: 200,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(
              fit: StackFit.expand,   // ✅ Stack fills exactly 200px, nothing more
              children: [
                // Thumbnail image
                featured['thumbnail'] != null
                    ? Image.network(
                        featured['thumbnail'],
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: const Color(0xFFDEEEFF),
                          child: const Center(
                            child: Icon(Icons.video_library,
                                size: 60, color: Colors.grey),
                          ),
                        ),
                      )
                    : Container(
                        color: const Color(0xFFDEEEFF),
                        child: const Center(
                          child: Icon(Icons.video_library,
                              size: 60, color: Colors.grey),
                        ),
                      ),

                // Dark gradient overlay — bottom to top (no white box)
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withOpacity(0.65),
                        ],
                        stops: const [0.45, 1.0],
                      ),
                    ),
                  ),
                ),

                // Featured badge — top left
                Positioned(
                  top: 12, left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('Featured',
                        style: GoogleFonts.nunito(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Colors.white)),
                  ),
                ),

                // Play button — centre
                Center(
                  child: Container(
                    width: 56, height: 56,
                    decoration: const BoxDecoration(
                        color: Colors.white, shape: BoxShape.circle),
                    child: const Icon(Icons.play_arrow,
                        size: 34, color: Color(0xFF3B82F6)),
                  ),
                ),

                // Title + channel — bottom, white text on gradient
                Positioned(
                  bottom: 14, left: 14, right: 14,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        featured['title'] ?? '',
                        style: GoogleFonts.nunito(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'by ${featured['channelTitle'] ?? 'MiniGuru'}',
                        style: GoogleFonts.nunito(
                            fontSize: 11, color: Colors.white70),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ]);
  }

  Widget _buildAllProjects() {
    if (_isLoadingVideos) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: CircularProgressIndicator(color: Color(0xFF3B82F6)),
        ),
      );
    }

    if (_filteredVideos.length < 2) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(children: [
            const Icon(Icons.video_library_outlined, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              _searchController.text.isEmpty
                  ? 'No videos available'
                  : 'No results for "${_searchController.text}"',
              style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey),
            ),
          ]),
        ),
      );
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              _selectedCategory == 'All'
                  ? 'All Projects'
                  : '$_selectedCategory Projects',
              style: GoogleFonts.nunito(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.black87),
            ),
            if (_filteredVideos.length > 13)
              Text('${_filteredVideos.length - 1} videos',
                  style: GoogleFonts.nunito(fontSize: 12, color: Colors.black54)),
          ],
        ),
      ),
      const SizedBox(height: 12),
      LayoutBuilder(builder: (context, constraints) {
        int crossAxisCount = 2;
        double childAspectRatio = 0.75;
        if (constraints.maxWidth > 1200) {
          crossAxisCount = 4; childAspectRatio = 0.8;
        } else if (constraints.maxWidth > 800) {
          crossAxisCount = 3; childAspectRatio = 0.75;
        }
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            childAspectRatio: childAspectRatio,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: _filteredVideos.skip(1).take(12).length,
          itemBuilder: (_, i) => _buildProjectCard(_filteredVideos[i + 1]),
        );
      }),
    ]);
  }

  // ── Video card widgets ────────────────────────────────────────────────────

  Widget _buildVideoCard(Map<String, dynamic> video, {double width = 280}) {
    return GestureDetector(
      onTap: () => _openVideo(video),
      child: Container(
        width: width,
        margin: const EdgeInsets.only(right: 12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            fit: StackFit.expand,
            children: [
              video['thumbnail'] != null
                  ? Image.network(video['thumbnail'],
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        color: const Color(0xFF64748B),
                        child: const Icon(Icons.video_library,
                            size: 40, color: Colors.white54),
                      ))
                  : Container(
                      color: const Color(0xFF64748B),
                      child: const Icon(Icons.video_library,
                          size: 40, color: Colors.white54),
                    ),
              // Gradient
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black.withOpacity(0.7)],
                      stops: const [0.5, 1.0],
                    ),
                  ),
                ),
              ),
              // Play
              Center(
                child: Container(
                  width: 50, height: 50,
                  decoration: const BoxDecoration(
                      color: Colors.white, shape: BoxShape.circle),
                  child: const Icon(Icons.play_arrow,
                      size: 30, color: Color(0xFF3B82F6)),
                ),
              ),
              // Info
              Positioned(
                bottom: 10, left: 12, right: 12,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(video['title'] ?? '',
                        style: GoogleFonts.nunito(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text('@${video['channelTitle'] ?? 'miniguru'}',
                        style: GoogleFonts.nunito(
                            fontSize: 10, color: Colors.white70)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSmallVideoCard(Map<String, dynamic> video) {
    return GestureDetector(
      onTap: () => _openVideo(video),
      child: Container(
        width: 120,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 120, height: 90,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (video['thumbnail'] != null)
                      Image.network(video['thumbnail'],
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                              color: const Color(0xFFD1D5DB),
                              child: const Icon(Icons.video_library,
                                  size: 30, color: Colors.grey))),
                    Center(
                      child: Container(
                        width: 36, height: 36,
                        decoration: const BoxDecoration(
                            color: Colors.white, shape: BoxShape.circle),
                        child: const Icon(Icons.play_arrow,
                            size: 20, color: Color(0xFF3B82F6)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // ✅ Tight text below — no Spacer, no Expanded — zero extra gap
            const SizedBox(height: 6),
            Text(video['title'] ?? '',
                style: GoogleFonts.nunito(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }

  // ✅ FIX: Project card uses Stack/overlay — NO white Expanded section below image
  Widget _buildProjectCard(Map<String, dynamic> video) {
    return GestureDetector(
      onTap: () => _openVideo(video),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Full-bleed thumbnail
            video['thumbnail'] != null
                ? Image.network(video['thumbnail'],
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                        color: const Color(0xFFFDE68A),
                        child: const Icon(Icons.video_library,
                            size: 40, color: Colors.grey)))
                : Container(
                    color: const Color(0xFFFDE68A),
                    child: const Icon(Icons.video_library,
                        size: 40, color: Colors.grey)),

            // Gradient overlay bottom
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withOpacity(0.72),
                    ],
                    stops: const [0.5, 1.0],
                  ),
                ),
              ),
            ),

            // Play button
            Center(
              child: Container(
                width: 38, height: 38,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.9),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.play_arrow,
                    size: 22, color: Color(0xFF3B82F6)),
              ),
            ),

            // Title + channel at bottom — white text on gradient
            Positioned(
              bottom: 8, left: 8, right: 8,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(video['title'] ?? '',
                      style: GoogleFonts.nunito(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Colors.white),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text('@${video['channelTitle'] ?? 'maker'}',
                      style: GoogleFonts.nunito(
                          fontSize: 9, color: Colors.white70)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openVideo(Map<String, dynamic> video) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UnifiedVideoPlayer(
          videoId: video['videoId']?.toString() ?? '',
          title: video['title']?.toString() ?? '',
          description: video['description']?.toString() ?? '',
          channelTitle: video['channelTitle']?.toString() ?? '',
          views: video['viewCount'] is String
              ? int.tryParse(video['viewCount'])
              : video['viewCount'] as int?,
        ),
      ),
    );
  }
}