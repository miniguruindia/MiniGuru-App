// lib/screens/unifiedVideoPlayer.dart
// FIXED: Back button moved ABOVE the iframe — YouTube overlay can no longer intercept it

import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';
import 'package:miniguru/widgets/video_rating_widget.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/constants.dart';
import 'package:url_launcher/url_launcher.dart';

class UnifiedVideoPlayer extends StatefulWidget {
  final String videoId;
  final String projectId;      // ← ADD: project DB id for ratings
  final String title;
  final String description;
  final String channelTitle;
  final int? views;

  const UnifiedVideoPlayer({
    Key? key,
    required this.videoId,
    required this.projectId,     // ← ADD this line
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
  bool _isPlayerReady = false;
  StreamSubscription<Duration>? _positionSub;
  List<dynamic> _materials = [];

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
    _initializePlayer();
    _checkAuth();
    _loadComments();
    _loadViewStats();
    _loadUserLikes();
    _loadMaterials();
  }

  Future<void> _loadMaterials() async {
    try {
      final result = await _miniguruApi.getVideoMaterials(widget.videoId);
      if (mounted && result != null) setState(() => _materials = result);
    } catch (_) {
      // Materials section just doesn't show — never breaks video playback.
    }
  }

  void _initializePlayer() {
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

    _controller.listen((event) {
      // BUGFIX (Goins-farming exploit): this used to award the view Goin
      // the INSTANT playback started — kids learned that just opening a
      // video counted, and would open-and-scroll-away without watching.
      // Now we only track real watch progress (see
      // _startWatchProgressTracking below), and only credit the Goin once
      // ~75% of the video has actually played.
      if (event.playerState == PlayerState.playing) {
        _startWatchProgressTracking();
      }
      // Reaching the end always counts as "watched enough", even if the
      // periodic progress poll happened to land just under the 75% mark
      // due to polling timing.
      if (event.playerState == PlayerState.ended) {
        _maybeTrackView(1.0);
      }
      if (event.playerState == PlayerState.cued ||
          event.playerState == PlayerState.playing) {
        if (!_isPlayerReady) {
          setState(() => _isPlayerReady = true);
        }
      }
    });
  }

  // How much of the video must actually be watched before the view Goin is
  // credited. Matches (and is intentionally slightly above) the server's
  // own MIN_WATCHED_FRACTION_FOR_GOIN safety-net check.
  static const double _watchThreshold = 0.75;

  void _startWatchProgressTracking() {
    if (_positionSub != null) return; // only ever start one subscription
    _positionSub = _controller
        .getCurrentPositionStream(period: const Duration(seconds: 2))
        .listen((position) async {
      if (_hasTrackedView || !_isAuthenticated) return;
      try {
        final duration = await _controller.duration;
        if (duration <= 0) return; // metadata not loaded yet — try again next tick
        final fraction = position.inMilliseconds / (duration * 1000);
        if (fraction >= _watchThreshold) {
          _maybeTrackView(fraction.clamp(0.0, 1.0));
        }
      } catch (_) {
        // Position/duration briefly unavailable (e.g. mid-seek) — just
        // skip this tick, the stream will fire again in 2 seconds.
      }
    });
  }

  void _maybeTrackView(double fraction) {
    if (_hasTrackedView || !_isAuthenticated) return;
    _hasTrackedView = true;
    _trackView(fraction);
    _positionSub?.cancel();
    _positionSub = null;
  }

  Future<void> _checkAuth() async {
    try {
      final userData = await _miniguruApi.getUserData();
      if (mounted) {
        setState(() {
          _user = userData;
          _isAuthenticated = userData != null;
        });
        if (_isAuthenticated) _loadUserLikes();
      }
    } catch (e) {
      print('❌ Auth check error: $e');
    }
  }

  Future<void> _trackView([double watchedFraction = 1.0]) async {
    if (!_isAuthenticated) return;
    try {
      await _miniguruApi.trackVideoView(widget.videoId, watchedFraction: watchedFraction);
      _loadViewStats();
    } catch (e) {
      print('❌ Failed to track view: $e');
    }
  }

  Future<void> _loadViewStats() async {
    try {
      final stats = await _miniguruApi.getVideoViews(widget.videoId);
      if (mounted) setState(() => _viewStats = stats);
    } catch (e) {
      print('❌ Failed to load view stats: $e');
    }
  }

  Future<void> _loadUserLikes() async {
    if (!_isAuthenticated) return;
    try {
      final likes = await _miniguruApi.getUserVideoLikes(widget.videoId);
      if (mounted) setState(() => _likes = likes);
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
          _comments = comments.map((c) => {
            'id': c['id']?.toString() ?? '',
            'userId': c['userId']?.toString() ?? '',
            'userName': c['userName']?.toString() ?? 'Unknown',
            'comment': c['comment']?.toString() ?? '',
            'createdAt': c['createdAt']?.toString() ?? '',
          }).toList();
          _isLoadingComments = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingComments = false);
    }
  }

