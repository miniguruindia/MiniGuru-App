import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/ChildProfile.dart';
import 'package:miniguru/models/Projects.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/repository/projectRepository.dart';
import 'package:miniguru/screens/projectDetailsScreen.dart';
import 'package:miniguru/screens/uploadVideoScreen.dart';
import 'package:miniguru/state/sessionState.dart';
import 'package:miniguru/screens/homeScreen.dart';

class MentorActivityTab extends StatefulWidget {
  const MentorActivityTab({super.key});

  @override
  State<MentorActivityTab> createState() => _MentorActivityTabState();
}

class _MentorActivityTabState extends State<MentorActivityTab> {
  late MiniguruApi _api;
  late ProjectRepository _projectRepo;
  List<ChildProfile> _children = [];
  List<Project> _projects = [];
  User? _user;
  bool _isLoading = true;
  String? _selectedChildId; // null = all children

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    _projectRepo = ProjectRepository();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final userResult = await _api.getUserData();
      final childrenResult = await _api.getMentorChildren();
      await _projectRepo.fetchAndStoreProjectsForUser();
      final projectsResult = await _projectRepo.getProjects();
      if (mounted) {
        setState(() {
          _user = userResult;
          _children = childrenResult;
          _projects = projectsResult;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<Project> _filteredProjects() {
    if (_selectedChildId == null) return _projects;
    final child = _children.firstWhere(
      (c) => c.id == _selectedChildId,
      orElse: () => _children.first,
    );
    return _projects.where((p) =>
        p.title.toLowerCase().startsWith(child.name.toLowerCase())).toList();
  }

  void _showUploadDialog() {
    final Set<String> selected = {};
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            left: 24, right: 24, top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text('Upload Video for...',
                  style: GoogleFonts.nunito(
                      fontSize: 20, fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text('Select which learner(s) this video belongs to',
                  style: GoogleFonts.nunito(
                      fontSize: 13, color: Colors.grey[500])),
              const SizedBox(height: 16),
              if (_children.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Text('No children added yet.',
                      style: GoogleFonts.nunito(color: Colors.grey[400])),
                )
              else
                ..._children.map((child) {
                  final isSelected = selected.contains(child.id);
                  return GestureDetector(
                    onTap: () => setSheet(() {
                      if (isSelected) {
                        selected.remove(child.id);
                      } else {
                        selected.add(child.id);
                      }
                    }),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? pastelBlueText.withOpacity(0.08)
                            : Colors.grey[50],
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isSelected
                              ? pastelBlueText
                              : Colors.grey[200]!,
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor:
                                pastelBlueText.withOpacity(0.15),
                            child: Text(child.name[0].toUpperCase(),
                                style: GoogleFonts.nunito(
                                    fontWeight: FontWeight.w900,
                                    color: pastelBlueText)),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(child.name,
                                  style: GoogleFonts.nunito(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800)),
                              if (child.grade != null)
                                Text('Grade ${child.grade}',
                                    style: GoogleFonts.nunito(
                                        fontSize: 12,
                                        color: Colors.grey[500])),
                            ],
                          ),
                          const Spacer(),
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSelected
                                  ? pastelBlueText
                                  : Colors.transparent,
                              border: Border.all(
                                color: isSelected
                                    ? pastelBlueText
                                    : Colors.grey[300]!,
                                width: 2,
                              ),
                            ),
                            child: isSelected
                                ? const Icon(Icons.check,
                                    color: Colors.white, size: 14)
                                : null,
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: selected.isEmpty
                      ? null
                      : () {
                          Navigator.pop(ctx);
                          _proceedToUpload(selected.toList());
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: pastelBlueText,
                    disabledBackgroundColor: Colors.grey[300],
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(
                    selected.isEmpty
                        ? 'Select at least one learner'
                        : 'Continue with ${selected.length} learner${selected.length > 1 ? 's' : ''}',
                    style: GoogleFonts.nunito(
                        fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _proceedToUpload(List<String> childIds) {
    // Set session to first selected child, then navigate to upload
    final child = _children.firstWhere((c) => childIds.contains(c.id));
    SessionState.setChild(child.id, child.name, child.avatar);
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const UploadVideoScreen()),
    ).then((_) {
      SessionState.clearChild();
      _loadData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredProjects();

    return Scaffold(
      backgroundColor: backgroundWhite,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          color: pastelBlueText,
          child: CustomScrollView(
            slivers: [
              // Header
              SliverToBoxAdapter(
                child: Container(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF5B6EF5), Color(0xFF8B9FF8)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius:
                        BorderRadius.vertical(bottom: Radius.circular(24)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Children\'s Activity',
                          style: GoogleFonts.nunito(
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              color: Colors.white)),
                      const SizedBox(height: 4),
                      Text(
                        '${_projects.length} project${_projects.length == 1 ? '' : 's'} total',
                        style: GoogleFonts.nunito(
                            fontSize: 14,
                            color: Colors.white.withOpacity(0.85)),
                      ),
                    ],
                  ),
                ),
              ),

              // Filter chips
              if (_children.isNotEmpty)
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 52,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      children: [
                        _filterChip('All', null),
                        ..._children.map((c) => _filterChip(c.name, c.id)),
                      ],
                    ),
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 8)),

              // Loading
              if (_isLoading)
                const SliverToBoxAdapter(
                  child: Center(
                      child: Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: CircularProgressIndicator(color: pastelBlueText),
                  )),
                )
              // Empty
              else if (filtered.isEmpty)
                SliverToBoxAdapter(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 48),
                      child: Column(
                        children: [
                          const Text('📁',
                              style: TextStyle(fontSize: 56)),
                          const SizedBox(height: 16),
                          Text('No projects yet',
                              style: GoogleFonts.nunito(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900)),
                          const SizedBox(height: 8),
                          Text(
                              'Projects created by your children\nwill appear here',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.nunito(
                                  fontSize: 14,
                                  color: Colors.grey[500])),
                        ],
                      ),
                    ),
                  ),
                )
              // Projects list
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) =>
                          _buildProjectCard(filtered[index]),
                      childCount: filtered.length,
                    ),
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showUploadDialog,
        backgroundColor: pastelBlueText,
        icon: const Icon(Icons.video_call, color: Colors.white),
        label: Text('Upload Video',
            style: GoogleFonts.nunito(
                color: Colors.white, fontWeight: FontWeight.w800)),
      ),
    );
  }

  Widget _filterChip(String label, String? childId) {
    final selected = _selectedChildId == childId;
    return GestureDetector(
      onTap: () => setState(() => _selectedChildId = childId),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? pastelBlueText : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: selected ? pastelBlueText : Colors.grey[300]!),
        ),
        child: Text(label,
            style: GoogleFonts.nunito(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : Colors.grey[600])),
      ),
    );
  }

  Widget _buildProjectCard(Project project) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => ProjectDetailsScreen(
              project: project,
              backgroundColor: const Color(0xFF5B6EF5),
              user: _user!,
            )),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 8,
                offset: const Offset(0, 3)),
          ],
        ),
        child: Row(
          children: [
            // Thumbnail
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: project.thumbnail.isNotEmpty
                  ? Image.network(
                      project.thumbnail,
                      width: 64,
                      height: 64,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _thumbPlaceholder(),
                    )
                  : _thumbPlaceholder(),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(project.title,
                      style: GoogleFonts.nunito(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Colors.black87),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      // status not available,
                      const SizedBox(width: 8),
                      Text(project.category ?? '',
                          style: GoogleFonts.nunito(
                              fontSize: 11, color: Colors.grey[400])),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.grey),
          ],
        ),
      ),
    );
  }

  Widget _thumbPlaceholder() {
    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Icon(Icons.folder, color: Colors.grey, size: 28),
    );
  }

  Widget _statusChip(String status) {
    Color color;
    switch (status.toLowerCase()) {
      case 'approved':
        color = Colors.green;
        break;
      case 'pending':
        color = Colors.orange;
        break;
      case 'rejected':
        color = Colors.red;
        break;
      default:
        color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(status,
          style: GoogleFonts.nunito(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color)),
    );
  }
}
