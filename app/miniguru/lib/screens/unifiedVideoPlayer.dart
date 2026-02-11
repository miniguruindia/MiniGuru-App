// /workspaces/MiniGuru-App/app/miniguru/lib/screens/unifiedVideoPlayer.dart
// FIXED VERSION - Proper iframe initialization
// Works on BOTH Web and Mobile

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/constants.dart';

class UnifiedVideoPlayer extends StatefulWidget {
  final String videoId;
  final String title;
  final String description;
  final String channelTitle;
  final int? views;

  const UnifiedVideoPlayer({
    Key? key,
    required this.videoId,
    required this.title,
    required this.description,
    required this.channelTitle,
    this.views,
  }) : super(key: key);

  @override
  State<UnifiedVideoPlayer> createState() => _UnifiedVideoPlayerState();
}

class _UnifiedVideoPlayerState extends State<UnifiedVideoPlayer> {
  late YoutubePlayerController _controller;
  final _miniguruApi = MiniguruApi();
  final _commentController = TextEditingController();
  
  User? _user;
  bool _isAuthenticated = false;
  bool _isLoadingComments = false;
  bool _hasTrackedView = false;
  bool _isPlayerReady = false;  // Track if player is ready
  
  Map<String, bool> _likes = {
    'aesthetic': false,
    'functional': false,
    'sturdy': false,
    'creative': false,
    'educational': false,
  };
  
