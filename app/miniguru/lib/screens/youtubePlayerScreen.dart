import 'package:flutter/material.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/models/User.dart';

class YouTubePlayerScreen extends StatefulWidget {
  final String videoId;
  final String title;
  final String description;
  final String channelTitle;

  const YouTubePlayerScreen({
    Key? key,
    required this.videoId,
    required this.title,
    required this.description,
    required this.channelTitle,
  }) : super(key: key);

  @override
  State<YouTubePlayerScreen> createState() => _YouTubePlayerScreenState();
}

class _YouTubePlayerScreenState extends State<YouTubePlayerScreen> {
  late YoutubePlayerController _controller;
  final _miniguruApi = MiniguruApi();
  final _commentController = TextEditingController();
  
  User? user;
  bool _isAuthenticated = false;
  
  // Like categories
  Map<String, bool> _likes = {
    'aesthetics': false,
    'sturdy': false,
    'working': false,
    'creative': false,
    'educational': false,
  };
  
  final Map<String, Map<String, dynamic>> _likeData = {
    'aesthetics': {
      'icon': Icons.palette_outlined,
      'label': 'Aesthetic',
      'color': Color(0xFFEC4899),
    },
    'sturdy': {
      'icon': Icons.engineering_outlined,
      'label': 'Sturdy',
      'color': Color(0xFF8B5CF6),
    },
    'working': {
      'icon': Icons.settings_outlined,
      'label': 'Working',
      'color': Color(0xFF3B82F6),
    },
    'creative': {
      'icon': Icons.lightbulb_outline,
      'label': 'Creative',
      'color': Color(0xFFF59E0B),
    },
    'educational': {
      'icon': Icons.school_outlined,
      'label': 'Educational',
      'color': Color(0xFF10B981),
    },
  };

  List<Map<String, dynamic>> _comments = [];

  @override
  void initState() {
    super.initState();
    _controller = YoutubePlayerController(
      initialVideoId: widget.videoId,
      flags: YoutubePlayerFlags(
        autoPlay: true,
        mute: false,
        enableCaption: true,
      ),
    );
    _checkAuth();
    _loadComments();
  }

  Future<void> _checkAuth() async {
    try {
      final userData = await _miniguruApi.getUserData();
      if (mounted) {
        setState(() {
          user = userData;
          _isAuthenticated = userData != null;
        });
      }
    } catch (e) {
      print('Auth check error: $e');
    }
  }

  Future<void> _loadComments() async {
    // TODO: Load comments from your backend
    // For now, using dummy data
    setState(() {
      _comments = [
        {
          'user': 'Rohit Kumar',
          'comment': 'Amazing project! Very well explained.',
          'time': '2 hours ago',
        },
        {
          'user': 'Priya Singh',
          'comment': 'Can you share the component list?',
          'time': '5 hours ago',
        },
      ];
    });
  }

  void _toggleLike(String category) {
    if (!_isAuthenticated) {
      _showLoginPrompt();
      return;
    }
    
    setState(() {
      _likes[category] = !_likes[category]!;
    });
    
    // TODO: Send like to backend
    _sendLikeToBackend(category, _likes[category]!);
  }