  void _toggleLike(String category) {
    if (!_isAuthenticated) { _showLoginPrompt(); return; }
    final newValue = !_likes[category]!;
    setState(() => _likes[category] = newValue);
    _sendLikeToBackend(category, newValue);
  }

  Future<void> _sendLikeToBackend(String category, bool liked) async {
    try {
      await _miniguruApi.likeVideo(widget.videoId, category, liked);
      _showSnackBar(
        liked ? '👍 Added ${_likeData[category]!['label']} like!' : 'Like removed',
        liked ? Colors.green : Colors.grey,
      );
    } catch (e) {
      setState(() => _likes[category] = !liked);
      _showSnackBar('Failed to save like', Colors.red);
    }
  }

  Future<void> _postComment() async {
    if (!_isAuthenticated) { _showLoginPrompt(); return; }
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
      // Show the REAL backend message — e.g. "You've already commented 2
      // times on this video. Edit one of your existing comments instead of
      // posting a new one." — instead of a generic failure. This is the
      // message a child actually needs to see to know what to do next.
      final message = e.toString().replaceFirst('Exception: ', '');
      _showSnackBar(message, Colors.orange);
    }
  }

  Future<void> _editComment(int index) async {
    final comment = _comments[index];
    final controller = TextEditingController(text: comment['comment'] ?? '');
    final newText = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Edit your comment', style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
        content: TextField(
          controller: controller,
          maxLines: 4,
          maxLength: 500,
          autofocus: true,
          decoration: const InputDecoration(border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (newText == null || newText.isEmpty || newText == comment['comment']) return;

    try {
      final result = await _miniguruApi.updateVideoComment(comment['id'] ?? '', newText);
      if (result != null && mounted) {
        setState(() => _comments[index]['comment'] = result['comment'] ?? newText);
        _showSnackBar('✅ Comment updated', Colors.green);
      }
    } catch (e) {
      final message = e.toString().replaceFirst('Exception: ', '');
      _showSnackBar(message, Colors.orange);
    }
  }

  Future<void> _deleteComment(String commentId, int index) async {
    try {
      final success = await _miniguruApi.deleteVideoComment(commentId);
      if (success) {
        setState(() => _comments.removeAt(index));
        _showSnackBar('Comment deleted', Colors.grey);
      }
    } catch (e) {
      _showSnackBar('Failed to delete comment', Colors.red);
    }
  }

  void _showLoginPrompt() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('Please login to interact', style: GoogleFonts.nunito()),
      backgroundColor: Colors.orange,
      action: SnackBarAction(
        label: 'Login',
        textColor: Colors.white,
        onPressed: () => Navigator.of(context).pop(),
      ),
    ));
  }

  void _showSnackBar(String message, Color color) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message, style: GoogleFonts.nunito(color: Colors.white)),
      backgroundColor: color,
      duration: const Duration(seconds: 2),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  String _formatTimeAgo(String? timestamp) {
    if (timestamp == null || timestamp.isEmpty) return 'Just now';
    try {
      final dt = DateTime.parse(timestamp);
      final diff = DateTime.now().difference(dt);
      if (diff.inDays > 365) return '${(diff.inDays / 365).floor()}y ago';
      if (diff.inDays > 30)  return '${(diff.inDays / 30).floor()}mo ago';
      if (diff.inDays > 0)   return '${diff.inDays}d ago';
      if (diff.inHours > 0)  return '${diff.inHours}h ago';
      if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
      return 'Just now';
    } catch (_) { return 'Recently'; }
  }

  @override
  void dispose() {
    _positionSub?.cancel();
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
          child: LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth >= 760;
              return isWide
                  ? _buildWideLayout(constraints)
                  : _buildNarrowLayout(context);
            },
          ),
        ),
      ),
    );
  }

  // ── Shared back button row — sits ABOVE the iframe, never overlapped ────
  Widget _buildBackBar() {
    return Container(
      color: Colors.black,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.of(context).pop(),
            tooltip: 'Back',
          ),
          Expanded(
            child: Text(
              widget.title,
              style: GoogleFonts.nunito(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  // ── Narrow (phone/tablet-portrait) layout — UNCHANGED behavior ──────────
  // Full-width 16:9 video stays modest in height on narrow screens, so the
  // original fixed 55%-of-screen-height panel below it always fit. Left
  // exactly as it was before this fix.
  Widget _buildNarrowLayout(BuildContext context) {
    return Column(
      children: [
        _buildBackBar(),
        // ── YouTube player (no Flutter widgets overlaid on it) ──
        Container(
          color: Colors.black,
          child: YoutubePlayer(
            controller: _controller,
            aspectRatio: 16 / 9,
          ),
        ),
        // ── Scrollable content below player ──
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.55,
          child: Container(
            decoration: const BoxDecoration(
              color: backgroundWhite,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
              ),
            ),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ..._buildAboutWidgets(),
                  ..._buildCommentsWidgets(),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Wide (desktop/laptop/landscape-tablet) layout — NEW ─────────────────
  // BUGFIX: on a wide window a full-width 16:9 video becomes taller than
  // the whole viewport (e.g. 1440px wide -> 810px tall video), which pushed
  // the old fixed-height info/comments panel off-screen entirely — this is
  // why the video looked half-hidden and Comments/About were invisible on
  // desktop. Fix: cap the video's rendered width (so its height stays
  // reasonable, like real YouTube's desktop player) and give the content
  // area a proper Expanded region that always fills whatever space
  // remains, split into two scrollable columns (About+Rating on the left,
  // Comments on the right) so both are always reachable regardless of
  // window size.
  Widget _buildWideLayout(BoxConstraints constraints) {
    // BUGFIX: previously sized the video from WIDTH first (up to 900px
    // wide → ~506px tall from the 16:9 ratio), which on common laptop
    // screens (1366x768, 1440x900) left almost no vertical room for the
    // About/Comments panel below — exactly the "video at the bottom, half
    // hidden, one line at a time" symptom. Size from available HEIGHT
    // first instead, so there's always a guaranteed, reasonable amount of
    // room left for the info panel regardless of window height.
    const backBarHeight = 48.0;
    final availableHeight = constraints.maxHeight - backBarHeight;
    final videoHeight = (availableHeight * 0.48).clamp(280.0, 620.0);
    final videoWidthFromHeight = videoHeight * 16 / 9;
    final videoWidth = videoWidthFromHeight.clamp(480.0, constraints.maxWidth * 0.92);

    return Column(
      children: [
        _buildBackBar(),
        Container(
          color: Colors.black,
          alignment: Alignment.center,
          child: SizedBox(
            width: videoWidth,
            height: videoWidth * 9 / 16,
            child: YoutubePlayer(
              controller: _controller,
              aspectRatio: 16 / 9,
            ),
          ),
        ),
        Expanded(
          child: Container(
            decoration: const BoxDecoration(
              color: backgroundWhite,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.only(right: 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: _buildAboutWidgets(),
                    ),
                  ),
                ),
                const VerticalDivider(width: 1),
                Expanded(
                  flex: 2,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.only(left: 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: _buildCommentsWidgets(),
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

  // ── Title / stats / peer rating / "About this project" ──────────────────
  // Extracted verbatim from the previous single-column build() so both
  // layouts render byte-identical content, just arranged differently.
  Widget _buildMaterialsSection() {
    if (_materials.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('🧰 Materials used',
              style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 15, color: Colors.black87)),
          const SizedBox(height: 8),
          ..._materials.map((m) {
            final name = m['name'] ?? 'Material';
            final qty = m['quantity'] ?? 1;
            final unit = m['unit'] ?? 'piece';
            final amazonUrl = m['amazonUrl'] as String?;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Text(m['icon'] ?? '🔩', style: const TextStyle(fontSize: 14)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('$name${qty > 1 ? ' x$qty' : ''}${unit != 'piece' ? ' ($unit)' : ''}',
                        style: GoogleFonts.nunito(fontSize: 13, color: Colors.black87)),
                  ),
                  if (amazonUrl != null && amazonUrl.isNotEmpty)
                    GestureDetector(
                      onTap: () => launchUrl(Uri.parse(amazonUrl), mode: LaunchMode.externalApplication),
                      child: const Icon(Icons.open_in_new_rounded, size: 14, color: Color(0xFFD97706)),
                    ),
                ],
              ),
            );
          }),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _showSendMaterialsToParent,
            icon: const Icon(Icons.mail_outline, size: 16),
            label: Text('Send this kit to a parent',
                style: GoogleFonts.nunito(fontSize: 12, fontWeight: FontWeight.w700)),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF5B6EF5),
              side: const BorderSide(color: Color(0xFF5B6EF5)),
              minimumSize: const Size(double.infinity, 40),
            ),
          ),
        ],
      ),
    );
  }

  bool _sendingKitToParent = false;

  Future<void> _showSendMaterialsToParent() async {
    // Any viewer can send this — not just the video's own maker — so no
    // guardianEmail pre-fill assumption here; always a fresh confirm.
    final emailCtrl = TextEditingController();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Send materials kit', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 16)),
              const SizedBox(height: 6),
              Text('We\'ll email the materials list with an Amazon buy link for "${widget.title}".',
                  style: GoogleFonts.nunito(fontSize: 12, color: Colors.black54)),
              const SizedBox(height: 14),
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Parent\'s email',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _sendingKitToParent ? null : () async {
                    final email = emailCtrl.text.trim();
                    if (!email.contains('@')) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('Enter a valid email')));
                      return;
                    }
                    setSheetState(() => _sendingKitToParent = true);
                    final ok = await _miniguruApi.sendMaterialsToParent(
                      parentEmail: email,
                      projectTitle: widget.title,
                      items: _materials.map((m) => {
                        'name': m['name'],
                        'qty': m['quantity'],
                        'unit': m['unit'],
                        'priceEstimate': m['priceEstimate'],
                        'amazonASIN': m['amazonASIN'],
                      }).toList(),
                    );
                    setSheetState(() => _sendingKitToParent = false);
                    if (ctx.mounted) Navigator.pop(ctx);
                    if (mounted) {
                      _showSnackBarSafe(ok ? 'Sent! ✅' : 'Could not send — try again', ok);
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF5B6EF5),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _sendingKitToParent
                      ? const SizedBox(width: 18, height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('Send', style: GoogleFonts.nunito(fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSnackBarSafe(String msg, bool ok) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
      backgroundColor: ok ? Colors.green : Colors.red,
    ));
  }

  List<Widget> _buildAboutWidgets() {
    return [
                        // Video Info
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.title,
                                style: GoogleFonts.nunito(fontWeight: FontWeight.w900, 
                                  fontSize: 18, color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.remove_red_eye_outlined,
                                      size: 14, color: Colors.black45),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${_viewStats?['totalViews'] ?? widget.views ?? 0} views',
                                    style: GoogleFonts.nunito(
                                        fontSize: 13, color: Colors.black54),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text('·', style: TextStyle(color: Colors.black38)),
                                  const SizedBox(width: 8),
                                  Text(
                                    'by ${widget.channelTitle}',
                                    style: GoogleFonts.nunito(
                                        fontSize: 13, color: Colors.black54),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),



                        const Divider(height: 1),

                        // ── Materials used (Aug 2026) — previously only
                        // shown on the YouTube description itself and the
                        // home-screen strip, never in the actual player.
                        // Lets the child copy the list, and lets ANY
                        // viewer (not just the uploader) send a buy-kit
                        // email for these materials to a parent.
                        _buildMaterialsSection(),
                        if (_materials.isNotEmpty) const Divider(height: 1),

                        // ── Peer Rating ──
                        VideoRatingWidget(
                          videoId: widget.projectId,
                          creatorName: widget.channelTitle,
                        ),
                        const Divider(height: 1),

                        // Description
                        if (widget.description.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('About this project',
                                    style: GoogleFonts.nunito(
                                      fontSize: 15, fontWeight: FontWeight.w700,
                                      color: Colors.black87,
                                    )),
                                const SizedBox(height: 8),
                                Text(widget.description,
                                    style: GoogleFonts.nunito(
                                      fontSize: 14, color: Colors.black54,
                                      height: 1.5,
                                    )),
                              ],
                            ),
                          ),

                        const Divider(height: 1),

    ];
  }

  // ── Comments header, input box, and comment list ─────────────────────────
  // Extracted verbatim from the previous single-column build().
  List<Widget> _buildCommentsWidgets() {
    return [
      // Comments
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '💬 Comments (${_comments.length})',
                                style: GoogleFonts.nunito(
                                  fontSize: 15, fontWeight: FontWeight.w700,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Comment input
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 18,
                                    backgroundColor: pastelBlue,
                                    child: Text(
                                      _isAuthenticated && _user?.name != null
                                          ? _user!.name![0].toUpperCase()
                                          : '?',
                                      style: GoogleFonts.nunito(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: TextField(
                                      controller: _commentController,
                                      style: GoogleFonts.nunito(fontSize: 14),
                                      decoration: InputDecoration(
                                        hintText: _isAuthenticated
                                            ? 'Add a comment...'
                                            : 'Login to comment',
                                        hintStyle: GoogleFonts.nunito(
                                            fontSize: 14,
                                            color: Colors.black38),
                                        border: OutlineInputBorder(
                                          borderRadius:
                                              BorderRadius.circular(20),
                                          borderSide: const BorderSide(
                                              color: Color(0xFFE5E7EB)),
                                        ),
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                                horizontal: 16, vertical: 8),
                                        suffixIcon: IconButton(
                                          icon: const Icon(Icons.send,
                                              color: pastelBlueText),
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
                                    child: CircularProgressIndicator(
                                        color: pastelBlueText),
                                  ),
                                ),

                              if (!_isLoadingComments)
                                ..._comments.asMap().entries.map((entry) {
                                  final index = entry.key;
                                  final comment = entry.value;
                                  final isOwnComment = _isAuthenticated &&
                                      _user != null &&
                                      comment['userId'] ==
                                          _user!.id?.toString();

                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 16),
                                    child: Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        CircleAvatar(
                                          radius: 18,
                                          backgroundColor:
                                              Colors.grey.shade200,
                                          child: Text(
                                            (comment['userName'] ??
                                                    'U')[0]
                                                .toUpperCase(),
                                            style: GoogleFonts.nunito(
                                                fontWeight: FontWeight.bold,
                                                color: Colors.black54),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Text(
                                                    comment['userName'] ??
                                                        'Unknown',
                                                    style: GoogleFonts.nunito(
                                                      fontSize: 13,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                      color: Colors.black87,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Text(
                                                    _formatTimeAgo(
                                                        comment['createdAt']),
                                                    style: GoogleFonts.nunito(
                                                        fontSize: 11,
                                                        color: Colors.black38),
                                                  ),
                                                  if (isOwnComment) ...[
                                                    const Spacer(),
                                                    GestureDetector(
                                                      onTap: () =>
                                                          _editComment(index),
                                                      child: const Icon(
                                                          Icons.edit_outlined,
                                                          size: 18,
                                                          color:
                                                              Colors.black45),
                                                    ),
                                                    const SizedBox(width: 12),
                                                    GestureDetector(
                                                      onTap: () =>
                                                          _deleteComment(
                                                              comment['id'] ??
                                                                  '',
                                                              index),
                                                      child: const Icon(
                                                          Icons.delete_outline,
                                                          size: 18,
                                                          color: Colors.red),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                comment['comment'] ?? '',
                                                style: GoogleFonts.nunito(
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
                                      'No comments yet. Be the first! 💬',
                                      style: GoogleFonts.nunito(
                                          color: Colors.grey, fontSize: 14),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),
    ];
  }
}