// lib/screens/navScreen/projects.dart
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/Draft.dart';
import 'package:miniguru/models/ProjectCategory.dart';
import 'package:miniguru/models/Projects.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/screens/addDraftScreen.dart';
import 'package:miniguru/repository/draftsRepository.dart';
import 'package:miniguru/repository/projectRepository.dart';
import 'package:miniguru/repository/userDataRepository.dart';
import 'package:miniguru/screens/projectDetailsScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';

class ProjectScreen extends StatefulWidget {
  const ProjectScreen({super.key});

  @override
  State<ProjectScreen> createState() => _ProjectScreenState();
}

class _ProjectScreenState extends State<ProjectScreen>
    with AutomaticKeepAliveClientMixin {

  List<Project>         _projects         = [];
  List<Project>         _allProjects      = [];
  List<ProjectCategory> _projectCategory  = [];
  List<Draft>           _drafts           = [];
  List<Draft>           _allDrafts        = [];

  bool   _loading         = true;
  bool   _showCompleted   = true;
  String _selectedCategory = '';
  bool   _isAuthenticated  = false;
  User?  user;

  final _searchController = TextEditingController();

  static const _colors     = [pastelBlue, pastelYellow, pastelRed, pastelGreen];

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

  // ── Data loading ──────────────────────────────────────────
  Future<void> _loadProjects() async {
    setState(() => _loading = true);
    try {
      final userRepo = UserRepository();
      await userRepo.fetchAndStoreUserData();
      final userData = await userRepo.getUserDataFromLocalDb();

      if (userData == null) {
        if (mounted) setState(() { user = null; _isAuthenticated = false; _loading = false; });
        return;
      }

      final repo = ProjectRepository();
      await Future.wait([
        repo.fetchAndStoreProjectsForUser(),
        repo.fetchAndStoreProjectCategory(),
        _loadDrafts(),
      ]);

      final projects   = await repo.getProjects();
      final categories = await repo.getProjectCategories();

      if (mounted) {
        setState(() {
          user             = userData;
          _isAuthenticated = true;
          _projectCategory = categories;
          _projects        = projects;
          _allProjects     = List.from(projects);
          _loading         = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        final isAuthIssue = e.toString().contains('null') ||
            e.toString().contains('token') ||
            e.toString().contains('Unauthorized');
        if (!isAuthIssue) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Error loading projects: $e'),
            backgroundColor: Colors.red,
          ));
        }
      }
    }
  }

  Future<void> _loadDrafts() async {
    final drafts = await DraftRepository().getDrafts();
    if (mounted) setState(() { _drafts = drafts; _allDrafts = List.from(drafts); });
  }

  void _applyFilters(String query) {
    setState(() {
      if (_showCompleted) {
        _projects = _allProjects.where((p) {
          final matchesCat   = _selectedCategory.isEmpty || p.category.toLowerCase() == _selectedCategory.toLowerCase();
          final matchesQuery = query.isEmpty || p.title.toLowerCase().contains(query.toLowerCase());
          return matchesCat && matchesQuery;
        }).toList();
      } else {
        _drafts = _allDrafts.where((d) {
          final matchesCat   = _selectedCategory.isEmpty || d.category.toLowerCase() == _selectedCategory.toLowerCase();
          final matchesQuery = query.isEmpty || d.title.toLowerCase().contains(query.toLowerCase());
          return matchesCat && matchesQuery;
        }).toList();
      }
    });
  }

  Future<void> _deleteDraft(int draftId) async {
    try {
      await DraftRepository().deleteDraft(draftId);
      setState(() {
        _drafts.removeWhere((d) => d.id == draftId);
        _allDrafts.removeWhere((d) => d.id == draftId);
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Draft deleted'), backgroundColor: Colors.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error deleting draft: $e'), backgroundColor: Colors.red));
    }
  }

  // ── BUILD ─────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (!_loading && !_isAuthenticated) return _buildLoginPrompt();

    return Scaffold(
      backgroundColor: backgroundWhite,
      floatingActionButton: _isAuthenticated ? FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(context, MaterialPageRoute(
            builder: (_) => const AddDraftScreen()));
          _loadDrafts();
        },
        icon: const Icon(Icons.add),
        label: Text('New Project', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
        backgroundColor: pastelBlueText,
      ) : null,
      appBar: AppBar(
        title: Text('My Projects', style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87)),
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
          ? const Center(child: CircularProgressIndicator(color: pastelBlueText))
          : SafeArea(child: Column(children: [
              _buildTypeChips(),
              Expanded(child: RefreshIndicator(
                onRefresh: _loadProjects,
                child: CustomScrollView(slivers: [
                  SliverToBoxAdapter(child: _buildCategories()),
                  SliverToBoxAdapter(child: _buildSearchBar()),
                  _showCompleted ? _buildProjectList() : _buildDraftList(),
                ]),
              )),
            ])),
    );
  }

  // ── Login prompt ──────────────────────────────────────────
  Widget _buildLoginPrompt() {
    return Scaffold(
      backgroundColor: backgroundWhite,
      body: SafeArea(child: Center(child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 100, height: 100,
            decoration: BoxDecoration(color: pastelBlue, borderRadius: BorderRadius.circular(28)),
            child: const Icon(Icons.work_outline, size: 52, color: pastelBlueText),
          ),
          const SizedBox(height: 24),
          Text('Your Projects', style: GoogleFonts.poppins(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black87)),
          const SizedBox(height: 12),
          Text('Login to create, manage, and share\nyour tinkering projects!',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(fontSize: 14, color: Colors.black54, height: 1.5)),
          const SizedBox(height: 32),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () => Navigator.pushNamed(context, LoginScreen.id),
            style: ElevatedButton.styleFrom(
              backgroundColor: pastelBlueText,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            child: Text('Login to Continue',
              style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
          )),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text("Don't have an account? ", style: GoogleFonts.poppins(fontSize: 13, color: Colors.black54)),
            GestureDetector(
              onTap: () => Navigator.pushNamed(context, LoginScreen.id),
              child: Text('Sign Up Free', style: GoogleFonts.poppins(fontSize: 13, color: pastelBlueText, fontWeight: FontWeight.w600)),
            ),
          ]),
        ]),
      ))),
    );
  }

  // ── Type chips ────────────────────────────────────────────
  Widget _buildTypeChips() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(children: [
        _chip('✅ Published', _showCompleted,   () => _switchTab(true)),
        const SizedBox(width: 8),
        _chip('📝 Drafts (${_allDrafts.length})', !_showCompleted, () => _switchTab(false)),
      ]),
    );
  }

  void _switchTab(bool completed) {
    setState(() { _showCompleted = completed; _selectedCategory = ''; _searchController.clear(); _applyFilters(''); });
  }

  Widget _chip(String label, bool selected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap, borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? pastelBlueText : Colors.grey[200],
          borderRadius: BorderRadius.circular(20)),
        child: Text(label, style: GoogleFonts.poppins(
          color: selected ? Colors.white : Colors.black87,
          fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          fontSize: 13)),
      ),
    );
  }

  // ── Category chips ────────────────────────────────────────
  Widget _buildCategories() {
    if (_projectCategory.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        child: Text('Categories', style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black87)),
      ),
      SizedBox(height: 48, child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _projectCategory.length,
        itemBuilder: (_, i) {
          final cat      = _projectCategory[i];
          final selected = _selectedCategory == cat.name;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: ChoiceChip(
              label: Text(cat.name, style: GoogleFonts.poppins(fontSize: 12)),
              selected: selected,
              onSelected: (v) { setState(() { _selectedCategory = v ? cat.name : ''; _applyFilters(_searchController.text); }); },
              selectedColor: _colors[i % _colors.length],
              backgroundColor: Colors.grey[200],
            ),
          );
        },
      )),
    ]);
  }

  // ── Search bar ────────────────────────────────────────────
  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: TextField(
        controller: _searchController,
        onChanged: _applyFilters,
        decoration: InputDecoration(
          hintText: 'Search ${_showCompleted ? 'projects' : 'drafts'}...',
          hintStyle: GoogleFonts.poppins(color: Colors.grey[400], fontSize: 13),
          prefixIcon: const Icon(Icons.search, color: Colors.grey, size: 20),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _searchController.clear(); _applyFilters(''); })
              : null,
          border:        OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey[300]!)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey[300]!)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: pastelBlueText)),
          filled: true, fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
        ),
      ),
    );
  }

  // ── Published project list ────────────────────────────────
  Widget _buildProjectList() {
    if (_projects.isEmpty) {
      return SliverFillRemaining(child: _emptyState(
        icon: Icons.work_outline,
        title: 'No published projects yet',
        subtitle: 'Tap + to create your first project',
      ));
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
      sliver: SliverList(delegate: SliverChildBuilderDelegate(
        (_, i) => _ProjectCard(
          project: _projects[i],
          color: _colors[i % _colors.length],
          onTap: user == null ? null : () => Navigator.push(context,
            MaterialPageRoute(builder: (_) => ProjectDetailsScreen(
              project: _projects[i], backgroundColor: _colors[i % _colors.length], user: user!))),
        ),
        childCount: _projects.length,
      )),
    );
  }

  // ── Draft list ────────────────────────────────────────────
  Widget _buildDraftList() {
    if (_drafts.isEmpty) {
      return SliverFillRemaining(child: _emptyState(
        icon: Icons.edit_note_rounded,
        title: 'No drafts saved',
        subtitle: 'Start a project and save it as a draft',
      ));
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
      sliver: SliverList(delegate: SliverChildBuilderDelegate(
        (_, i) => _DraftCard(
          draft: _drafts[i],
          color: _colors[i % _colors.length],
          onTap: () async {
            await Navigator.push(context, MaterialPageRoute(
              builder: (_) => AddDraftScreen(draftId: _drafts[i].id!)));
            _loadDrafts();
          },
          onDelete: () => _confirmDelete(_drafts[i]),
        ),
        childCount: _drafts.length,
      )),
    );
  }

  void _confirmDelete(Draft draft) {
    showDialog(context: context, builder: (_) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text('Delete Draft', style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 17)),
      content: Text('Delete "${draft.title}"? This cannot be undone.', style: GoogleFonts.poppins(fontSize: 14)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context),
          child: Text('Cancel', style: GoogleFonts.poppins(color: Colors.grey))),
        TextButton(
          onPressed: () { Navigator.pop(context); _deleteDraft(draft.id!); },
          child: Text('Delete', style: GoogleFonts.poppins(color: Colors.red, fontWeight: FontWeight.bold))),
      ],
    ));
  }

  Widget _emptyState({required IconData icon, required String title, required String subtitle}) {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(icon, size: 64, color: Colors.grey[300]),
      const SizedBox(height: 16),
      Text(title,   style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey[600])),
      const SizedBox(height: 6),
      Text(subtitle, style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[400])),
    ]));
  }
}

