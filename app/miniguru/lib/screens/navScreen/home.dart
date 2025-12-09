import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/screens/videoPlayerScreen.dart';
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
  
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory = 'All';
  
  final List<String> _categories = [
    'All',
    'Show Piece',
    'Working Mechanical Model',
    'Science Experiment',
    'Magic Science',
    'Life Hack',
    'Electronics Project',
  ];

  // Mock video data - Replace with API call
  final List<Map<String, dynamic>> _videos = [
    {
      'title': 'Amazing Robot Project',
      'creator': 'Tech Kids',
      'views': '1.2K',
      'duration': '5:30',
      'category': 'Working Mechanical Model',
    },
    {
      'title': 'Volcano Science Experiment',
      'creator': 'Science Fun',
      'views': '890',
      'duration': '3:15',
      'category': 'Science Experiment',
    },
    {
      'title': 'LED Cube Display',
      'creator': 'Electronics Pro',
      'views': '2.1K',
      'duration': '8:20',
      'category': 'Electronics Project',
    },
  ];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _checkAuthAndLoadData();
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
            
            // Authenticated User Stats (only shown when logged in)
            if (_isAuthenticated && user != null) ...[
              _buildUserStats(),
            ],
            
            // Category Filter
            _buildCategoryFilter(),
            
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
          // Navigate to profile - you can implement this
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Navigate to Profile')),
          );
        } else if (value == 'projects') {
          // Navigate to projects list
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
          hintText: 'Search projects and videos...',
          hintStyle: GoogleFonts.poppins(color: Colors.grey),
          prefixIcon: const Icon(Icons.search, color: pastelBlueText),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    setState(() {
                      _searchController.clear();
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
          setState(() {}); // Rebuild to show/hide clear button
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

  Widget _buildVideoFeed() {
    return RefreshIndicator(
      onRefresh: _checkAuthAndLoadData,
      color: pastelBlueText,
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Responsive grid - more columns on wider screens
          int crossAxisCount = constraints.maxWidth > 600 ? 3 : 2;
          
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
              childAspectRatio: 0.75,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
            ),
            itemCount: _videos.length * 3, // Repeat for demo
            itemBuilder: (context, index) {
              final video = _videos[index % _videos.length];
              return _buildVideoCard(video);
            },
          );
        },
      ),
    );
  }

  Widget _buildVideoCard(Map<String, dynamic> video) {
    return GestureDetector(
      onTap: () {
        // Navigate to Video Player Screen
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => VideoPlayerScreen(
              projectId: 'demo_${video['title']}', // TODO: Use actual project ID
              title: video['title'],
              description: 'Sample description for ${video['title']}',
              creatorName: video['creator'],
              views: video['views'],
              category: video['category'],
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
            // Thumbnail with Duration Badge
            Stack(
              children: [
                Container(
                  height: 120,
                  decoration: BoxDecoration(
                    color: pastelBlue.withOpacity(0.3),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(12),
                      topRight: Radius.circular(12),
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.play_circle_outline,
                      size: 48,
                      color: pastelBlueText.withOpacity(0.7),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      video['duration'],
                      style: GoogleFonts.poppins(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
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
                    video['creator'],
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${video['views']} views',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      color: Colors.grey.shade500,
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