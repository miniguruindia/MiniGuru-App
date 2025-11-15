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

class _ProjectScreenState extends State<ProjectScreen> {
  List<Project> _projects = [];
  List<ProjectCategory> _projectCategory = [];
  List<Draft> _drafts = [];

  bool _loading = true;
  bool _showCompleted = true; // Toggle between completed and drafts
  String _selectedCategory = '';
  String _searchQuery = '';

  late User user;

  final colors = [pastelBlue, pastelYellow, pastelRed, pastelGreen];
  final fontColors = [
    pastelBlueText,
    pastelYellowText,
    pastelRedText,
    pastelGreenText
  ];

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  Future<void> _loadProjects() async {
    ProjectRepository repo = ProjectRepository();
    UserRepository userRepository = UserRepository();

    await repo.fetchAndStoreProjectsForUser();
    await repo.fetchAndStoreProjectCategory();
    await _loadDrafts();

    List<Project> projects = await repo.getProjects();
    List<ProjectCategory> categories = await repo.getProjectCategories();

    await userRepository.fetchAndStoreUserData();
    user = (await userRepository.getUserDataFromLocalDb())!;

    setState(() {
      _projectCategory = categories;
      _projects = projects;
      _loading = false;
    });
  }

  Future<void> _loadDrafts() async {
    DraftRepository repository = DraftRepository();
    List<Draft> drafts = await repository.getDrafts();
    setState(() {
      _drafts = drafts;
    });
  }

