import 'package:flutter/material.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/services/youtube_service.dart';
import 'package:miniguru/screens/unifiedVideoPlayer.dart'; // ✅ FIXED: Correct import
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
    {'name': 'Robotics', 'icon': Icons.precision_manufacturing, 'color': Color(0xFF93C5FD)},
    {'name': 'Electronics', 'icon': Icons.flash_on, 'color': Color(0xFFFDE68A)},
    {'name': 'Arts', 'icon': Icons.palette, 'color': Color(0xFFFCA5A5)},
    {'name': 'Science', 'icon': Icons.science, 'color': Color(0xFF86EFAC)},
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
      if (mounted) {
        setState(() {
          _isLoadingVideos = false;
        });
      }
    }
  }

  void _filterVideos(String category) {
    setState(() {
      _selectedCategory = category;
      if (category == 'All') {
        _filteredVideos = _allVideos;
      } else {
        _filteredVideos = YouTubeService.filterByCategory(_allVideos, category);
      }
    });
  }

  Future<void> _refreshAll() async {
    await Future.wait([
      _checkAuthAndLoadData(),
      _loadYouTubeVideos(),
    ]);
  }

  Future<void> _logout() async {
    try {
      await _miniguruApi.logout();
      if (mounted) {
        setState(() {
          user = null;
          _isAuthenticated = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Logged out successfully', style: GoogleFonts.poppins()),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      print('Logout error: $e');
    }
  }

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
              if (_isAuthenticated && user != null) ...[
                _buildAuthenticatedContent(),
              ] else ...[
                _buildGuestContent(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // ==================== APP BAR ====================
  Widget _buildAppBar() {
    return SliverAppBar(
      floating: true,
      backgroundColor: Colors.white,
      elevation: 0,
      title: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Color(0xFF3B82F6),
              borderRadius: BorderRadius.circular(8),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                'assets/mg-logo.png',
                width: 32,
                height: 32,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Icon(Icons.lightbulb, color: Colors.white, size: 20);
                },
              ),
            ),
          ),
          SizedBox(width: 12),
          Text(
            'MiniGuru',
            style: GoogleFonts.poppins(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
        ],
      ),
      actions: [
        if (_isAuthenticated && user != null) ...[
          _buildUserAvatar(),
        ] else ...[
          TextButton(
            onPressed: () => Navigator.pushNamed(context, LoginScreen.id),
            child: Text(
              'Login / Signup',
              style: GoogleFonts.poppins(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF3B82F6),
              ),
            ),
          ),
          SizedBox(width: 8),
        ],
      ],
    );
  }

  Widget _buildUserAvatar() {
    final userName = user?.name ?? 'User';
    
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: PopupMenuButton<String>(
        offset: Offset(0, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            Text(
              'Hi, ',
              style: GoogleFonts.poppins(
                fontSize: 14,
                color: Colors.black54,
              ),
            ),
            Text(
              userName.split(' ')[0],
              style: GoogleFonts.poppins(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
            ),
            SizedBox(width: 4),
            Icon(Icons.arrow_drop_down, color: Colors.black54, size: 20),
          ],
        ),
        onSelected: (value) {
          if (value == 'logout') _logout();
        },
        itemBuilder: (context) => [
          PopupMenuItem(
            value: 'profile',
            child: Row(
              children: [
                Icon(Icons.person_outline, size: 18, color: Color(0xFF3B82F6)),
                SizedBox(width: 12),
                Text('Profile', style: GoogleFonts.poppins(fontSize: 14)),
              ],
            ),
          ),
          PopupMenuDivider(),
          PopupMenuItem(
            value: 'logout',
            child: Row(
              children: [
                Icon(Icons.logout, size: 18, color: Colors.red),
                SizedBox(width: 12),
                Text('Logout', style: GoogleFonts.poppins(fontSize: 14, color: Colors.red)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ==================== AUTHENTICATED CONTENT ====================
  Widget _buildAuthenticatedContent() {
    return SliverList(
      delegate: SliverChildListDelegate([
        _buildStatsCards(),
        SizedBox(height: 24),
        _buildContinueWatching(),
        SizedBox(height: 24),
        _buildForYou(),
        SizedBox(height: 24),
        _buildTrendingNow(),
        SizedBox(height: 24),
      ]),
    );
  }

  Widget _buildStatsCards() {
    final score = user?.score?.toString() ?? '0';
    final projects = user?.totalProjects?.toString() ?? '0';
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 600) {
            return Column(
              children: [
                _buildStatCard('Daily Quest', 'Watch 5 Projects', '3/5 • +50 pts', 
                    Icons.emoji_events, Color(0xFFFDE68A), Color(0xFFD97706)),
                SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _buildStatCard('Score', score, 'Rank #42', 
                        Icons.stars, Color(0xFFF3F4F6), Color(0xFF3B82F6))),
                    SizedBox(width: 12),
                    Expanded(child: _buildStatCard('Your', projects, 'Projects', 
                        Icons.work_outline, Color(0xFFF3F4F6), Color(0xFF10B981))),
                  ],
                ),
              ],
            );
          }
          
          return Row(
            children: [
              Expanded(child: _buildStatCard('Daily Quest', 'Watch 5 Projects', '3/5 • +50 pts', 
                  Icons.emoji_events, Color(0xFFFDE68A), Color(0xFFD97706))),
              SizedBox(width: 12),
              Expanded(child: _buildStatCard('Score', score, 'Rank #42', 
                  Icons.stars, Color(0xFFF3F4F6), Color(0xFF3B82F6))),
              SizedBox(width: 12),
              Expanded(child: _buildStatCard('Your', projects, 'Projects', 
                  Icons.work_outline, Color(0xFFF3F4F6), Color(0xFF10B981))),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatCard(String label, String value, String subtitle, 
      IconData icon, Color bgColor, Color iconColor) {
    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 18),
              SizedBox(width: 4),
              Flexible(
                child: Text(
                  label,
                  style: GoogleFonts.poppins(
                    fontSize: 11,
                    color: iconColor,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.poppins(
              fontSize: label == 'Score' || label == 'Your' ? 24 : 14,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          SizedBox(height: 4),
          Text(
            subtitle,
            style: GoogleFonts.poppins(
              fontSize: 11,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContinueWatching() {
    if (_filteredVideos.isEmpty) return SizedBox.shrink();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Continue Watching',
            style: GoogleFonts.poppins(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
        ),
        SizedBox(height: 12),
        Container(
          height: 180,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: 16),
            itemCount: _filteredVideos.take(5).length,
            itemBuilder: (context, index) {
              final video = _filteredVideos[index];
              return _buildVideoCard(video, width: 280);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildForYou() {
    if (_filteredVideos.length < 6) return SizedBox.shrink();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'For You',
            style: GoogleFonts.poppins(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
        ),
        SizedBox(height: 12),
        Container(
          height: 140,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: 16),
            itemCount: _filteredVideos.skip(5).take(5).length,
            itemBuilder: (context, index) {
              final video = _filteredVideos[index + 5];
              return _buildSmallVideoCard(video);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildTrendingNow() {
    if (_filteredVideos.length < 11) return SizedBox.shrink();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Icon(Icons.local_fire_department, color: Color(0xFFF59E0B), size: 20),
              SizedBox(width: 4),
              Text(
                'Trending Now',
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 12),
        Container(
          height: 140,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: 16),
            itemCount: _filteredVideos.skip(10).take(5).length,
            itemBuilder: (context, index) {
              final video = _filteredVideos[index + 10];
              return _buildSmallVideoCard(video);
            },
          ),
        ),
      ],
    );
  }

  // ==================== GUEST CONTENT ====================
  Widget _buildGuestContent() {
    return SliverList(
      delegate: SliverChildListDelegate([
        _buildSearchBar(),
        SizedBox(height: 24),
        _buildCategories(),
        SizedBox(height: 24),
        _buildFeatured(),
        SizedBox(height: 24),
        _buildAllProjects(),
        SizedBox(height: 24),
      ]),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: TextField(
        controller: _searchController,
        onChanged: (query) {
          setState(() {
            if (query.isEmpty) {
              _filteredVideos = _allVideos;
            } else {
              _filteredVideos = _allVideos.where((video) {
                final title = video['title']?.toLowerCase() ?? '';
                final channel = video['channelTitle']?.toLowerCase() ?? '';
                final searchQuery = query.toLowerCase();
                return title.contains(searchQuery) || channel.contains(searchQuery);
              }).toList();
            }
          });
        },
        decoration: InputDecoration(
          hintText: 'Search projects, makers...',
          hintStyle: GoogleFonts.poppins(fontSize: 14, color: Colors.black38),
          prefixIcon: Icon(Icons.search, color: Colors.black38, size: 20),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: Icon(Icons.clear, color: Colors.black38, size: 20),
                  onPressed: () {
                    _searchController.clear();
                    setState(() {
                      _filteredVideos = _allVideos;
                    });
                  },
                )
              : Icon(Icons.tune, color: Colors.black38, size: 20),
          filled: true,
          fillColor: Color(0xFFF3F4F6),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          contentPadding: EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }

  Widget _buildCategories() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Categories',
            style: GoogleFonts.poppins(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
        ),
        SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // "All" category button
              Expanded(
                child: GestureDetector(
                  onTap: () => _filterVideos('All'),
                  child: Container(
                    margin: EdgeInsets.only(right: 8),
                    child: Column(
                      children: [
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: _selectedCategory == 'All' 
                                ? Color(0xFF3B82F6) 
                                : Color(0xFFE5E7EB),
                            borderRadius: BorderRadius.circular(16),
                            border: _selectedCategory == 'All'
                                ? Border.all(color: Color(0xFF3B82F6), width: 2)
                                : null,
                          ),
                          child: Icon(
                            Icons.apps, 
                            color: _selectedCategory == 'All' 
                                ? Colors.white 
                                : Colors.black54, 
                            size: 28,
                          ),
                        ),
                        SizedBox(height: 8),
                        Text(
                          'All',
                          style: GoogleFonts.poppins(
                            fontSize: 11,
                            fontWeight: _selectedCategory == 'All' 
                                ? FontWeight.w600 
                                : FontWeight.normal,
                            color: _selectedCategory == 'All' 
                                ? Color(0xFF3B82F6) 
                                : Colors.black87,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
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
                      margin: EdgeInsets.only(right: 8),
                      child: Column(
                        children: [
                          Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              color: isSelected ? cat['color'] : Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(16),
                              border: isSelected 
                                  ? Border.all(color: cat['color'], width: 2)
                                  : null,
                            ),
                            child: Icon(
                              cat['icon'], 
                              color: isSelected ? Colors.white : Colors.black54, 
                              size: 28,
                            ),
                          ),
                          SizedBox(height: 8),
                          Text(
                            cat['name'],
                            style: GoogleFonts.poppins(
                              fontSize: 11,
                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                              color: isSelected ? cat['color'] : Colors.black87,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFeatured() {
    if (_filteredVideos.isEmpty) return SizedBox.shrink();
    
    final featured = _filteredVideos.first;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Featured',
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
              TextButton(
                onPressed: () {
                  // Could implement see all featured videos
                },
                child: Text(
                  'See All →',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: Color(0xFF3B82F6),
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 8),
        GestureDetector(
          onTap: () => _openVideo(featured),
          child: Container(
            margin: EdgeInsets.symmetric(horizontal: 16),
            height: 180,
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: double.infinity,
                    height: 180,
                    color: Color(0xFFDEEEFF),
                    child: featured['thumbnail'] != null
                        ? Image.network(
                            featured['thumbnail'],
                            width: double.infinity,
                            height: 180,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) {
                              return Center(
                                child: Icon(Icons.video_library, size: 60, color: Colors.grey),
                              );
                            },
                          )
                        : Center(
                            child: Icon(Icons.video_library, size: 60, color: Colors.grey),
                          ),
                  ),
                ),
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Color(0xFFEF4444),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Featured',
                      style: GoogleFonts.poppins(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                Center(
                  child: Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.play_arrow, size: 36, color: Color(0xFF3B82F6)),
                  ),
                ),
                Positioned(
                  bottom: 12,
                  left: 12,
                  right: 12,
                  child: Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          featured['title'] ?? '',
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.black87,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        SizedBox(height: 2),
                        Text(
                          'by ${featured['channelTitle'] ?? 'MiniGuru'}',
                          style: GoogleFonts.poppins(
                            fontSize: 10,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAllProjects() {
    if (_isLoadingVideos) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: CircularProgressIndicator(color: Color(0xFF3B82F6)),
        ),
      );
    }

    if (_filteredVideos.length < 2) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              Icon(Icons.video_library_outlined, size: 64, color: Colors.grey),
              SizedBox(height: 16),
              Text(
                _searchController.text.isEmpty 
                    ? 'No videos available' 
                    : 'No videos found for "${_searchController.text}"',
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
      );
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _selectedCategory == 'All' 
                    ? 'All Projects' 
                    : '$_selectedCategory Projects',
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
              if (_filteredVideos.length > 13)
                Text(
                  '${_filteredVideos.length - 1} videos',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: Colors.black54,
                  ),
                ),
            ],
          ),
        ),
        SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            int crossAxisCount = 2;
            double childAspectRatio = 0.75;
            
            if (constraints.maxWidth > 1200) {
              crossAxisCount = 4;
              childAspectRatio = 0.8;
            } else if (constraints.maxWidth > 800) {
              crossAxisCount = 3;
              childAspectRatio = 0.75;
            }
            
            return GridView.builder(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              padding: EdgeInsets.symmetric(horizontal: 16),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossAxisCount,
                childAspectRatio: childAspectRatio,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: _filteredVideos.skip(1).take(12).length,
              itemBuilder: (context, index) {
                final video = _filteredVideos[index + 1];
                return _buildProjectCard(video);
              },
            );
          },
        ),
      ],
    );
  }

// ==================== VIDEO CARDS ====================
Widget _buildVideoCard(Map<String, dynamic> video, {double width = 280}) {
  return GestureDetector(
    onTap: () {
      print('🎬 VIDEO CARD CLICKED: ${video['videoId']}');
      print('📹 Video Data: ${video.toString()}');
      _openVideo(video);
    },
    child: Container(
      width: width,
      margin: EdgeInsets.only(right: 12),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Container(
              width: width,
              height: 180,
              color: Color(0xFF64748B),
              child: video['thumbnail'] != null
                  ? Image.network(
                      video['thumbnail'],
                      width: width,
                      height: 180,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return Center(
                          child: Icon(Icons.video_library, size: 40, color: Colors.white54),
                        );
                      },
                    )
                  : Center(
                      child: Icon(Icons.video_library, size: 40, color: Colors.white54),
                    ),
            ),
          ),
          Center(
            child: Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.play_arrow, size: 30, color: Color(0xFF3B82F6)),
            ),
          ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Colors.black87, Colors.transparent],
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(16),
                  bottomRight: Radius.circular(16),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    video['title'] ?? '',
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: 4),
                  Text(
                    '@${video['channelTitle'] ?? 'miniguru'}',
                    style: GoogleFonts.poppins(
                      fontSize: 10,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _buildSmallVideoCard(Map<String, dynamic> video) {
  return GestureDetector(
    onTap: () {
      print('🎬 SMALL VIDEO CLICKED: ${video['videoId']}');
      _openVideo(video);
    },
    child: Container(
      width: 120,
      margin: EdgeInsets.only(right: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 120,
              height: 90,
              color: Color(0xFFD1D5DB),
              child: Stack(
                children: [
                  if (video['thumbnail'] != null)
                    Image.network(
                      video['thumbnail'],
                      width: 120,
                      height: 90,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return Center(
                          child: Icon(Icons.video_library, size: 30, color: Colors.grey),
                        );
                      },
                    ),
                  Center(
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.play_arrow, size: 20, color: Color(0xFF3B82F6)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: 6),
          Text(
            video['title'] ?? '',
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: Colors.black87,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    ),
  );
}

Widget _buildProjectCard(Map<String, dynamic> video) {
  return GestureDetector(
    onTap: () {
      print('🎬 PROJECT CARD CLICKED: ${video['videoId']}');
      _openVideo(video);
    },
    child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(12),
              topRight: Radius.circular(12),
            ),
            child: Container(
              height: 120,
              color: Color(0xFFFDE68A),
              child: Stack(
                children: [
                  if (video['thumbnail'] != null)
                    Image.network(
                      video['thumbnail'],
                      width: double.infinity,
                      height: 120,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return Center(
                          child: Icon(Icons.video_library, size: 40, color: Colors.grey),
                        );
                      },
                    ),
                  Center(
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.play_arrow, size: 24, color: Color(0xFF3B82F6)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    video['title'] ?? '',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Spacer(),
                  Text(
                    '@${video['channelTitle'] ?? 'maker'}',
                    style: GoogleFonts.poppins(
                      fontSize: 9,
                      color: Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

void _openVideo(Map<String, dynamic> video) {
  print('🚀 OPENING VIDEO PLAYER');
  print('📹 Video ID: ${video['videoId']}');
  print('📝 Title: ${video['title']}');
  
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (context) => UnifiedVideoPlayer(
        videoId: video['videoId'] ?? '',
        title: video['title'] ?? '',
        description: video['description'] ?? '',
        channelTitle: video['channelTitle'] ?? '',
        views: video['viewCount'],
      ),
    ),
  );
}
}  // ✅ Class closing brace - DO NOT REMOVE!