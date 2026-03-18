import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/ChildProfile.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/mentor/mentorChildPickerScreen.dart';
import 'package:miniguru/screens/walletPage.dart';
import 'package:miniguru/state/sessionState.dart';

class MentorProfileTab extends StatefulWidget {
  const MentorProfileTab({super.key});

  @override
  State<MentorProfileTab> createState() => _MentorProfileTabState();
}

class _MentorProfileTabState extends State<MentorProfileTab> {
  late MiniguruApi _api;
  User? _mentor;
  List<ChildProfile> _children = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.getUserData(),
        _api.getMentorChildren(),
      ]);
      if (mounted) {
        setState(() {
          _mentor = results[0] as User?;
          _children = results[1] as List<ChildProfile>;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
    await _api.logout();
    SessionState.clearChild();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(child: CircularProgressIndicator(color: pastelBlueText)),
      );
    }

    return Scaffold(
      backgroundColor: backgroundWhite,
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: pastelBlueText,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              _buildHeader(),
              const SizedBox(height: 20),
              _buildTypeChip(),
              const SizedBox(height: 20),
              _buildWalletCard(),
              const SizedBox(height: 16),
              _buildFamilyGoins(),
              const SizedBox(height: 16),
              _buildChildrenSummary(),
              const SizedBox(height: 16),
              _buildActions(),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 56, 24, 28),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF5B6EF5), Color(0xFF8B9FF8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.25),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 3),
            ),
            child: Center(
              child: Text(
                (_mentor?.name ?? 'M')[0].toUpperCase(),
                style: GoogleFonts.nunito(
                    fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(_mentor?.name ?? '',
              style: GoogleFonts.nunito(
                  fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white)),
          const SizedBox(height: 4),
          Text(_mentor?.email ?? '',
              style: GoogleFonts.nunito(
                  fontSize: 13, color: Colors.white.withOpacity(0.8))),
          const SizedBox(height: 4),
          Text(_mentor?.phoneNumber ?? '',
              style: GoogleFonts.nunito(
                  fontSize: 13, color: Colors.white.withOpacity(0.8))),
        ],
      ),
    );
  }

  Widget _buildTypeChip() {
    final type = _mentor?.mentorType ?? 'PARENT';
    final label = type == 'SCHOOL'
        ? '🏫 School / T-LAB'
        : type == 'TLAB'
            ? '🔬 T-LAB'
            : type == 'COMMUNITY'
                ? '🌍 Community'
                : '👨‍👩‍👧 Parent / Guardian';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        color: pastelBlueText.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: pastelBlueText.withOpacity(0.3)),
      ),
      child: Text(label,
          style: GoogleFonts.nunito(
              fontSize: 14, fontWeight: FontWeight.w800, color: pastelBlueText)),
    );
  }

  Widget _buildWalletCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GestureDetector(
        onTap: () => Navigator.push(
            context, MaterialPageRoute(builder: (_) => WalletPage(user: _mentor!))),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [Color(0xFF6C47FF), Color(0xFF9B7BFF)]),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            children: [
              const Icon(Icons.account_balance_wallet, color: Colors.white, size: 28),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('My Wallet',
                      style: GoogleFonts.nunito(
                          fontSize: 13, color: Colors.white.withOpacity(0.8))),
                  Text('₹ ${_mentor?.walletBalance.toStringAsFixed(2) ?? '0.00'}',
                      style: GoogleFonts.nunito(
                          fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white)),
                ],
              ),
              const Spacer(),
              const Icon(Icons.chevron_right, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFamilyGoins() {
    if (_children.isEmpty) return const SizedBox.shrink();
    final totalGoins = _children.fold(0, (sum, c) => sum + c.score);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.05),
                blurRadius: 10, offset: const Offset(0, 4))
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('🪙', style: TextStyle(fontSize: 20)),
                const SizedBox(width: 8),
                Text('Family Goins',
                    style: GoogleFonts.nunito(
                        fontSize: 16, fontWeight: FontWeight.w900, color: Colors.black87)),
                const Spacer(),
                Text('Total: $totalGoins',
                    style: GoogleFonts.nunito(
                        fontSize: 14, fontWeight: FontWeight.w800,
                        color: Color(0xFFE8A000))),
              ],
            ),
            const SizedBox(height: 16),
            ..._children.map((child) {
              final maxGoins = _children.map((c) => c.score).reduce((a, b) => a > b ? a : b);
              final fraction = maxGoins == 0 ? 0.0 : child.score / maxGoins;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    SizedBox(
                      width: 80,
                      child: Text(child.name,
                          style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w700),
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: fraction,
                          backgroundColor: Colors.grey[200],
                          valueColor: const AlwaysStoppedAnimation(Color(0xFFE8A000)),
                          minHeight: 8,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text('${child.score}',
                        style: GoogleFonts.nunito(
                            fontSize: 13, fontWeight: FontWeight.w800,
                            color: Color(0xFFE8A000))),
                  ],
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildChildrenSummary() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.05),
                blurRadius: 10, offset: const Offset(0, 4))
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('My Learners (${_children.length})',
                style: GoogleFonts.nunito(
                    fontSize: 16, fontWeight: FontWeight.w900, color: Colors.black87)),
            const SizedBox(height: 12),
            if (_children.isEmpty)
              Text('No learners yet',
                  style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey[400]))
            else
              ..._children.map((child) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: pastelBlueText.withOpacity(0.15),
                          child: Text(child.name[0].toUpperCase(),
                              style: GoogleFonts.nunito(
                                  fontWeight: FontWeight.w900, color: pastelBlueText)),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(child.name,
                                style: GoogleFonts.nunito(
                                    fontSize: 14, fontWeight: FontWeight.w800)),
                            if (child.grade != null)
                              Text('Grade ${child.grade}',
                                  style: GoogleFonts.nunito(
                                      fontSize: 12, color: Colors.grey[500])),
                          ],
                        ),
                        const Spacer(),
                        Text('🪙 ${child.score}',
                            style: GoogleFonts.nunito(
                                fontSize: 13, fontWeight: FontWeight.w700,
                                color: Color(0xFFE8A000))),
                      ],
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _buildActions() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          _actionTile(
            icon: Icons.supervisor_account,
            label: 'Switch Learner',
            subtitle: 'Go to learner picker',
            color: pastelBlueText,
            onTap: () => Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const MentorChildPickerScreen()),
              (route) => false,
            ),
          ),
          const SizedBox(height: 10),
          _actionTile(
            icon: Icons.logout,
            label: 'Logout',
            subtitle: 'Sign out of your account',
            color: Colors.red,
            onTap: _logout,
          ),
        ],
      ),
    );
  }

  Widget _actionTile({
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04),
                blurRadius: 8, offset: const Offset(0, 2))
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: GoogleFonts.nunito(
                        fontSize: 15, fontWeight: FontWeight.w800, color: Colors.black87)),
                Text(subtitle,
                    style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[500])),
              ],
            ),
            const Spacer(),
            Icon(Icons.chevron_right, color: Colors.grey[400]),
          ],
        ),
      ),
    );
  }
}
