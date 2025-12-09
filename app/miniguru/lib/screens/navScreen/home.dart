import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/services/youtube_service.dart';
import 'package:miniguru/screens/youtubePlayerScreen.dart';
import 'package:google_fonts/google_fonts.dart';

class Home extends StatefulWidget {
  const Home({super.key});

  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> with AutomaticKeepAliveClientMixin {
  User? user;
  final _miniguruApi = MiniguruApi();
  bool _isLoading = true;
  bool _isAuthenticated = false;
  bool _isLoadingVideos = true;
  
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory = 'All';
  
  final List<String> _categories = [
    'All',
    'Show Piece',
    'Working Model',
    'Science Experiment',
    'Magic Science',
    'Life Hack',
    'Electronics',
  ];

  List<Map<String, dynamic>> _allVideos = [];
  List<Map<String, dynamic>> _filteredVideos = [];

  @override
  bool get wantKeepAlive => true;

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
      print('ℹ️  User not authenticated: $e');
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
      print('📺 Fetching videos from MiniGuru YouTube channel...');
      final videos = await YouTubeService.getChannelVideos(maxResults: 50);
      
      if (mounted) {
        setState(() {
          _allVideos = videos;
          _filteredVideos = videos;
          _isLoadingVideos = false;
        });
        print('✅ Loaded ${videos.length} videos from YouTube');
      }
    } catch (e) {
      print('❌ Error loading YouTube videos: $e');
      if (mounted) {
        setState(() {
          _isLoadingVideos = false;
        });
      }
    }
  }

  void _filterVideos() {
    setState(() {
      _filteredVideos = YouTubeService.filterByCategory(
        _allVideos,
        _selectedCategory,
      );

      // Apply search filter
      if (_searchController.text.isNotEmpty) {
        final query = _searchController.text.toLowerCase();
        _filteredVideos = _filteredVideos.where((video) {
          final title = video['title'].toString().toLowerCase();
          final description = video['description'].toString().toLowerCase();
          return title.contains(query) || description.contains(query);
        }).toList();
      }
    });
  }

  Future<void> _refreshAll() async {
    await Future.wait([
      _checkAuthAndLoadData(),
      _loadYouTubeVideos(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Scaffold(
      backgroundColor: backgroundWhite,
      body: SafeArea(
        child: Column(
          children: [
            // Header with Logo and Auth Buttons
            _buildHeader(),
            
            // Search Bar
            _buildSearchBar(),
            
            // Authenticated User Stats
            if (_isAuthenticated && user != null) ...[
              _buildUserStats(),
            ],
            
            // Category Filter
            _buildCategoryFilter(),
            
            // Powered by YouTube Banner
            _buildYouTubeBanner(),
            
            // Video Feed
            Expanded(
              child: _buildVideoFeed(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Logo
          Row(
            children: [
              Image.asset(
                'assets/mg-logo.png',
                width: 40,
                height: 40,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: pastelBlue,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.science, color: Colors.white),
                  );
                },
              ),
              const SizedBox(width: 12),
              Text(
                'MiniGuru',
                style: GoogleFonts.poppins(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: pastelBlueText,
                ),
              ),
            ],
          ),
          
          // Auth Buttons or User Profile
          _isAuthenticated ? _buildUserMenu() : _buildAuthButtons(),
        ],
      ),
    );
  }

  Widget _buildAuthButtons() {
    return Row(
      children: [
        OutlinedButton(
          onPressed: () {
            Navigator.pushNamed(context, LoginScreen.id);
          },
          style: OutlinedButton.styleFrom(
            foregroundColor: pastelBlueText,
            side: const BorderSide(color: pastelBlueText),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          ),
          child: const Text('Login'),
        ),
        const SizedBox(width: 8),
        ElevatedButton(
          onPressed: () {
            Navigator.pushNamed(context, RegisterScreen.id);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: pastelBlueText,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          ),
          child: const Text('Sign Up'),
        ),
      ],
    );
  }

  Widget _buildUserMenu() {
    return PopupMenuButton<String>(
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: pastelBlue,
            child: Text(
              user?.name[0].toUpperCase() ?? 'U',
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.arrow_drop_down, color: Colors.black54),
        ],
      ),
      onSelected: (value) {
        if (value == 'profile') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Navigate to Profile')),
          );
        } else if (value == 'projects') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Navigate to My Projects')),
          );
        }
      },
      itemBuilder: (context) => [
        PopupMenuItem(
          value: 'profile',
          child: Row(
            children: [
              const Icon(Icons.person, size: 20),
              const SizedBox(width: 12),
              Text('Update Profile', style: GoogleFonts.poppins()),
            ],
          ),
        ),
        PopupMenuItem(
          value: 'projects',
          child: Row(
            children: [
              const Icon(Icons.folder, size: 20),
              const SizedBox(width: 12),
              Text('My Projects', style: GoogleFonts.poppins()),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      child: TextField(
        controller: _searchController,
        decoration: InputDecoration(
          hintText: 'Search videos...',
          hintStyle: GoogleFonts.poppins(color: Colors.grey),
          prefixIcon: const Icon(Icons.search, color: pastelBlueText),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    setState(() {
                      _searchController.clear();
                      _filterVideos();
                    });
                  },
                )
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          filled: true,
          fillColor: Colors.grey.shade100,
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
        ),
        onChanged: (value) {
          _filterVideos();
        },
      ),
    );
  }

  Widget _buildUserStats() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [pastelBlue, Color(0xFFE3F2FD)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: pastelBlue.withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildQuickStat('Score', user?.score.toString() ?? '0', Icons.stars),
          _buildQuickStat('Projects', user?.totalProjects.toString() ?? '0', Icons.work),
          _buildQuickStat('Wallet', '₹${user?.walletBalance.toInt() ?? 0}', Icons.account_balance_wallet),
        ],
      ),
    );
  }

  Widget _buildQuickStat(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: pastelBlueText, size: 28),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.poppins(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            color: Colors.black54,
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryFilter() {
    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          final category = _categories[index];
          final isSelected = category == _selectedCategory;
          
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                category,
                style: GoogleFonts.poppins(fontSize: 13),
              ),
              selected: isSelected,
              onSelected: (selected) {
                setState(() {
                  _selectedCategory = category;
                  _filterVideos();
                });
              },
              backgroundColor: Colors.white,
              selectedColor: pastelBlue,
              checkmarkColor: pastelBlueText,
              labelStyle: TextStyle(
                color: isSelected ? pastelBlueText : Colors.grey.shade700,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected ? pastelBlueText : Colors.grey.shade300,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildYouTubeBanner() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.play_circle_outline, color: Colors.red.shade700, size: 20),
          const SizedBox(width: 8),
          Text(
            'Powered by YouTube',
            style: GoogleFonts.poppins(
              fontSize: 12,
              color: Colors.red.shade700,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          Text(
            '${_filteredVideos.length} videos',
            style: GoogleFonts.poppins(
              fontSize: 11,
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVideoFeed() {
    if (_isLoadingVideos) {
      return const Center(
        child: CircularProgressIndicator(color: pastelBlueText),
      );
    }

    if (_filteredVideos.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.video_library_outlined, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              'No videos found',
              style: GoogleFonts.poppins(
                fontSize: 16,
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _loadYouTubeVideos,
              child: Text('Retry', style: GoogleFonts.poppins()),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _refreshAll,
      color: pastelBlueText,
      child: LayoutBuilder(
        builder: (context, constraints) {
          int crossAxisCount = constraints.maxWidth > 600 ? 3 : 2;
          
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
              childAspectRatio: 0.75,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
            ),
            itemCount: _filteredVideos.length,
            itemBuilder: (context, index) {
              final video = _filteredVideos[index];
              return _buildYouTubeVideoCard(video);
            },
          );
        },
      ),
    );
  }

  Widget _buildYouTubeVideoCard(Map<String, dynamic> video) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => YouTubePlayerScreen(
              videoId: video['videoId'],
              title: video['title'],
              description: video['description'],
              channelTitle: video['channelTitle'],
            ),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // YouTube Thumbnail
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(12),
                    topRight: Radius.circular(12),
                  ),
                  child: Image.network(
                    video['thumbnail'],
                    height: 120,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        height: 120,
                        color: pastelBlue.withOpacity(0.3),
                        child: const Icon(Icons.play_circle_outline, size: 48),
                      );
                    },
                  ),
                ),
                Positioned(
                  bottom: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.play_arrow, color: Colors.white, size: 12),
                        const SizedBox(width: 2),
                        Text(
                          'YouTube',
                          style: GoogleFonts.poppins(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            
            // Video Info
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    video['title'],
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    video['channelTitle'],
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}