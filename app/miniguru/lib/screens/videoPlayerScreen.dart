import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:video_player/video_player.dart';
import 'package:google_fonts/google_fonts.dart';

class VideoPlayerScreen extends StatefulWidget {
  const VideoPlayerScreen({
    Key? key,
    required this.projectId,
    this.videoUrl,
    this.title,
    this.description,
    this.creatorName,
    this.creatorId,
    this.views,
    this.category,
  }) : super(key: key);

  static String id = "VideoPlayerScreen";

  final String projectId;
  final String? videoUrl;
  final String? title;
  final String? description;
  final String? creatorName;
  final String? creatorId;
  final String? views;
  final String? category;

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  late VideoPlayerController _videoController;
  bool _isVideoInitialized = false;
  bool _isPlaying = false;
  
  // Ratings state
  final Map<String, bool> _ratings = {
    'aesthetic': false,
    'functional': false,
    'sturdy': false,
    'novel': false,
    'resourceful': false,
  };
  
  // Comments
  final TextEditingController _commentController = TextEditingController();
  final List<Map<String, dynamic>> _comments = [
    {
      'user': 'Tech Enthusiast',
      'comment': 'Amazing project! Very innovative approach.',
      'time': '2 hours ago',
    },
    {
      'user': 'Science Kid',
      'comment': 'Can you share the materials list?',
      'time': '5 hours ago',
    },
  ];

  // Related projects (mock data)
  final List<Map<String, dynamic>> _relatedProjects = [
    {
      'title': 'Similar Robot Design',
      'creator': 'RoboMaster',
      'views': '1.5K',
      'duration': '6:20',
    },
    {
      'title': 'Advanced Mechanics',
      'creator': 'Engineer Pro',
      'views': '980',
      'duration': '4:15',
    },
  ];

  @override
  void initState() {
    super.initState();
    _initializeVideo();
  }

  void _initializeVideo() {
    // TODO: Replace with actual video URL from widget.videoUrl
    final videoUrl = widget.videoUrl ?? 
        'https://flutter.github.io/assets-for-api-docs/assets/videos/bee.mp4';
    
    _videoController = VideoPlayerController.network(videoUrl)
      ..initialize().then((_) {
        if (mounted) {
          setState(() {
            _isVideoInitialized = true;
          });
          _videoController.play();
          _isPlaying = true;
        }
      }).catchError((error) {
        print('Video initialization error: $error');
      });

    _videoController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _videoController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    setState(() {
      if (_videoController.value.isPlaying) {
        _videoController.pause();
        _isPlaying = false;
      } else {
        _videoController.play();
        _isPlaying = true;
      }
    });
  }

  void _toggleRating(String type) {
    setState(() {
      _ratings[type] = !_ratings[type]!;
    });
    // TODO: Send rating to backend API
  }

