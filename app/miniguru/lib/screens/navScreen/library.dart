import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/ProjectCategory.dart';
import 'package:miniguru/models/Projects.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/repository/projectRepository.dart';
import 'package:miniguru/repository/userDataRepository.dart';
import 'package:miniguru/screens/projectDetailsScreen.dart';

class Library extends StatefulWidget {
  const Library({super.key});

  @override
  State<Library> createState() => _LibraryState();
}

class _LibraryState extends State<Library> with AutomaticKeepAliveClientMixin {
  List<Project> _projects = [];
  final List<Project> _allProjects = [];
  List<ProjectCategory> _projectCategory = [];
  bool _loading = true;
  bool _isLoadingMore = false;
  final Set<String> _selectedCategories = {};

  int _currentPage = 1;
  bool _hasMorePages = true;
  int _totalProjects = 0;

  User? user;
  final ScrollController _scrollController = ScrollController();
  final _searchController = TextEditingController();

  static const _colors = [pastelBlue, pastelYellow, pastelGreen, pastelRed];
  static const _fontColors = [
    pastelBlueText,
    pastelYellowText,
    pastelGreenText,
    pastelRedText
  ];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
    _setupScrollController();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _setupScrollController() {
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
              _scrollController.position.maxScrollExtent * 0.8 &&
          !_isLoadingMore &&
          _hasMorePages &&
          !_loading &&
          _selectedCategories.isEmpty &&
          _searchController.text.isEmpty) {
        _loadMoreProjects();
      }
    });
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _loading = true;
      _currentPage = 1;
      _projects.clear();
      _allProjects.clear();
      _hasMorePages = true;
    });

    try {
      await Future.wait([
        _loadUserData(),
        _loadCategories(),
      ]);
      await _loadProjects();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error loading data: $e'),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadUserData() async {
    final userRepository = UserRepository();
    await userRepository.fetchAndStoreUserData();
    user = await userRepository.getUserDataFromLocalDb();
  }

  Future<void> _loadCategories() async {
    final repo = ProjectRepository();
    await repo.fetchAndStoreProjectCategory();
    final categories = await repo.getProjectCategories();
    if (mounted) {
      setState(() => _projectCategory = categories);
    }
  }

  Future<void> _loadProjects() async {
    if (!_hasMorePages) return;

    final repo = ProjectRepository();
    try {
      final totalProjects = await repo.fetchAndStoreProjects(_currentPage, 20);

      if (_currentPage == 1) _totalProjects = totalProjects;

      final newProjects = await repo.getProjects();

      if (mounted) {
        setState(() {
          _allProjects.addAll(newProjects);
          _hasMorePages = _allProjects.length < _totalProjects;
          _applyFilters();
        });
      }
    } catch (e) {
      print('Error loading projects: $e');
    }
  }

  Future<void> _loadMoreProjects() async {
    if (_isLoadingMore || !_hasMorePages) return;

    setState(() => _isLoadingMore = true);
    _currentPage++;
    await _loadProjects();
    setState(() => _isLoadingMore = false);
  }

  void _applyFilters() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _projects = _allProjects.where((project) {
        final matchesCategory = _selectedCategories.isEmpty ||
            _selectedCategories.contains(project.category);
        final matchesQuery =
            query.isEmpty || project.title.toLowerCase().contains(query);
        return matchesCategory && matchesQuery;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Scaffold(
      backgroundColor: backgroundWhite,
      appBar: AppBar(
        title: Text('Discover', style: headingTextStyle.copyWith(fontSize: 24)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.black54),
            onPressed: _loadInitialData,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: pastelBlueText))
          : RefreshIndicator(
              onRefresh: _loadInitialData,
              child: CustomScrollView(
                controller: _scrollController,
                slivers: [
                  SliverToBoxAdapter(child: _buildCategorySection()),
                  SliverToBoxAdapter(child: _buildSearchBar()),
                  _buildProjectList(),
                  if (_isLoadingMore)
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Center(
                          child:
                              CircularProgressIndicator(color: pastelBlueText),
                        ),
                      ),
                    ),
                ],
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
          height: 120,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _projectCategory.length,
            itemBuilder: (context, index) {
              final category = _projectCategory[index];
              final isSelected = _selectedCategories.contains(category.name);
              final color = _colors[index % _colors.length];
              final fontColor = _fontColors[index % _fontColors.length];

              return GestureDetector(
                onTap: () {
                  setState(() {
                    if (isSelected) {
                      _selectedCategories.remove(category.name);
                    } else {
                      _selectedCategories.add(category.name);
                    }
                    _applyFilters();
                  });
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Column(
                    children: [
                      Container(
                        width: 70,
                        height: 70,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: color,
                          border: Border.all(
                            color:
                                isSelected ? Colors.black : Colors.transparent,
                            width: 3,
                          ),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: color.withOpacity(0.4),
                                    spreadRadius: 2,
                                    blurRadius: 8,
                                  ),
                                ]
                              : null,
                        ),
                        child: Icon(category.icon,
                            size: 32, color: Colors.black87),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        category.name,
                        style: bodyTextStyle.copyWith(
                          fontSize: 11,
                          color: isSelected ? fontColor : Colors.black54,
                          fontWeight:
                              isSelected ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
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
        onChanged: (_) => _applyFilters(),
      ),
    );
  }

  Widget _buildProjectList() {
    if (_projects.isEmpty && !_loading) {
      return SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.explore_outlined, size: 64, color: Colors.grey[400]),
              const SizedBox(height: 16),
              Text(
                'No projects found',
                style: headingTextStyle.copyWith(color: Colors.grey[600]),
              ),
              const SizedBox(height: 8),
              Text(
                'Try adjusting your filters',
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
          (context, index) {
            final project = _projects[index];
            final color = _colors[index % _colors.length];
            final fontColor = _fontColors[index % _fontColors.length];

            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              elevation: 2,
              child: InkWell(
                onTap: () {
                  if (user != null) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => ProjectDetailsScreen(
                          project: project,
                          backgroundColor: color,
                          user: user!,
                        ),
                      ),
                    );
                  }
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
                                  style:
                                      headingTextStyle.copyWith(fontSize: 16),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  project.description,
                                  style: bodyTextStyle.copyWith(
                                    fontSize: 13,
                                    color: Colors.black54,
                                  ),
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
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: fontColor.withOpacity(0.3),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: fontColor),
                            ),
                            child: Text(
                              project.category,
                              style: bodyTextStyle.copyWith(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            project.author,
                            style: bodyTextStyle.copyWith(
                              fontSize: 12,
                              color: Colors.black54,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
          childCount: _projects.length,
        ),
      ),
    );
  }
}