  @override
  Widget build(BuildContext context) {
    _loadDrafts();
    return Scaffold(
      floatingActionButton: FloatingActionButton(
          isExtended: true,
          child: const Icon(Icons.add),
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const AddDraftScreen(),
              ),
            );
          }),
      appBar: AppBar(
        title: Text(
          "Projects",
          style: headingTextStyle.copyWith(
            fontWeight: FontWeight.bold,
            fontSize: 24,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Chips for Completed and Drafts
                    _buildProjectTypeChips(),
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        "Categories",
                        style: headingTextStyle,
                      ),
                    ),
                    _buildCategoryFilterChips(),
                    const Padding(
                      padding: EdgeInsets.all(8.0),
                    ),
                    _buildSearchBar(),
                    Expanded(
                      // Conditionally render based on _showCompleted
                      child: _showCompleted
                          ? _buildProjectList() // Show completed projects
                          : _buildDraftProjectList(), // Show draft projects
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  // Toggle Chips for Completed and Drafts
  Widget _buildProjectTypeChips() {
    return Row(
      children: [
        ChoiceChip(
          label: Text(
            'Completed',
            style: bodyTextStyle,
          ),
          selected: _showCompleted,
          onSelected: (selected) {
            setState(() {
              _showCompleted = true;
              _searchQuery = '';
            });
          },
        ),
        const SizedBox(width: 8),
        ChoiceChip(
          label: Text(
            'Drafts',
            style: bodyTextStyle,
          ),
          selected: !_showCompleted,
          onSelected: (selected) {
            setState(() {
              _showCompleted = false;
              _searchQuery = '';
            });
          },
        ),
      ],
    );
  }

  // Category Filter Chips
  Widget _buildCategoryFilterChips() {
    return Wrap(
      spacing: 8.0,
      children: _projectCategory.map((category) {
        return ChoiceChip(
          label: Text(
            category.name,
            style: bodyTextStyle,
          ),
          selected: _selectedCategory == category.name,
          onSelected: (selected) {
            setState(() {
              _selectedCategory = selected ? category.name : '';
            });
          },
        );
      }).toList(),
    );
  }

  // Search Bar to filter projects by title
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
        onChanged: (query) async {
          ProjectRepository repo = ProjectRepository();
          var filteredProjects = await repo.getProjectsByQuery(query);
          setState(() {
            _projects = filteredProjects;
            _searchQuery = query;
          });
        },
      ),
    );
  }

  // List of Completed Projects (Filtered by Category and Search Query)
  Widget _buildProjectList() {
    // Fetch all projects from the repository (no filtering by date)
    List<Project> filteredProjects = _projects.where((project) {
      // Filter by category
      bool matchesCategory = _selectedCategory.isEmpty ||
          project.category.toLowerCase() == _selectedCategory.toLowerCase();

      // Filter by search query
      bool matchesSearchQuery = _searchQuery.isEmpty ||
          project.title.toLowerCase().contains(_searchQuery.toLowerCase());

      return matchesCategory && matchesSearchQuery;
    }).toList();

    return (filteredProjects.isNotEmpty)
        ? ListView.builder(
            itemCount: filteredProjects.length,
            itemBuilder: (context, index) {
              final project = filteredProjects[index];
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
                  margin: const EdgeInsets.symmetric(
                      vertical: 8.0, horizontal: 16.0),
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
                                project.thumbnail.isEmpty
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
                                    style:
                                        headingTextStyle.copyWith(fontSize: 15),
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
                            Container(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(color: Colors.grey[600]!),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(8.0),
                                child: Text(
                                  project.category,
                                  style:
                                      headingTextStyle.copyWith(fontSize: 11),
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
          )
        : Center(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.add_chart,
                    size: 32,
                  ),
                  Text(
                    "No published projects found. Click the add button to get started",
                    style: bodyTextStyle,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          );
  }

  // List of Draft Projects (Filtered by Category and Search Query)
  Widget _buildDraftProjectList() {
    // Fetch drafts from the repository
    List<Draft> draftProjects = _drafts;

    // Apply filters (category and search query)
    List<Draft> filteredDraftProjects = draftProjects.where((project) {
      // Filter by category
      bool matchesCategory = _selectedCategory.isEmpty ||
          project.category.toLowerCase() == _selectedCategory.toLowerCase();

      // Filter by search query
      bool matchesSearchQuery = _searchQuery.isEmpty ||
          project.title.toLowerCase().contains(_searchQuery.toLowerCase());

      return matchesCategory && matchesSearchQuery;
    }).toList();

    return (filteredDraftProjects.isNotEmpty)
        ? ListView.builder(
            itemCount: filteredDraftProjects.length,
            itemBuilder: (context, index) {
              final project = filteredDraftProjects[index];

              return GestureDetector(
                onTap: () {
                  Random random = Random();
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => EditDraftScreen(
                        backgroundColor: colors[random.nextInt(colors.length)],
                        draftId: project.id!,
                      ),
                    ),
                  );
                },
                child: Card(
                  color: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12.0),
                  ),
                  margin: const EdgeInsets.symmetric(
                      vertical: 8.0, horizontal: 16.0),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Stack(
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8.0),
                                  child: Image.network(
                                    "https://picsum.photos/200",
                                    width: 70.0,
                                    height: 70.0,
                                    fit: BoxFit.cover,
                                  ),
                                ),
                                const SizedBox(width: 16.0),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        project.title,
                                        style: headingTextStyle.copyWith(
                                            fontSize: 15),
                                      ),
                                      const SizedBox(height: 4.0),
                                      Text(
                                        project.description,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: bodyTextStyle.copyWith(
                                            fontSize: 14),
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
                                Container(
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(30),
                                    border:
                                        Border.all(color: Colors.grey[600]!),
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(8.0),
                                    child: Text(
                                      project.category,
                                      style: headingTextStyle.copyWith(
                                          fontSize: 11),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Positioned(
                          right: 0,
                          top: 0,
                          child: IconButton(
                            icon: const Icon(
                              Icons.delete_outlined,
                              color: Colors.red,
                            ),
                            onPressed: () {
                              _showDeleteConfirmationDialog(
                                  context, project.id!);
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          )
        : Center(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.add_chart,
                    size: 32,
                  ),
                  Text(
                    "No drafts saved. Click the add button to get started",
                    style: bodyTextStyle,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          );
  }

  void _showDeleteConfirmationDialog(BuildContext context, int draftId) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'Delete Draft',
          style: headingTextStyle.copyWith(fontSize: 18),
        ),
        content: Text(
          'Are you sure you want to delete this draft?',
          style: bodyTextStyle,
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            child: Text(
              'Cancel',
              style: bodyTextStyle.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          TextButton(
            onPressed: () {
              _deleteDraft(draftId);
              Navigator.of(context).pop();
            },
            child: Text(
              'Delete',
              style: bodyTextStyle.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  void _deleteDraft(int draftId) {
    // Call your DraftRepository to delete the draft
    DraftRepository().deleteDraft(draftId).then((_) {
      setState(() {
        _drafts.removeWhere((draft) => draft.id == draftId);
      });
    }).catchError((error) {
      // Handle any errors that occur during the delete operation
      print('Error deleting draft: $error');
    });
  }
}
