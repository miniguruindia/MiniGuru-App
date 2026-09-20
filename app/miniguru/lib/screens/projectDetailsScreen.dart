import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:file_picker/file_picker.dart';
import 'package:miniguru/network/web_video_helper_stub.dart'
    if (dart.library.html) 'package:miniguru/network/web_video_helper_web.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/Projects.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/unifiedVideoPlayer.dart';

class ProjectDetailsScreen extends StatefulWidget {
  final Project project;
  final Color backgroundColor;
  final User user;

  const ProjectDetailsScreen(
      {super.key,
      required this.project,
      required this.backgroundColor,
      required this.user});

  @override
  State<ProjectDetailsScreen> createState() => _ProjectDetailsScreenState();
}

class _ProjectDetailsScreenState extends State<ProjectDetailsScreen> {
  late List<dynamic> materialList;

  final List<String> predefinedComments = [
    'Beautiful',
    'Sturdy',
    'Creative',
    'Working Model',
    'Low Cost'
  ];
  Set<String> selectedComments = {};

  List<dynamic> comments = [];
  bool isLoading = false;

  final _miniguruApi = MiniguruApi();

  @override
  void initState() {
    super.initState();
    // BUGFIX: this used to assign the decode result directly into a
    // non-nullable `late List<dynamic>` field with no error handling. If a
    // project had no materials selected (a real, common case — not every
    // child picks materials before uploading), the double-decode below
    // could resolve to null, and assigning null into a non-nullable late
    // field throws immediately inside initState(). Flutter can't recover
    // from an exception there, which in a release build shows up as
    // exactly a blank screen with no visible error — matching the bug
    // report. Same risk applied to comments. Both now default safely to
    // an empty list instead of crashing the whole screen.
    materialList = _safeDoubleDecodeList(widget.project.materials);
    comments = _safeDoubleDecodeList(widget.project.comments);
  }

  bool get _isOwner => widget.user.id == widget.project.userId;
  bool _replacingVideo = false;

  // ── Replace Video (Sept 2026) ───────────────────────────────────────
  // Only the project's owner sees this. Picking and uploading a new video
  // always sends the project back for a fresh AI + admin review — same
  // reset the backend enforces regardless of what this screen does, so
  // there's no way to accidentally publish a new video without review.
  Future<void> _pickAndReplaceVideo() async {
    XFile? pickedMobile;
    WebFilePick? pickedWeb;
    try {
      if (kIsWeb) {
        // FIXED PROPERLY (Sept 2026): the previous version here used
        // FilePicker + a "streamed" upload — but package:http's
        // StreamedRequest turned out NOT to actually stream on web at all
        // (documented upstream bug: dart-lang/http#1030). Using the
        // browser's own native file input + raw XHR (web_video_helper_web
        // .dart) is the real fix.
        final pick = await pickVideoFileWeb();
        if (pick != null) {
          if (pick.size > 150 * 1024 * 1024) {
            _showReplaceSnack(
                'This video is large (${(pick.size / (1024 * 1024)).round()}MB) — '
                'keep this tab open and stay on a strong connection while it uploads.');
          }
          pickedWeb = pick;
        }
      } else {
        await [Permission.storage].request();
        pickedMobile = await ImagePicker().pickVideo(source: ImageSource.gallery);
      }
    } catch (e) {
      _showReplaceSnack('Could not pick that video: $e', isError: true);
      return;
    }
    if (pickedMobile == null && pickedWeb == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Replace this video?'),
        content: const Text(
            'Your project will go back to Pending — an admin will need to '
            'review and approve it again before it\'s visible to anyone else. '
            'Everything else (title, materials, category) stays the same.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Replace')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _replacingVideo = true);
    try {
      final response = pickedWeb != null
          ? await _miniguruApi.replaceProjectVideoWebNative(widget.project.id, pickedWeb)
          : await _miniguruApi.replaceProjectVideo(widget.project.id, pickedMobile!);
      if (response != null && response.statusCode >= 200 && response.statusCode < 300) {
        _showReplaceSnack('New video uploaded! Your project is back under review.');
      } else {
        String message = 'Could not replace the video. Please try again.';
        try {
          final body = jsonDecode(response?.body ?? '{}') as Map<String, dynamic>;
          if (body['error'] is String) message = body['error'];
        } catch (_) {}
        _showReplaceSnack(message, isError: true);
      }
    } catch (e) {
      _showReplaceSnack('Could not replace the video: $e', isError: true);
    } finally {
      if (mounted) setState(() => _replacingVideo = false);
    }
  }