  final Map<String, Map<String, dynamic>> _likeData = {
    'aesthetic': {
      'icon': Icons.palette_outlined,
      'label': 'Aesthetic',
      'color': Color(0xFFEC4899),
    },
    'functional': {
      'icon': Icons.settings_outlined,
      'label': 'Works Well',
      'color': Color(0xFF3B82F6),
    },
    'sturdy': {
      'icon': Icons.construction_outlined,
      'label': 'Well-Built',
      'color': Color(0xFF8B5CF6),
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
  Map<String, dynamic>? _viewStats;

  @override
  void initState() {
    super.initState();
    print('🎬 Initializing video player for: ${widget.videoId}');
    _initializePlayer();
    _checkAuth();
    _loadComments();
    _loadViewStats();
    _loadUserLikes();
  }

  void _initializePlayer() {
    // ✅ FIXED: Initialize controller with video ID directly in params
    _controller = YoutubePlayerController.fromVideoId(
      videoId: widget.videoId,
      autoPlay: true,
      params: const YoutubePlayerParams(
        showControls: true,
        showFullscreenButton: true,
        mute: false,
        loop: false,
        enableCaption: true,
        strictRelatedVideos: true,
        showVideoAnnotations: false,
      ),
    );
    
    // Listen to player events
    _controller.listen((event) {
      print('🎬 Player event: ${event.playerState}');
      
      if (event.playerState == PlayerState.playing && 
          !_hasTrackedView && 
          _isAuthenticated) {
        _trackView();
        _hasTrackedView = true;
      }
      
      // Track when player is ready
      if (event.playerState == PlayerState.cued || 
          event.playerState == PlayerState.playing) {
        if (!_isPlayerReady) {
          setState(() {
            _isPlayerReady = true;
          });
        }
      }
    });
    
    print('✅ Player controller initialized');
  }

  Future<void> _checkAuth() async {
    try {
      final userData = await _miniguruApi.getUserData();
      if (mounted) {
        setState(() {
          _user = userData;
          _isAuthenticated = userData != null;
        });
        
        if (_isAuthenticated) {
          _loadUserLikes();
        }
      }
    } catch (e) {
      print('❌ Auth check error: $e');
    }
  }

  Future<void> _trackView() async {
    if (!_isAuthenticated) return;
    
    try {
      await _miniguruApi.trackVideoView(widget.videoId);
      print('✅ View tracked for video: ${widget.videoId}');
      _loadViewStats();
    } catch (e) {
      print('❌ Failed to track view: $e');
    }
  }

  Future<void> _loadViewStats() async {
    try {
      final stats = await _miniguruApi.getVideoViews(widget.videoId);
      if (mounted) {
        setState(() {
          _viewStats = stats;
        });
      }
    } catch (e) {
      print('❌ Failed to load view stats: $e');
    }
  }

  Future<void> _loadUserLikes() async {
    if (!_isAuthenticated) return;
    
    try {
      final likes = await _miniguruApi.getUserVideoLikes(widget.videoId);
      if (mounted) {
        setState(() {
          _likes = likes;
        });
      }
    } catch (e) {
      print('❌ Failed to load user likes: $e');
    }
  }

  Future<void> _loadComments() async {
    setState(() => _isLoadingComments = true);
    
    try {
      final comments = await _miniguruApi.getVideoComments(widget.videoId, limit: 50);
      
      if (mounted) {
        setState(() {
          _comments = comments.map((comment) => {
            'id': comment['id']?.toString() ?? '',
            'userId': comment['userId']?.toString() ?? '',
            'userName': comment['userName']?.toString() ?? 'Unknown',
            'comment': comment['comment']?.toString() ?? '',
            'createdAt': comment['createdAt']?.toString() ?? '',
          }).toList();
          _isLoadingComments = false;
        });
      }
    } catch (e) {
      print('❌ Failed to load comments: $e');
      if (mounted) {
        setState(() => _isLoadingComments = false);
      }
    }
  }

  void _toggleLike(String category) {
    if (!_isAuthenticated) {
      _showLoginPrompt();
      return;
    }
    
    final newValue = !_likes[category]!;
    
    setState(() {
      _likes[category] = newValue;
    });
    
    _sendLikeToBackend(category, newValue);
  }

  Future<void> _sendLikeToBackend(String category, bool liked) async {
    try {
      await _miniguruApi.likeVideo(widget.videoId, category, liked);
      
      _showSnackBar(
        liked ? '👍 Added ${_likeData[category]!['label']} like!' : '❌ Removed like',
        liked ? Colors.green : Colors.grey,
      );
    } catch (e) {
      print('❌ Error sending like: $e');
      setState(() {
        _likes[category] = !liked;
      });
      _showSnackBar('Failed to save like', Colors.red);
    }
  }

  Future<void> _postComment() async {
    if (!_isAuthenticated) {
      _showLoginPrompt();
      return;
    }

    final comment = _commentController.text.trim();
    if (comment.isEmpty) return;

    try {
      final result = await _miniguruApi.postVideoComment(widget.videoId, comment);
      
      if (result != null) {
        setState(() {
          _comments.insert(0, {
            'id': result['id']?.toString() ?? '',
            'userId': _user!.id?.toString() ?? '',
            'userName': _user!.name?.toString() ?? 'Unknown',
            'comment': comment,
            'createdAt': DateTime.now().toIso8601String(),
          });
        });
        
        _commentController.clear();
        _showSnackBar('✅ Comment posted!', Colors.green);
      }
    } catch (e) {
      print('❌ Error posting comment: $e');
      _showSnackBar('Failed to post comment', Colors.red);
    }
  }

  Future<void> _deleteComment(String commentId, int index) async {
    try {
      final success = await _miniguruApi.deleteVideoComment(commentId);
      
      if (success) {
        setState(() {
          _comments.removeAt(index);
        });
        _showSnackBar('Comment deleted', Colors.grey);
      } else {
        _showSnackBar('Failed to delete comment', Colors.red);
      }
    } catch (e) {
      print('❌ Error deleting comment: $e');
      _showSnackBar('Failed to delete comment', Colors.red);
    }
  }

  void _showLoginPrompt() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Please login to interact', style: GoogleFonts.poppins()),
        backgroundColor: Colors.orange,
        action: SnackBarAction(
          label: 'Login',
          textColor: Colors.white,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
    );
  }

  void _showSnackBar(String message, Color color) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.poppins(color: Colors.white)),
        backgroundColor: color,
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  String _formatTimeAgo(String? timestamp) {
    if (timestamp == null || timestamp.isEmpty) return 'Just now';
    
    try {
      final dateTime = DateTime.parse(timestamp);
      final difference = DateTime.now().difference(dateTime);
      
      if (difference.inDays > 365) {
        return '${(difference.inDays / 365).floor()} years ago';
      } else if (difference.inDays > 30) {
        return '${(difference.inDays / 30).floor()} months ago';
      } else if (difference.inDays > 0) {
        return '${difference.inDays} days ago';
      } else if (difference.inHours > 0) {
        return '${difference.inHours} hours ago';
      } else if (difference.inMinutes > 0) {
        return '${difference.inMinutes} minutes ago';
      } else {
        return 'Just now';
      }
    } catch (e) {
      return 'Recently';
    }
  }

