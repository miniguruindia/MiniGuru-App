import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/repository/userDataRepository.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/walletPage.dart';

class Profile extends StatefulWidget {
  const Profile({super.key});
  static String id = "Profile";

  @override
  State<Profile> createState() => _ProfileState();
}

class _ProfileState extends State<Profile> with AutomaticKeepAliveClientMixin {
  final UserRepository _userRepository = UserRepository();
  User? _user;
  bool _isLoading = true;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _fetchUserData();
  }

  Future<void> _fetchUserData() async {
    setState(() => _isLoading = true);

    await _userRepository.fetchAndStoreUserData();
    final user = await _userRepository.getUserDataFromLocalDb();

    if (mounted) {
      setState(() {
        _user = user;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Logout', style: headingTextStyle),
        content: Text('Are you sure you want to logout?', style: bodyTextStyle),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel',
                style: bodyTextStyle.copyWith(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Logout',
                style: bodyTextStyle.copyWith(
                    color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      try {
        final db = DatabaseHelper();
        final api = MiniguruApi();

        await api.logout();
        await db.clearAllTables();

        if (mounted) {
          Navigator.of(context)
              .pushNamedAndRemoveUntil(LoginScreen.id, (route) => false);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Error logging out: $e'),
                backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Scaffold(
      backgroundColor: backgroundWhite,
      appBar: AppBar(
        title: Text('Profile', style: headingTextStyle.copyWith(fontSize: 24)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.black54),
            onPressed: _fetchUserData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: pastelBlueText))
          : RefreshIndicator(
              onRefresh: _fetchUserData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    // Profile Header
                    _buildProfileHeader(),
                    const SizedBox(height: 24),

                    // Wallet Section
                    _buildSectionTitle('Wallet'),
                    const SizedBox(height: 12),
                    _buildWalletCard(),
                    const SizedBox(height: 24),

                    // Settings Section
                    _buildSectionTitle('Settings'),
                    const SizedBox(height: 12),
                    _buildSettingsButtons(),
                    const SizedBox(height: 24),

                    // Logout Button
                    _buildLogoutButton(),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildProfileHeader() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            spreadRadius: 0,
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(50),
            child: Image.network(
              'https://picsum.photos/200',
              width: 100,
              height: 100,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => Container(
                width: 100,
                height: 100,
                color: pastelBlue,
                child:
                    const Icon(Icons.person, size: 50, color: pastelBlueText),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(_user?.name ?? 'User',
              style: headingTextStyle.copyWith(fontSize: 22)),
          const SizedBox(height: 6),
          Text(
            _user?.email ?? '',
            style:
                bodyTextStyle.copyWith(color: Colors.grey[600], fontSize: 14),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildStatBadge('${_user?.score ?? 0}', 'Score', pastelYellow),
              _buildStatBadge(
                  '${_user?.totalProjects ?? 0}', 'Projects', pastelGreen),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatBadge(String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            value,
            style:
                headingTextStyle.copyWith(fontSize: 18, color: Colors.black87),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style:
                bodyTextStyle.copyWith(fontSize: 12, color: Colors.grey[700]),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        title,
        style: headingTextStyle.copyWith(fontSize: 18, color: Colors.black87),
      ),
    );
  }

  Widget _buildWalletCard() {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          if (_user != null) {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => WalletPage(user: _user!)),
            );
          }
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [pastelBlue, Color(0xFFE3F2FD)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: pastelBlue.withOpacity(0.3),
                spreadRadius: 0,
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.account_balance_wallet,
                    color: pastelBlueText, size: 32),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Wallet Balance',
                        style: bodyTextStyle.copyWith(fontSize: 14)),
                    const SizedBox(height: 4),
                    Text(
                      '₹${_user?.walletBalance ?? 0}',
                      style: headingTextStyle.copyWith(fontSize: 24),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios,
                  color: pastelBlueText, size: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSettingsButtons() {
    return Column(
      children: [
        _buildSettingButton(
          'Privacy Policy',
          Icons.privacy_tip_outlined,
          () {
            // TODO: Implement privacy policy navigation
          },
        ),
        const SizedBox(height: 12),
        _buildSettingButton(
          'Terms and Conditions',
          Icons.description_outlined,
          () {
            // TODO: Implement terms navigation
          },
        ),
      ],
    );
  }

  Widget _buildSettingButton(String title, IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey[200]!),
          ),
          child: Row(
            children: [
              Icon(icon, color: Colors.grey[700], size: 24),
              const SizedBox(width: 16),
              Expanded(
                child: Text(title,
                    style: bodyTextStyle.copyWith(fontWeight: FontWeight.w500)),
              ),
              Icon(Icons.arrow_forward_ios, color: Colors.grey[400], size: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLogoutButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _handleLogout,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.red[50],
          foregroundColor: Colors.red[700],
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.logout, size: 20),
            const SizedBox(width: 8),
            Text('Logout',
                style: bodyTextStyle.copyWith(
                    color: Colors.red[700], fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}