  void _showReplaceSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: isError ? Colors.red[400] : null,
    ));
  }

  ({String label, Color color, IconData icon}) _statusDisplay() {
    switch (widget.project.status) {
      case 'published':
        return (label: 'Published', color: Colors.green, icon: Icons.check_circle_outline);
      case 'rejected':
        return (label: 'Needs changes — see admin notes', color: Colors.red, icon: Icons.error_outline);
      default:
        return (label: 'Pending review', color: Colors.orange, icon: Icons.hourglass_top_outlined);
    }
  }

  String? _safeVideoUrl() {
    try {
      final decoded = jsonDecode(widget.project.video);
      if (decoded is Map && decoded['url'] is String && (decoded['url'] as String).isNotEmpty) {
        return decoded['url'] as String;
      }
      return null;
    } catch (e) {
      debugPrint('⚠️ ProjectDetailsScreen: could not parse video data ($e)');
      return null;
    }
  }

  String? _extractYoutubeId() {
    final url = _safeVideoUrl();
    if (url == null) return null;
    final match = RegExp(r'(?:v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})').firstMatch(url);
    return match?.group(1);
  }

  List<dynamic> _safeDoubleDecodeList(String raw) {
    try {
      final once = jsonDecode(raw);
      final twice = once is String ? jsonDecode(once) : once;
      if (twice is List) return twice;
      return [];
    } catch (e) {
      debugPrint('⚠️ ProjectDetailsScreen: could not parse "$raw" — showing empty list ($e)');
      return [];
    }
  }

  bool get hasUserAlreadyCommented {
    return comments.any((comment) {
      final commentedBy = comment is Map ? comment['commentedBy'] : null;
      return commentedBy is Map && commentedBy['id'] == widget.user.id;
    });
  }

  Future<void> submitComment() async {
    if (selectedComments.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please select one comment to continue!',
            style: bodyTextStyle.copyWith(color: Colors.white),
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => isLoading = true);

    try {
      var processedComment = selectedComments.toString().substring(1);
      var length = processedComment.length;
      processedComment = processedComment.substring(0, length - 1);
      final response =
          await _miniguruApi.addComment(widget.project.id, processedComment);

      if (response?.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Comment posted successfully!')),
        );
        setState(() => selectedComments.clear());
      } else {
        throw Exception('Failed to post comment');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Failed to post comment. Please try again.')),
      );
    } finally {
      setState(() => isLoading = false);
    }
  }

  Widget _buildCommentSection() {
    final isAuthor = widget.user.id == widget.project.userId;

    if (isAuthor) {
      return Container(
        padding: const EdgeInsets.all(16.0),
        decoration: BoxDecoration(
          color: Colors.grey[100],
          borderRadius: BorderRadius.circular(12.0),
          border: Border.all(color: Colors.grey[300]!),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Comments Section',
              style: headingTextStyle.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'As the author, you can view comments here.',
              style: bodyTextStyle.copyWith(color: Colors.grey[600]),
            ),
            const SizedBox(height: 16),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: comments.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final comment = comments[index];
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey[200]!),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        comment['commentedBy']['name'],
                        style: bodyTextStyle.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        comment['content'],
                        style: bodyTextStyle,
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      );
    }

    if (hasUserAlreadyCommented) {
      return Container(
        padding: const EdgeInsets.all(16.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12.0),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your Comment',
              style: headingTextStyle.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              comments.firstWhere((comment) =>
                  comment['commentedBy']['id'] == widget.user.id)['content'],
              style: bodyTextStyle.copyWith(
                color: Colors.black87,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12.0),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Add Your Comments',
            style: headingTextStyle.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8.0,
            runSpacing: 8.0,
            children: predefinedComments.map((comment) {
              final isSelected = selectedComments.contains(comment);
              return FilterChip(
                label: Text(comment),
                selected: isSelected,
                selectedColor: widget.backgroundColor.withOpacity(0.8),
                checkmarkColor: Colors.black54,
                labelStyle: bodyTextStyle.copyWith(
                  color: isSelected ? Colors.black54 : Colors.black87,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
                backgroundColor: Colors.grey[100],
                onSelected: (bool selected) {
                  setState(() {
                    if (selected) {
                      selectedComments.add(comment);
                    } else {
                      selectedComments.remove(comment);
                    }
                  });
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: isLoading ? null : submitComment,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : Text(
                      'Submit Comment',
                      style: bodyTextStyle.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
      appBar: AppBar(
        backgroundColor: widget.backgroundColor,
        elevation: 0,
        centerTitle: true,
        title: Text(
          widget.project.title,
          textAlign: TextAlign.center,
          style: bodyTextStyle.copyWith(
            fontWeight: FontWeight.bold,
            color: Colors.black54,
            fontSize: 18,
          ),
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(16.0)),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // BUGFIX: this used to hand the YouTube *watch* URL straight to
            // NetworkVideoPlayer (raw video_player, expects a direct .mp4
            // file) — YouTube URLs can never play that way, hence the
            // blank/frozen player. Show the real thumbnail instead, tap to
            // open the same UnifiedVideoPlayer used everywhere else in the
            // app, which actually knows how to embed YouTube.
            GestureDetector(
              onTap: _extractYoutubeId() != null
                  ? () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => UnifiedVideoPlayer(
                            videoId: _extractYoutubeId()!,
                            projectId: widget.project.id,
                            title: widget.project.title,
                            description: widget.project.description,
                            channelTitle: widget.project.author,
                          ),
                        ),
                      )
                  : null,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16.0),
                child: SizedBox(
                  height: 200,
                  width: double.infinity,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      widget.project.thumbnail.isNotEmpty
                          ? Image.network(
                              widget.project.thumbnail,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(color: Colors.black12),
                            )
                          : Container(color: Colors.black12),
                      if (_extractYoutubeId() != null)
                        Container(
                          color: Colors.black26,
                          alignment: Alignment.center,
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: const BoxDecoration(
                              color: Colors.white70,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.play_arrow_rounded, size: 36, color: Colors.black87),
                          ),
                        )
                      else
                        Container(
                          alignment: Alignment.center,
                          child: const Text('Video unavailable',
                              style: TextStyle(color: Colors.black45)),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24.0),

            // Title with shadow effect
            Container(
              padding: const EdgeInsets.all(16.0),
              width: double.infinity,
              decoration: BoxDecoration(
                color: widget.backgroundColor,
                borderRadius: BorderRadius.circular(12.0),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.project.description,
                    style: bodyTextStyle.copyWith(
                      color: Colors.grey[800],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24.0),

            // Review status + Replace Video — owner only. Any owner can
            // replace their video at any time, whatever the current
            // status; doing so always resets the project to Pending for a
            // fresh review (enforced server-side regardless of this UI).
            if (_isOwner) ...[
              Builder(builder: (context) {
                final status = _statusDisplay();
                return Container(
                  padding: const EdgeInsets.all(12.0),
                  decoration: BoxDecoration(
                    color: status.color.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12.0),
                    border: Border.all(color: status.color.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(status.icon, color: status.color, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(status.label,
                            style: bodyTextStyle.copyWith(
                                color: status.color, fontWeight: FontWeight.w600)),
                      ),
                      OutlinedButton.icon(
                        onPressed: _replacingVideo ? null : _pickAndReplaceVideo,
                        icon: _replacingVideo
                            ? const SizedBox(
                                width: 14, height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.refresh, size: 16),
                        label: Text(_replacingVideo ? 'Uploading…' : 'Replace Video'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: status.color,
                          side: BorderSide(color: status.color),
                        ),
                      ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 24.0),
            ],

            // Author and Category
            SizedBox(
              width: double.infinity,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: _buildInfoCard(
                      icon: Icons.person_outline,
                      label: "Author",
                      value: widget.project.author,
                    ),
                  ),
                  const SizedBox(
                    width: 10,
                  ),
                  Expanded(
                    child: _buildInfoCard(
                      icon: Icons.category_outlined,
                      label: "Category",
                      value: widget.project.category,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24.0),

            // Start and End Date
            SizedBox(
              width: double.infinity,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: _buildInfoCard(
                      icon: Icons.calendar_today_outlined,
                      label: "Start Date",
                      value: _formatDate(widget.project.startDate),
                    ),
                  ),
                  const SizedBox(
                    width: 10,
                  ),
                  Expanded(
                    child: _buildInfoCard(
                      icon: Icons.event_outlined,
                      label: "End Date",
                      value: _formatDate(widget.project.endDate),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24.0),

            // Materials Used Section
            Text(
              "Materials Used",
              style: headingTextStyle.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8.0),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12.0),
                boxShadow: [
                  BoxShadow(
                    color: Colors.grey.withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Table(
                  columnWidths: const {
                    0: FlexColumnWidth(2),
                    1: FlexColumnWidth(1),
                  },
                  children: [
                    TableRow(
                      decoration: BoxDecoration(
                        color: widget.backgroundColor.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(5.0),
                      ),
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(8.0),
                          child: Text('Material Name',
                              style: bodyTextStyle.copyWith(
                                  fontWeight: FontWeight.bold)),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(8.0),
                          child: Text('Quantity',
                              style: bodyTextStyle.copyWith(
                                  fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    ...materialList.map((material) {
                      return TableRow(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Text(material['name'] ?? "null",
                                style: bodyTextStyle),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Text(
                              material['quantity'].toString(),
                              style: bodyTextStyle,
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      );
                    }),
                  ],
                ),
              ),
            ),
            const SizedBox(
              height: 16,
            ),
            _buildCommentSection()
          ],
        ),
      ),
    );
  }

  // Build an info card with icon and value
  Widget _buildInfoCard(
      {required IconData icon, required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12.0),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.grey[600], size: 24.0),
          const SizedBox(width: 8.0),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: bodyTextStyle.copyWith(
                    fontSize: 12, color: Colors.grey[600]),
              ),
              const SizedBox(height: 4.0),
              Text(
                value,
                overflow: TextOverflow.ellipsis,
                style: bodyTextStyle.copyWith(
                    fontSize: 14, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Helper function to format date
  String _formatDate(DateTime date) {
    return "${date.day}/${date.month}/${date.year}";
  }
}