  @override
  void dispose() {
    _controller.close();
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async => true,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Column(
            children: [
              // ✅ FIXED: Proper YoutubePlayer widget with error handling
              Container(
                color: Colors.black,
                child: Stack(
                  children: [
                    // YouTube Player
                    YoutubePlayer(
                      controller: _controller,
                      aspectRatio: 16 / 9,
                    ),
                    
                    // Back Button
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          shape: BoxShape.circle,
                        ),
                        child: IconButton(
                          icon: const Icon(Icons.arrow_back, color: Colors.white),
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              
              // Content Area
              Expanded(
                child: Container(
                  decoration: const BoxDecoration(
                    color: backgroundWhite,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(20),
                      topRight: Radius.circular(20),
                    ),
                  ),
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
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Text(
                                    '${_viewStats?['totalViews'] ?? widget.views ?? 0} views',
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      color: Colors.black54,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text('•', style: TextStyle(color: Colors.black54)),
                                  const SizedBox(width: 8),
                                  Text(
                                    'by ${widget.channelTitle}',
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      color: Colors.black54,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        
                        const Divider(height: 1),
                        
                        // Like Categories
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '💡 What do you like about this?',
                                style: GoogleFonts.poppins(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 12),
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
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 8,
                                      ),
                                      decoration: BoxDecoration(
                                        color: isLiked ? data['color'] : Colors.white,
                                        border: Border.all(
                                          color: isLiked ? data['color'] : const Color(0xFFE5E7EB),
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
                                          const SizedBox(width: 6),
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
                        
                        const Divider(height: 1),
                        
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
                                const SizedBox(height: 8),
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
                        
                        const Divider(height: 1),
                        
                        // Comments Section
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '💬 Comments (${_comments.length})',
                                style: GoogleFonts.poppins(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 12),
                              
                              // Comment Input
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 18,
                                    backgroundColor: pastelBlue,
                                    child: Text(
                                      _isAuthenticated && _user != null && _user!.name != null
                                          ? _user!.name![0].toUpperCase()
                                          : '?',
                                      style: GoogleFonts.poppins(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
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
                                          borderSide: const BorderSide(
                                            color: Color(0xFFE5E7EB),
                                          ),
                                        ),
                                        contentPadding: const EdgeInsets.symmetric(
                                          horizontal: 16,
                                          vertical: 8,
                                        ),
                                        suffixIcon: IconButton(
                                          icon: const Icon(Icons.send, color: pastelBlueText),
                                          onPressed: _postComment,
                                        ),
                                      ),
                                      enabled: _isAuthenticated,
                                      onSubmitted: (_) => _postComment(),
                                    ),
                                  ),
                                ],
                              ),
                              
                              const SizedBox(height: 16),
                              
                              if (_isLoadingComments)
                                const Center(
                                  child: Padding(
                                    padding: EdgeInsets.all(20),
                                    child: CircularProgressIndicator(color: pastelBlueText),
                                  ),
                                ),
                              
                              if (!_isLoadingComments)
                                ..._comments.asMap().entries.map((entry) {
                                  final index = entry.key;
                                  final comment = entry.value;
                                  final commentUserId = comment['userId'] ?? '';
                                  final currentUserId = _user?.id?.toString() ?? '';
                                  final isOwnComment = _isAuthenticated && 
                                      _user != null && 
                                      commentUserId == currentUserId;
                                  
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 16),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        CircleAvatar(
                                          radius: 18,
                                          backgroundColor: Colors.grey.shade300,
                                          child: Text(
                                            (comment['userName'] ?? 'U')[0].toUpperCase(),
                                            style: GoogleFonts.poppins(
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Text(
                                                    comment['userName'] ?? 'Unknown',
                                                    style: GoogleFonts.poppins(
                                                      fontSize: 13,
                                                      fontWeight: FontWeight.w600,
                                                      color: Colors.black87,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Text(
                                                    _formatTimeAgo(comment['createdAt']),
                                                    style: GoogleFonts.poppins(
                                                      fontSize: 11,
                                                      color: Colors.black38,
                                                    ),
                                                  ),
                                                  if (isOwnComment) ...[
                                                    const Spacer(),
                                                    IconButton(
                                                      icon: const Icon(
                                                        Icons.delete_outline,
                                                        size: 18,
                                                        color: Colors.red,
                                                      ),
                                                      onPressed: () => _deleteComment(
                                                        comment['id'] ?? '',
                                                        index,
                                                      ),
                                                      padding: EdgeInsets.zero,
                                                      constraints: const BoxConstraints(),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                comment['comment'] ?? '',
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
                              
                              if (!_isLoadingComments && _comments.isEmpty)
                                Center(
                                  child: Padding(
                                    padding: const EdgeInsets.all(20),
                                    child: Text(
                                      'No comments yet. Be the first to comment!',
                                      style: GoogleFonts.poppins(
                                        color: Colors.grey,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        
                        const SizedBox(height: 20),
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