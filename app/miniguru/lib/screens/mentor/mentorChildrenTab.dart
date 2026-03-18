import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/ChildProfile.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/mentor/addChildScreen.dart';
import 'package:miniguru/screens/mentor/pinEntryScreen.dart';
import 'package:miniguru/screens/mentor/mentorChildPickerScreen.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/state/sessionState.dart';

class MentorChildrenTab extends StatefulWidget {
  const MentorChildrenTab({super.key});

  @override
  State<MentorChildrenTab> createState() => _MentorChildrenTabState();
}

class _MentorChildrenTabState extends State<MentorChildrenTab> {
  late MiniguruApi _api;
  List<ChildProfile> _children = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    _loadChildren();
  }

  Future<void> _loadChildren() async {
    setState(() => _isLoading = true);
    final children = await _api.getMentorChildren();
    if (mounted) setState(() { _children = children; _isLoading = false; });
  }

  final List<List<Color>> _gradients = [
    [Color(0xFF5B6EF5), Color(0xFF8B9FF8)],
    [Color(0xFFE8A000), Color(0xFFF5C842)],
    [Color(0xFF2ECC71), Color(0xFF55E89D)],
    [Color(0xFFE74C3C), Color(0xFFFF7675)],
    [Color(0xFF9B59B6), Color(0xFFBE85D4)],
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadChildren,
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
                    borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('My Learners',
                          style: GoogleFonts.nunito(
                              fontSize: 24, fontWeight: FontWeight.w900, color: Colors.white)),
                      const SizedBox(height: 4),
                      Text(
                        _children.isEmpty
                            ? 'No learners yet'
                            : '${_children.length} learner${_children.length == 1 ? '' : 's'} registered',
                        style: GoogleFonts.nunito(
                            fontSize: 14, color: Colors.white.withOpacity(0.85)),
                      ),
                    ],
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 20)),

              // Loading
              if (_isLoading)
                const SliverToBoxAdapter(
                  child: Center(child: CircularProgressIndicator(color: pastelBlueText)),
                )
              // Empty
              else if (_children.isEmpty)
                SliverToBoxAdapter(
                  child: Center(
                    child: Column(
                      children: [
                        const SizedBox(height: 40),
                        const Text('👶', style: TextStyle(fontSize: 64)),
                        const SizedBox(height: 16),
                        Text('No learners yet',
                            style: GoogleFonts.nunito(
                                fontSize: 18, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 8),
                        Text('Tap + to add your first child',
                            style: GoogleFonts.nunito(
                                fontSize: 14, color: Colors.grey[500])),
                      ],
                    ),
                  ),
                )
              // Grid
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _buildChildCard(_children[index], index),
                      childCount: _children.length,
                    ),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 0.82,
                    ),
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(
              context, MaterialPageRoute(builder: (_) => const AddChildScreen()));
          _loadChildren();
        },
        backgroundColor: pastelBlueText,
        icon: const Icon(Icons.person_add, color: Colors.white),
        label: Text('Add Child',
            style: GoogleFonts.nunito(
                color: Colors.white, fontWeight: FontWeight.w800)),
      ),
    );
  }

  Widget _buildChildCard(ChildProfile child, int index) {
    final colors = _gradients[index % _gradients.length];
    return GestureDetector(
      onTap: () async {
        final verified = await Navigator.push<bool>(
          context,
          MaterialPageRoute(builder: (_) => PinEntryScreen(child: child)),
        );
        if (verified == true && mounted) {
          SessionState.setChild(child.id, child.name, child.avatar);
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const HomeScreen()),
            (route) => false,
          );
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withOpacity(0.06),
                blurRadius: 12,
                offset: const Offset(0, 4)),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: colors),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(child.name[0].toUpperCase(),
                    style: GoogleFonts.nunito(
                        fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white)),
              ),
            ),
            const SizedBox(height: 10),
            Text(child.name,
                style: GoogleFonts.nunito(
                    fontSize: 15, fontWeight: FontWeight.w900, color: Colors.black87),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
            if (child.grade != null) ...[
              const SizedBox(height: 2),
              Text('Grade ${child.grade}',
                  style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[500])),
            ],
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3CD),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('🪙', style: TextStyle(fontSize: 11)),
                  const SizedBox(width: 4),
                  Text('${child.score}',
                      style: GoogleFonts.nunito(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFE8A000))),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text('Tap to switch →',
                style: GoogleFonts.nunito(
                    fontSize: 11, color: Colors.grey[400])),
          ],
        ),
      ),
    );
  }
}
