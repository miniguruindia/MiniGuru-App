import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/Projects.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/utils/NetworkPlayer.dart';

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
    materialList = jsonDecode(jsonDecode(widget.project.materials));
    comments = jsonDecode(jsonDecode(widget.project.comments));
  }

  bool get hasUserAlreadyCommented {
    return comments
        .any((comment) => comment['commentedBy']['id'] == widget.user.id);
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
            // Thumbnail or Video
            ClipRRect(
              borderRadius: BorderRadius.circular(16.0),
              child: SizedBox(
                height: 200,
                child: NetworkVideoPlayer(
                    videoUrl: jsonDecode(widget.project.video)['url']),
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
