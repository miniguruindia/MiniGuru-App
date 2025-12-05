import 'dart:math';
import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/Draft.dart';
import 'package:miniguru/models/ProjectCategory.dart';
import 'package:miniguru/models/Projects.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/models/editDraftScreen.dart';
import 'package:miniguru/repository/draftsRepository.dart';
import 'package:miniguru/repository/projectRepository.dart';
import 'package:miniguru/repository/userDataRepository.dart';
import 'package:miniguru/screens/addDraftScreen.dart';
import 'package:miniguru/screens/projectDetailsScreen.dart';

class ProjectScreen extends StatefulWidget {
  const ProjectScreen({super.key});

  @override
  State<ProjectScreen> createState() => _ProjectScreenState();
}

class _ProjectScreenState extends State<ProjectScreen>
    with AutomaticKeepAliveClientMixin {
  List<Project> _projects = [];
  List<Project> _allProjects = [];
  List<ProjectCategory> _projectCategory = [];
  List<Draft> _drafts = [];
  List<Draft> _allDrafts = [];

  bool _loading = true;
  bool _showCompleted = true;
  String _selectedCategory = '';

  late User user;

  final _searchController = TextEditingController();

  static const _colors = [pastelBlue, pastelYellow, pastelRed, pastelGreen];
  static const _fontColors = [
    pastelBlueText,
    pastelYellowText,
    pastelRedText,
    pastelGreenText
  ];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProjects() async {
    setState(() => _loading = true);

    try {
      final repo = ProjectRepository();
      final userRepository = UserRepository();

      await Future.wait([
        repo.fetchAndStoreProjectsForUser(),
        repo.fetchAndStoreProjectCategory(),
        _loadDrafts(),
        userRepository.fetchAndStoreUserData(),
      ]);

      final projects = await repo.getProjects();
      final categories = await repo.getProjectCategories();
      final userData = await userRepository.getUserDataFromLocalDb();

      if (mounted) {
        setState(() {
          _projectCategory = categories;
          _projects = projects;
          _allProjects = List.from(projects);
          user = userData!;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error loading projects: $e'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _loadDrafts() async {
    final repository = DraftRepository();
    final drafts = await repository.getDrafts();
    if (mounted) {
      setState(() {
        _drafts = drafts;
        _allDrafts = List.from(drafts);
      });
    }
  }

  void _applyFilters(String query) {
    setState(() {
      if (_showCompleted) {
        _projects = _allProjects.where((project) {
          final matchesCategory = _selectedCategory.isEmpty ||
              project.category.toLowerCase() == _selectedCategory.toLowerCase();
          final matchesQuery = query.isEmpty ||
              project.title.toLowerCase().contains(query.toLowerCase());
          return matchesCategory && matchesQuery;
        }).toList();
      } else {
        _drafts = _allDrafts.where((draft) {
          final matchesCategory = _selectedCategory.isEmpty ||
              draft.category.toLowerCase() == _selectedCategory.toLowerCase();
          final matchesQuery = query.isEmpty ||
              draft.title.toLowerCase().contains(query.toLowerCase());
          return matchesCategory && matchesQuery;
        }).toList();
      }
    });
  }

  Future<void> _deleteDraft(int draftId) async {
    try {
      await DraftRepository().deleteDraft(draftId);
      setState(() {
        _drafts.removeWhere((draft) => draft.id == draftId);
        _allDrafts.removeWhere((draft) => draft.id == draftId);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Draft deleted'), backgroundColor: Colors.green),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error deleting draft: $error'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Scaffold(
      backgroundColor: backgroundWhite,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const AddDraftScreen()),
          );
          _loadDrafts();
        },
        icon: const Icon(Icons.add),
        label: const Text('New Project'),
        backgroundColor: pastelBlueText,
      ),
      appBar: AppBar(
        title:
            Text('My Projects', style: headingTextStyle.copyWith(fontSize: 24)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.black54),
            onPressed: _loadProjects,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: pastelBlueText))
          : SafeArea(
              child: Column(
                children: [
                  _buildProjectTypeChips(),
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: _loadProjects,
                      child: CustomScrollView(
                        slivers: [
                          SliverToBoxAdapter(child: _buildCategorySection()),
                          SliverToBoxAdapter(child: _buildSearchBar()),
                          _showCompleted
                              ? _buildProjectList()
                              : _buildDraftProjectList(),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildProjectTypeChips() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          _buildChip('Completed', _showCompleted, () {
            setState(() {
              _showCompleted = true;
              _selectedCategory = '';
              _searchController.clear();
              _applyFilters('');
            });
          }),
          const SizedBox(width: 8),
          _buildChip('Drafts', !_showCompleted, () {
            setState(() {
              _showCompleted = false;
              _selectedCategory = '';
              _searchController.clear();
              _applyFilters('');
            });
          }),
        ],
      ),
    );
  }

  Widget _buildChip(String label, bool selected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? pastelBlueText : Colors.grey[200],
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: bodyTextStyle.copyWith(
            color: selected ? Colors.white : Colors.black87,
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _buildCategorySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text('Categories',
              style: headingTextStyle.copyWith(fontSize: 16)),
        ),
        SizedBox(
          height: 60,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _projectCategory.length,
            itemBuilder: (context, index) {
              final category = _projectCategory[index];
              final isSelected = _selectedCategory == category.name;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: ChoiceChip(
                  label: Text(category.name),
                  selected: isSelected,
                  onSelected: (selected) {
                    setState(() {
                      _selectedCategory = selected ? category.name : '';
                      _applyFilters(_searchController.text);
                    });
                  },
                  selectedColor: _colors[index % _colors.length],
                  backgroundColor: Colors.grey[200],
                  labelStyle: bodyTextStyle.copyWith(
                    fontSize: 13,
                    color: isSelected ? Colors.black87 : Colors.grey[700],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: TextField(
        controller: _searchController,
        decoration: InputDecoration(
          hintText: 'Search projects...',
          hintStyle: bodyTextStyle.copyWith(color: Colors.grey[400]),
          prefixIcon: const Icon(Icons.search, color: Colors.grey),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey[300]!),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey[300]!),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: pastelBlueText),
          ),
          filled: true,
          fillColor: Colors.white,
        ),
        onChanged: _applyFilters,
      ),
    );
  }

  Widget _buildProjectList() {
    if (_projects.isEmpty) {
      return SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.work_outline, size: 64, color: Colors.grey[400]),
              const SizedBox(height: 16),
              Text(
                'No published projects yet',
                style: headingTextStyle.copyWith(color: Colors.grey[600]),
              ),
              const SizedBox(height: 8),
              Text(
                'Tap + to create your first project',
                style: bodyTextStyle.copyWith(color: Colors.grey[500]),
              ),
            ],
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.all(16),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) => _buildProjectCard(_projects[index], index),
          childCount: _projects.length,
        ),
      ),
    );
  }

  Widget _buildDraftProjectList() {
    if (_drafts.isEmpty) {
      return SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.edit_note, size: 64, color: Colors.grey[400]),
              const SizedBox(height: 16),
              Text(
                'No drafts saved',
                style: headingTextStyle.copyWith(color: Colors.grey[600]),
              ),
              const SizedBox(height: 8),
              Text(
                'Start creating to save drafts',
                style: bodyTextStyle.copyWith(color: Colors.grey[500]),
              ),
            ],
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.all(16),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) => _buildDraftCard(_drafts[index], index),
          childCount: _drafts.length,
        ),
      ),
    );
  }

  Widget _buildProjectCard(Project project, int index) {
    final color = _colors[index % _colors.length];
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ProjectDetailsScreen(
                project: project,
                backgroundColor: color,
                user: user,
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      project.thumbnail.isEmpty
                          ? "https://picsum.photos/200"
                          : project.thumbnail,
                      width: 80,
                      height: 80,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 80,
                        height: 80,
                        color: Colors.grey[300],
                        child: const Icon(Icons.image, size: 40),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          project.title,
                          style: headingTextStyle.copyWith(fontSize: 16),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          project.description,
                          style: bodyTextStyle.copyWith(
                              fontSize: 13, color: Colors.black54),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      project.category,
                      style: bodyTextStyle.copyWith(
                          fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    project.author,
                    style: bodyTextStyle.copyWith(
                        fontSize: 12, color: Colors.black54),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDraftCard(Draft draft, int index) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: InkWell(
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => EditDraftScreen(
                backgroundColor: _colors[Random().nextInt(_colors.length)],
                draftId: draft.id!,
              ),
            ),
          );
          _loadDrafts();
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  "https://picsum.photos/200",
                  width: 80,
                  height: 80,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      draft.title,
                      style: headingTextStyle.copyWith(fontSize: 16),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      draft.description,
                      style: bodyTextStyle.copyWith(
                          fontSize: 13, color: Colors.black54),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: pastelYellow,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        draft.category,
                        style: bodyTextStyle.copyWith(
                            fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.red),
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: Text('Delete Draft',
                          style: headingTextStyle.copyWith(fontSize: 18)),
                      content: Text(
                          'Are you sure you want to delete this draft?',
                          style: bodyTextStyle),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: Text('Cancel',
                              style:
                                  bodyTextStyle.copyWith(color: Colors.grey)),
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.pop(context);
                            _deleteDraft(draft.id!);
                          },
                          child: Text('Delete',
                              style: bodyTextStyle.copyWith(
                                  color: Colors.red,
                                  fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