  void _addComment() {
    if (_commentController.text.trim().isEmpty) return;
    
    setState(() {
      _comments.insert(0, {
        'user': 'You',
        'comment': _commentController.text.trim(),
        'time': 'Just now',
      });
    });
    
    _commentController.clear();
    // TODO: Send comment to backend API
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // Video Player Section
            _buildVideoPlayer(),
            
            // Content Section (scrollable)
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
                      // Project Info
                      _buildProjectInfo(),
                      
                      // Creator Info
                      _buildCreatorInfo(),
                      
                      const Divider(height: 1),
                      
                      // Rating Buttons
                      _buildRatingButtons(),
                      
                      const Divider(height: 1),
                      
                      // Description
                      _buildDescription(),
                      
                      const Divider(height: 1),
                      
                      // Comments Section
                      _buildCommentsSection(),
                      
                      const Divider(height: 1, thickness: 8),
                      
                      // Related Projects
                      _buildRelatedProjects(),
                      
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoPlayer() {
    return Stack(
      children: [
        // Video Player
        AspectRatio(
          aspectRatio: _isVideoInitialized 
              ? _videoController.value.aspectRatio 
              : 16 / 9,
          child: _isVideoInitialized
              ? VideoPlayer(_videoController)
              : Container(
                  color: Colors.black,
                  child: const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  ),
                ),
        ),
        
        // Controls Overlay
        Positioned.fill(
          child: GestureDetector(
            onTap: _togglePlayPause,
            child: Container(
              color: Colors.transparent,
              child: Center(
                child: AnimatedOpacity(
                  opacity: !_isPlaying ? 1.0 : 0.0,
                  duration: const Duration(milliseconds: 300),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _isPlaying ? Icons.pause : Icons.play_arrow,
                      color: Colors.white,
                      size: 50,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        
        // Back Button
        Positioned(
          top: 8,
          left: 8,
          child: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white, size: 28),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        
        // Video Progress Bar
        if (_isVideoInitialized)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: VideoProgressIndicator(
              _videoController,
              allowScrubbing: true,
              colors: const VideoProgressColors(
                playedColor: pastelBlueText,
                bufferedColor: Colors.grey,
                backgroundColor: Colors.white24,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildProjectInfo() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.title ?? 'Amazing STEM Project',
            style: GoogleFonts.poppins(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                '${widget.views ?? "1.2K"} views',
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: pastelBlue.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  widget.category ?? 'Science',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: pastelBlueText,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCreatorInfo() {
    return InkWell(
      onTap: () {
        // TODO: Navigate to creator profile
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('View ${widget.creatorName}\'s profile')),
        );
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: pastelBlue,
              child: Text(
                widget.creatorName?.substring(0, 1).toUpperCase() ?? 'C',
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.creatorName ?? 'Creator Name',
                    style: GoogleFonts.poppins(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  Text(
                    'View Profile →',
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: pastelBlueText,
                    ),
                  ),
                ],
              ),
            ),
            OutlinedButton(
              onPressed: () {
                // TODO: Follow/unfollow creator
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: pastelBlueText,
                side: const BorderSide(color: pastelBlueText),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
              child: Text(
                'Follow',
                style: GoogleFonts.poppins(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRatingButtons() {
    final ratings = [
      {'key': 'aesthetic', 'label': 'Aesthetic', 'icon': Icons.palette_outlined},
      {'key': 'functional', 'label': 'Works Well', 'icon': Icons.settings_outlined},
      {'key': 'sturdy', 'label': 'Well-Built', 'icon': Icons.construction_outlined},
      {'key': 'novel', 'label': 'Original', 'icon': Icons.lightbulb_outline},
      {'key': 'resourceful', 'label': 'Smart Use', 'icon': Icons.eco_outlined},
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Rate this project',
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
            children: ratings.map((rating) {
              final isSelected = _ratings[rating['key']]!;
              return InkWell(
                onTap: () => _toggleRating(rating['key'] as String),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? pastelBlue : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected ? pastelBlueText : Colors.grey.shade300,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        rating['icon'] as IconData,
                        size: 18,
                        color: isSelected ? pastelBlueText : Colors.grey.shade600,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        rating['label'] as String,
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                          color: isSelected ? pastelBlueText : Colors.grey.shade700,
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
    );
  }

  Widget _buildDescription() {
    return Padding(
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
            widget.description ?? 
                'This is an amazing STEM project that demonstrates innovative use of technology and creativity. Students can learn valuable skills by following this tutorial.',
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: Colors.grey[700],
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommentsSection() {
    return Padding(
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
          const SizedBox(height: 12),
          
          // Add Comment Field
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _commentController,
                  decoration: InputDecoration(
                    hintText: 'Add a comment...',
                    hintStyle: GoogleFonts.poppins(fontSize: 13),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(20),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _addComment,
                icon: const Icon(Icons.send, color: pastelBlueText),
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // Comments List
          ...List.generate(
            _comments.length > 3 ? 3 : _comments.length,
            (index) => _buildCommentCard(_comments[index]),
          ),
          
          if (_comments.length > 3)
            TextButton(
              onPressed: () {
                // TODO: Show all comments
              },
              child: Text(
                'View all ${_comments.length} comments',
                style: GoogleFonts.poppins(color: pastelBlueText),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCommentCard(Map<String, dynamic> comment) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: pastelYellow,
            child: Text(
              comment['user'].substring(0, 1),
              style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.bold),
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
                      comment['user'],
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      comment['time'],
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  comment['comment'],
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRelatedProjects() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Related Projects',
            style: GoogleFonts.poppins(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          ..._relatedProjects.map((project) => _buildRelatedProjectCard(project)),
        ],
      ),
    );
  }

  Widget _buildRelatedProjectCard(Map<String, dynamic> project) {
    return InkWell(
      onTap: () {
        // TODO: Navigate to related project
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Container(
              width: 120,
              height: 70,
              decoration: BoxDecoration(
                color: pastelBlue.withOpacity(0.3),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.play_circle_outline, size: 32),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    project['title'],
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${project['creator']} • ${project['views']} views',
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey,
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