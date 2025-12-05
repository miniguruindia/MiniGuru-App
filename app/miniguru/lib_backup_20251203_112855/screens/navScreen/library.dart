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

class _LibraryState extends State<Library> {
  List<Project> _projects = [];
  final List<Project> _allProjects = []; // Store all projects for current page
  List<ProjectCategory> _projectCategory = [];
  bool _loading = true;
  bool _isLoadingMore = false; // Track if we're loading more projects
  final Set<String> _selectedCategories = {};

  int _currentPage = 1;
  bool _hasMorePages = true; // Track if more pages are available
  int _totalProjects = 0; // Store total number of projects

  late User user;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadInitialData();
    _setupScrollController();
  }

  void _setupScrollController() {
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
              _scrollController.position.maxScrollExtent * 0.8 &&
          !_isLoadingMore &&
          _hasMorePages &&
          !_loading) {
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
    });

    await _loadUserData();
    await _loadProjects();
    await _loadCategories();

    setState(() {
      _loading = false;
    });
  }

  Future<void> _loadUserData() async {
    UserRepository userRepository = UserRepository();
    await userRepository.fetchAndStoreUserData();
    user = (await userRepository.getUserDataFromLocalDb())!;
  }

  Future<void> _loadCategories() async {
    ProjectRepository repo = ProjectRepository();
    await repo.fetchAndStoreProjectCategory();
    List<ProjectCategory> categories = await repo.getProjectCategories();

    setState(() {
      _projectCategory = categories;
    });
  }

  Future<void> _loadProjects() async {
    if (!_hasMorePages) return;

    ProjectRepository repo = ProjectRepository();

    try {
      // Fetch total number of projects
      int totalProjects = await repo.fetchAndStoreProjects(_currentPage, 20);

      // Update total projects count on first load
      if (_currentPage == 1) {
        _totalProjects = totalProjects;
      }

      List<Project> newProjects = await repo.getProjects();

      setState(() {
        // Add new projects to both lists
        _projects.addAll(newProjects);
        _allProjects.addAll(newProjects);

        // Check if we've reached the end
        _hasMorePages = _allProjects.length < _totalProjects;
      });

      // Apply filters if any are selected
      if (_selectedCategories.isNotEmpty) {
        await _filterProjects();
      }
    } catch (e) {
      print('Error loading projects: $e');
      // Handle error appropriately
    }
  }

  Future<void> _loadMoreProjects() async {
    if (_isLoadingMore || !_hasMorePages) return;

    setState(() {
      _isLoadingMore = true;
    });

    _currentPage++;
    await _loadProjects();

    setState(() {
      _isLoadingMore = false;
    });
  }

  Future<void> _filterProjects() async {
    setState(() {
      if (_selectedCategories.isEmpty) {
        // Reset to all loaded projects if no categories are selected
        _projects = List.from(_allProjects);
      } else {
        // Filter projects based on selected categories
        _projects = _allProjects
            .where((project) => _selectedCategories.contains(project.category))
            .toList();
      }
    });
  }

  Future<void> _refreshProjects() async {
    setState(() {
      _currentPage = 1;
      _projects.clear();
      _allProjects.clear();
      _hasMorePages = true;
    });
    await _loadProjects();
  }

  void toggleCategory(String category) {
    setState(() {
      if (_selectedCategories.contains(category)) {
        _selectedCategories.remove(category);
      } else {
        _selectedCategories.add(category);
      }
    });
    _refreshProjects(); // Reload projects with new filter
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        "Categories",
                        style: headingTextStyle,
                      ),
                    ),
                    _buildFilterIcons(),
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        "Projects",
                        style: headingTextStyle,
                      ),
                    ),
                    _buildSearchBar(),
                    Expanded(child: _buildProjectList())
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildFilterIcons() {
    List<Color> colors = [pastelBlue, pastelYellow, pastelRed, pastelGreen];
    List<Color> fontColors = [
      pastelBlueText,
      pastelYellowText,
      pastelRedText,
      pastelGreenText
    ];
    return SizedBox(
      height: 120,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: _projectCategory.length,
        itemBuilder: (context, index) {
          final category = _projectCategory[index];
          final isSelected =
              _selectedCategories.contains(category.name); // Check if selected

          return GestureDetector(
            onTap: () {
              setState(() {
                if (isSelected) {
                  _selectedCategories
                      .remove(category.name); // Remove if already selected
                } else {
                  _selectedCategories
                      .add(category.name); // Add to selected list
                }
                _filterProjects();
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isSelected
                            ? Colors.black
                            : Colors.transparent, // Black border if selected
                        width: 3.0,
                      ),
                    ),
                    child: CircleAvatar(
                      backgroundColor: colors[index % colors.length],
                      radius: 35,
                      child: Icon(category.icon, size: 32),
                    ),
                  ),
                  const SizedBox(
                    height: 5,
                  ),
                  Text(
                    category.name,
                    style: bodyTextStyle.copyWith(
                      color: fontColors[index % colors.length],
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: TextField(
        decoration: InputDecoration(
          labelText: 'Search Projects',
          labelStyle: bodyTextStyle,
          border: const OutlineInputBorder(),
          prefixIcon: const Icon(Icons.search),
        ),
        onChanged: (query) {
          setState(() {
            if (query.isEmpty) {
              _filterProjects(); // Reset to filtered projects if search is cleared
            } else {
              _projects = _allProjects
                  .where((project) =>
                      project.title.toLowerCase().contains(query.toLowerCase()))
                  .toList();
            }
          });
        },
      ),
    );
  }

  Widget _buildProjectList() {
    List<Color> colors = [pastelBlue, pastelYellow, pastelGreen, pastelRed];
    List<Color> fontColors = [
      pastelBlueText,
      pastelYellowText,
      pastelGreenText,
      pastelRedText
    ];

    return ListView.builder(
      controller: _scrollController,
      itemCount: _projects.length + 1,
      itemBuilder: (context, index) {
        if (index == _projects.length) {
          return const SizedBox.shrink();
        }

        final project = _projects[index];
        final color = colors[index % colors.length];
        return GestureDetector(
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
          child: Card(
            color: color,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12.0),
            ),
            margin: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8.0),
                        child: Image.network(
                          project.thumbnail == ''
                              ? "https://picsum.photos/200"
                              : project.thumbnail,
                          width: 70.0,
                          height: 70.0,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 16.0),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              project.title,
                              style: headingTextStyle.copyWith(fontSize: 15),
                            ),
                            const SizedBox(height: 4.0),
                            Text(
                              project.description,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: bodyTextStyle.copyWith(fontSize: 14),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16.0),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4.0),
                        child: Container(
                          decoration: BoxDecoration(
                            color: fontColors[index % fontColors.length],
                            borderRadius: BorderRadius.circular(30),
                            border: Border.all(
                                color: fontColors[index % fontColors.length]),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Text(
                              project.category,
                              style: headingTextStyle.copyWith(fontSize: 11),
                            ),
                          ),
                        ),
                      ),
                      Text(
                        project.author,
                        style: bodyTextStyle.copyWith(
                            color: Colors.grey[600], fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