  Future<void> _sendLikeToBackend(String category, bool liked) async {
    try {
      // TODO: Implement your backend API call
      print('Sending like: $category = $liked for video ${widget.videoId}');
      
      // Example API call structure:
      // await _miniguruApi.likeVideo(widget.videoId, category, liked);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            liked ? 'Added ${_likeData[category]!['label']} like!' : 'Removed like',
            style: GoogleFonts.poppins(),
          ),
          backgroundColor: liked ? Colors.green : Colors.grey,
          duration: Duration(seconds: 1),
        ),
      );
    } catch (e) {
      print('Error sending like: $e');
    }
  }

  Future<void> _postComment() async {
    if (!_isAuthenticated) {
      _showLoginPrompt();
      return;
    }

    if (_commentController.text.trim().isEmpty) return;

    final comment = _commentController.text.trim();
    
    // TODO: Send comment to backend and YouTube API
    try {
      // Add to local list immediately for better UX
      setState(() {
        _comments.insert(0, {
          'user': user?.name ?? 'You',
          'comment': comment,
          'time': 'Just now',
        });
      });
      
      _commentController.clear();
      
      // TODO: Send to your backend
      // await _miniguruApi.postComment(widget.videoId, comment);
      
      // TODO: Post to YouTube using YouTube Data API
      // This requires OAuth and YouTube Data API v3
      // await _postToYouTube(comment);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Comment posted!', style: GoogleFonts.poppins()),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      print('Error posting comment: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to post comment', style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showLoginPrompt() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Please login to interact', style: GoogleFonts.poppins()),
        backgroundColor: Colors.orange,
        action: SnackBarAction(
          label: 'Login',
          textColor: Colors.white,
          onPressed: () {
            Navigator.of(context).pop(); // Go back
            // Navigate to login
          },
        ),
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        // Allow back navigation with back button or gesture
        return true;
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Column(
            children: [
              // Video Player with Back Button Overlay
              Stack(
                children: [
                  YoutubePlayer(
                    controller: _controller,
                    showVideoProgressIndicator: true,
                    progressIndicatorColor: Color(0xFF3B82F6),
                  ),
                  // Back Button Overlay
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        icon: Icon(Icons.arrow_back, color: Colors.white),
                        onPressed: () => Navigator.of(context).pop(),
                        tooltip: 'Back (or press ESC)',
                      ),
                    ),
                  ),
                ],
              ),
              
              // Content Area
              Expanded(
                child: Container(
                  color: Colors.white,
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Video Info
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.title,
                                style: GoogleFonts.poppins(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                ),
                              ),
                              SizedBox(height: 8),
                              Text(
                                'by ${widget.channelTitle}',
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  color: Colors.black54,
                                ),
                              ),
                            ],
                          ),
                        ),
                        
                        Divider(height: 1),
                        
                        // Like Categories
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'What do you like about this?',
                                style: GoogleFonts.poppins(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                ),
                              ),
                              SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: _likeData.entries.map((entry) {
                                  final key = entry.key;
                                  final data = entry.value;
                                  final isLiked = _likes[key]!;
                                  
                                  return GestureDetector(
                                    onTap: () => _toggleLike(key),
                                    child: Container(
                                      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      decoration: BoxDecoration(
                                        color: isLiked ? data['color'] : Colors.white,
                                        border: Border.all(
                                          color: isLiked ? data['color'] : Color(0xFFE5E7EB),
                                          width: 2,
                                        ),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(
                                            data['icon'],
                                            size: 18,
                                            color: isLiked ? Colors.white : data['color'],
                                          ),
                                          SizedBox(width: 6),
                                          Text(
                                            data['label'],
                                            style: GoogleFonts.poppins(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w500,
                                              color: isLiked ? Colors.white : Colors.black87,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ],
                          ),
                        ),
                        
                        Divider(height: 1),
                        
                        // Description
                        if (widget.description.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Description',
                                  style: GoogleFonts.poppins(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.black87,
                                  ),
                                ),
                                SizedBox(height: 8),
                                Text(
                                  widget.description,
                                  style: GoogleFonts.poppins(
                                    fontSize: 14,
                                    color: Colors.black54,
                                    height: 1.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        
                        Divider(height: 1),
                        
                        // Comments Section
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Comments (${_comments.length})',
                                style: GoogleFonts.poppins(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                ),
                              ),
                              SizedBox(height: 12),
                              
                              // Comment Input
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 18,
                                    backgroundColor: Color(0xFF3B82F6),
                                    child: Text(
                                      _isAuthenticated && user != null
                                          ? user!.name![0].toUpperCase()
                                          : '?',
                                      style: GoogleFonts.poppins(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  SizedBox(width: 12),
                                  Expanded(
                                    child: TextField(
                                      controller: _commentController,
                                      decoration: InputDecoration(
                                        hintText: _isAuthenticated 
                                            ? 'Add a comment...'
                                            : 'Login to comment',
                                        hintStyle: GoogleFonts.poppins(fontSize: 14),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(20),
                                          borderSide: BorderSide(color: Color(0xFFE5E7EB)),
                                        ),
                                        contentPadding: EdgeInsets.symmetric(
                                          horizontal: 16,
                                          vertical: 8,
                                        ),
                                        suffixIcon: IconButton(
                                          icon: Icon(Icons.send, color: Color(0xFF3B82F6)),
                                          onPressed: _postComment,
                                        ),
                                      ),
                                      enabled: _isAuthenticated,
                                    ),
                                  ),
                                ],
                              ),
                              
                              SizedBox(height: 16),
                              
                              // Comments List
                              ..._comments.map((comment) {
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      CircleAvatar(
                                        radius: 18,
                                        backgroundColor: Colors.grey.shade300,
                                        child: Text(
                                          comment['user'][0].toUpperCase(),
                                          style: GoogleFonts.poppins(
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Text(
                                                  comment['user'],
                                                  style: GoogleFonts.poppins(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w600,
                                                    color: Colors.black87,
                                                  ),
                                                ),
                                                SizedBox(width: 8),
                                                Text(
                                                  comment['time'],
                                                  style: GoogleFonts.poppins(
                                                    fontSize: 11,
                                                    color: Colors.black38,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            SizedBox(height: 4),
                                            Text(
                                              comment['comment'],
                                              style: GoogleFonts.poppins(
                                                fontSize: 13,
                                                color: Colors.black87,
                                                height: 1.4,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }).toList(),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}