// ── Published Project Card ────────────────────────────────────
class _ProjectCard extends StatelessWidget {
  final Project     project;
  final Color       color;
  final VoidCallback? onTap;
  const _ProjectCard({required this.project, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2, shadowColor: color.withOpacity(0.4),
      child: InkWell(
        onTap: onTap, borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  project.thumbnail.isEmpty ? 'https://picsum.photos/200' : project.thumbnail,
                  width: 72, height: 72, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 72, height: 72, color: Colors.grey[300],
                    child: const Icon(Icons.image, size: 36)),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(project.title,
                  style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.black87),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text(project.description,
                  style: GoogleFonts.poppins(fontSize: 12, color: Colors.black54),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              ])),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                child: Text(project.category, style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w600)),
              ),
              const Spacer(),
              Text(project.author, style: GoogleFonts.poppins(fontSize: 11, color: Colors.black45)),
            ]),
          ]),
        ),
      ),
    );
  }
}

// ── Draft Card ────────────────────────────────────────────────
class _DraftCard extends StatelessWidget {
  final Draft        draft;
  final Color        color;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  const _DraftCard({required this.draft, required this.color, required this.onTap, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: InkWell(
        onTap: onTap, borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            // Draft icon
            Container(
              width: 60, height: 60,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.edit_note_rounded, size: 30, color: Colors.black54),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(draft.title,
                style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black87),
                maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 3),
              Text(draft.description,
                style: GoogleFonts.poppins(fontSize: 12, color: Colors.black54),
                maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 6),
              Row(children: [
                // Category chip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: pastelYellow, borderRadius: BorderRadius.circular(12)),
                  child: Text(draft.category, style: GoogleFonts.poppins(fontSize: 10, fontWeight: FontWeight.w600)),
                ),
                const SizedBox(width: 8),
                // Materials count
                if (draft.materials.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(12)),
                    child: Text('🧰 ${draft.materials.length} materials',
                      style: GoogleFonts.poppins(fontSize: 10, color: Colors.blue[700])),
                  ),
              ]),
            ])),
            // Actions
            Column(children: [
              IconButton(
                icon: const Icon(Icons.edit_rounded, color: pastelBlueText, size: 20),
                onPressed: onTap, tooltip: 'Edit draft',
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, color: Colors.red, size: 20),
                onPressed: onDelete, tooltip: 'Delete draft',
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}