import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/ChildProfile.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/mentor/addChildScreen.dart';
import 'package:miniguru/screens/mentor/pinEntryScreen.dart';
import 'package:miniguru/state/sessionState.dart';

class MentorChildPickerScreen extends StatefulWidget {
  const MentorChildPickerScreen({super.key});
  static const String id = 'MentorChildPickerScreen';

  @override
  State<MentorChildPickerScreen> createState() => _MentorChildPickerScreenState();
}

class _MentorChildPickerScreenState extends State<MentorChildPickerScreen> {
  late MiniguruApi _api;
  List<ChildProfile> _children = [];
  bool _isLoading = true;
  String? _mentorName;

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    SessionState.clearChild();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.getMentorChildren(),
        _api.getUserData(),
      ]);
      if (!mounted) return;
      setState(() {
        _children = results[0] as List<ChildProfile>;
        final user = results[1] as User?;
        _mentorName = user?.name;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: pastelBlueText))
            : RefreshIndicator(
                onRefresh: _loadData,
                color: pastelBlueText,
                child: CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(child: _buildHeader()),
                    SliverToBoxAdapter(child: _buildSectionLabel('Switch to learner')),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      sliver: _children.isEmpty
                          ? SliverToBoxAdapter(child: _buildEmpty())
                          : SliverGrid(
                              delegate: SliverChildBuilderDelegate(
                                (context, index) {
                                  if (index == _children.length) return _buildAddCard();
                                  return _buildChildCard(_children[index]);
                                },
                                childCount: _children.length + 1,
                              ),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                crossAxisSpacing: 14,
                                mainAxisSpacing: 14,
                                childAspectRatio: 0.85,
                              ),
                            ),
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: 24)),
                    SliverToBoxAdapter(child: _buildMyAccountButton()),
                    const SliverToBoxAdapter(child: SizedBox(height: 32)),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF5B6EF5), Color(0xFF8B9FF8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.supervisor_account, color: Colors.white, size: 16),
                    const SizedBox(width: 6),
                    Text('Mentor',
                        style: GoogleFonts.nunito(
                            color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.refresh, color: Colors.white),
                onPressed: _loadData,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('${_greeting()},',
              style: GoogleFonts.nunito(
                  color: Colors.white.withOpacity(0.85), fontSize: 16)),
          Text(_mentorName ?? 'Mentor',
              style: GoogleFonts.nunito(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Text(
            _children.isEmpty
                ? 'No learners yet — add your first child below'
                : '${_children.length} learner${_children.length == 1 ? '' : 's'} registered',
            style: GoogleFonts.nunito(
                color: Colors.white.withOpacity(0.8), fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
      child: Text(label.toUpperCase(),
          style: GoogleFonts.nunito(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: Colors.grey[500],
              letterSpacing: 1.2)),
    );
  }

  Widget _buildChildCard(ChildProfile child) {
    final colors = [
      [const Color(0xFF5B6EF5), const Color(0xFF8B9FF8)],
      [const Color(0xFFE8A000), const Color(0xFFF5C842)],
      [const Color(0xFF2ECC71), const Color(0xFF55E89D)],
      [const Color(0xFFE74C3C), const Color(0xFFFF7675)],
      [const Color(0xFF9B59B6), const Color(0xFFBE85D4)],
    ];
    final idx = _children.indexOf(child) % colors.length;
    final gradient = LinearGradient(colors: colors[idx]);

    return GestureDetector(
      onTap: () async {
        final verified = await Navigator.push<bool>(
          context,
          MaterialPageRoute(
            builder: (_) => PinEntryScreen(child: child),
          ),
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
            // Avatar circle
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: gradient,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  child.name[0].toUpperCase(),
                  style: GoogleFonts.nunito(
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      color: Colors.white),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(child.name,
                style: GoogleFonts.nunito(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Colors.black87),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
            if (child.grade != null) ...[
              const SizedBox(height: 2),
              Text('Grade ${child.grade}',
                  style: GoogleFonts.nunito(
                      fontSize: 12, color: Colors.grey[500])),
            ],
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3CD),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('🪙', style: TextStyle(fontSize: 12)),
                  const SizedBox(width: 4),
                  Text('${child.score}',
                      style: GoogleFonts.nunito(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFFE8A000))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAddCard() {
    return GestureDetector(
      onTap: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const AddChildScreen()),
        );
        _loadData();
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.grey[200]!, width: 2),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 8,
                offset: const Offset(0, 2)),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFFF0F2FF),
                shape: BoxShape.circle,
                border: Border.all(
                    color: pastelBlueText.withOpacity(0.3), width: 2),
              ),
              child: const Icon(Icons.add, color: pastelBlueText, size: 32),
            ),
            const SizedBox(height: 12),
            Text('Add Child',
                style: GoogleFonts.nunito(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: pastelBlueText)),
            const SizedBox(height: 2),
            Text('Tap to register',
                style: GoogleFonts.nunito(fontSize: 11, color: Colors.grey[400])),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          const Text('👶', style: TextStyle(fontSize: 64)),
          const SizedBox(height: 16),
          Text('No learners yet',
              style: GoogleFonts.nunito(
                  fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black87)),
          const SizedBox(height: 8),
          Text('Add your first child to get started',
              style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey[500])),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () async {
              await Navigator.push(
                  context, MaterialPageRoute(builder: (_) => const AddChildScreen()));
              _loadData();
            },
            icon: const Icon(Icons.add),
            label: Text('Add Child',
                style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
            style: ElevatedButton.styleFrom(
              backgroundColor: pastelBlueText,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMyAccountButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: OutlinedButton.icon(
        onPressed: () {
          SessionState.clearChild();
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const HomeScreen()),
            (route) => false,
          );
        },
        icon: const Icon(Icons.person_outline, color: pastelBlueText),
        label: Text('Go to My Account',
            style: GoogleFonts.nunito(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: pastelBlueText)),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(double.infinity, 52),
          side: const BorderSide(color: pastelBlueText, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}
