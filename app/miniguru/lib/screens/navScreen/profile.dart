// lib/screens/navScreen/profile.dart
// v4: badges below avatar · animated count-up · photo upload (base64/CSP-safe)

import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:miniguru/screens/legalScreen.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/repository/userDataRepository.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/walletPage.dart';

class Profile extends StatefulWidget {
  const Profile({super.key});
  static String id = 'Profile';
  @override
  State<Profile> createState() => _ProfileState();
}

class _ProfileState extends State<Profile>
    with AutomaticKeepAliveClientMixin, TickerProviderStateMixin {
  final UserRepository _userRepo = UserRepository();
  final MiniguruApi    _api      = MiniguruApi();

  User?      _user;
  bool       _isLoading        = true;
  Uint8List? _avatarBytes;
  bool       _isUploadingPhoto = false;

  Map<String, dynamic> _analytics      = {};
  bool                 _analyticsLoading = true;
  List<dynamic>        _badges          = [];
  bool                 _badgesLoading   = true;
  List<dynamic>        _notifications   = [];
  int                  _unreadCount     = 0;

  // One AnimationController per stat card (6 cards)
  late List<AnimationController> _countControllers;
  late List<Animation<double>>   _countAnims;
  static const _statCount = 6;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _countControllers = List.generate(
      _statCount,
      (_) => AnimationController(
          vsync: this, duration: const Duration(milliseconds: 1200)),
    );
    _countAnims = _countControllers
        .map((c) => CurvedAnimation(parent: c, curve: Curves.easeOut))
        .toList();
    _loadAll();
  }

  @override
  void dispose() {
    for (final c in _countControllers) c.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    setState(() {
      _isLoading = _analyticsLoading = _badgesLoading = true;
    });
    await Future.wait([
      _fetchUser(),
      _fetchAnalytics(),
      _fetchBadges(),
      _fetchNotifications(),
      _fetchPhoto(),
    ]);
  }

  Future<void> _fetchUser() async {
    try {
      await _userRepo.fetchAndStoreUserData();
      final u = await _userRepo.getUserDataFromLocalDb();
      if (mounted) setState(() { _user = u; _isLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchAnalytics() async {
    try {
      final data = await _api.getAnalytics();
      if (mounted) {
        setState(() { _analytics = data ?? {}; _analyticsLoading = false; });
        // Start count-up animations staggered
        for (int i = 0; i < _statCount; i++) {
          await Future.delayed(Duration(milliseconds: 80 * i));
          if (mounted) _countControllers[i].forward(from: 0);
        }
      }
    } catch (_) {
      if (mounted) setState(() => _analyticsLoading = false);
    }
  }

  Future<void> _fetchBadges() async {
    try {
      final data = await _api.getBadges();
      if (mounted) setState(() { _badges = data ?? []; _badgesLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _badgesLoading = false);
    }
  }

  Future<void> _fetchNotifications() async {
    try {
      final data = await _api.getNotifications();
      if (mounted) setState(() {
        _notifications = data ?? [];
        _unreadCount   = _notifications.length;
      });
    } catch (_) {}
  }

  Future<void> _fetchPhoto() async {
    try {
      final photo = await _api.getProfilePhoto();
      if (photo != null && mounted) {
        final b64 = photo.contains(',') ? photo.split(',')[1] : photo;
        setState(() => _avatarBytes = base64Decode(b64));
      }
    } catch (_) {}
  }

  // ── Photo upload (base64 — CSP-safe, no blob URLs) ────────────────────────
  Future<void> _pickAndUploadPhoto() async {
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 400, maxHeight: 400, imageQuality: 75,
      );
      if (picked == null) return;
      setState(() => _isUploadingPhoto = true);
      final bytes  = await picked.readAsBytes();
      final b64str = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      final ok = await _api.uploadProfilePhoto(b64str);
      if (mounted) {
        setState(() { _avatarBytes = bytes; _isUploadingPhoto = false; });
        _snack(ok ? '✅ Photo updated!' : '❌ Upload failed',
               ok ? const Color(0xFF10B981) : const Color(0xFFEF4444));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
        _snack('Error: $e', const Color(0xFFEF4444));
      }
    }
  }

  // ── Notifications sheet ───────────────────────────────────────────────────
  void _showNotifications() {
    setState(() => _unreadCount = 0);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.6, maxChildSize: 0.9, minChildSize: 0.3,
        builder: (_, ctrl) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(children: [
            const SizedBox(height: 12),
            Container(width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.black12,
                    borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(children: [
                Text('🔔 Notifications',
                    style: GoogleFonts.nunito(
                        fontSize: 18, fontWeight: FontWeight.w800)),
                const Spacer(),
                if (_notifications.isNotEmpty)
                  Text('${_notifications.length} new',
                      style: GoogleFonts.nunito(
                          fontSize: 12, color: const Color(0xFF5B6EF5),
                          fontWeight: FontWeight.w700)),
              ]),
            ),
            const SizedBox(height: 8),
            const Divider(height: 1),
            Expanded(
              child: _notifications.isEmpty
                  ? Center(child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text('🔕', style: TextStyle(fontSize: 40)),
                        const SizedBox(height: 12),
                        Text('No notifications yet',
                            style: GoogleFonts.nunito(
                                color: Colors.black45, fontSize: 14)),
                      ]))
                  : ListView.separated(
                      controller: ctrl,
                      padding: const EdgeInsets.all(16),
                      itemCount: _notifications.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final n = _notifications[i];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            backgroundColor: n['type'] == 'like'
                                ? const Color(0xFFFFF3CC)
                                : const Color(0xFFEEF0FF),
                            child: Text(n['emoji'] ?? '🔔',
                                style: const TextStyle(fontSize: 18)),
                          ),
                          title: Text(n['message'] ?? '',
                              style: GoogleFonts.nunito(
                                  fontSize: 13, fontWeight: FontWeight.w600)),
                          subtitle: Text(_formatAgo(n['createdAt']),
                              style: GoogleFonts.nunito(
                                  fontSize: 11, color: Colors.black45)),
                        );
                      }),
            ),
          ]),
        ),
      ),
    );
  }

  // ── Change password ───────────────────────────────────────────────────────
  Future<void> _changePassword() async {
    final curCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final conCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool changing = false;
    bool oCur = true, oNew = true, oCon = true;

    await showDialog(
      context: context,
      builder: (dlg) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20)),
          title: Text('Change Password',
              style: GoogleFonts.nunito(
                  fontSize: 18, fontWeight: FontWeight.w800)),
          content: Form(
            key: formKey,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _pwField('Current', curCtrl, oCur,
                  (v) => setDlg(() => oCur = !v),
                  (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 10),
              _pwField('New Password', newCtrl, oNew,
                  (v) => setDlg(() => oNew = !v),
                  (v) => (v?.length ?? 0) < 6 ? 'Min 6 chars' : null),
              const SizedBox(height: 10),
              _pwField('Confirm', conCtrl, oCon,
                  (v) => setDlg(() => oCon = !v),
                  (v) => v != newCtrl.text ? 'No match' : null),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dlg),
                child: Text('Cancel', style: GoogleFonts.nunito())),
            ElevatedButton(
              onPressed: changing ? null : () async {
                if (!formKey.currentState!.validate()) return;
                setDlg(() => changing = true);
                try {
                  final r = await _api.changePassword(
                      curCtrl.text, newCtrl.text);
                  if (dlg.mounted) Navigator.pop(dlg);
                  if (r.statusCode == 200) {
                    _snack('Password changed!', const Color(0xFF10B981));
                    await Future.delayed(const Duration(seconds: 2));
                    if (mounted) _logout();
                  } else {
                    final err = jsonDecode(r.body);
                    _snack(err['message'] ?? 'Failed',
                        const Color(0xFFEF4444));
                  }
                } catch (e) {
                  if (dlg.mounted) Navigator.pop(dlg);
                  _snack('Error: $e', const Color(0xFFEF4444));
                }
              },
              child: changing
                  ? const SizedBox(width: 16, height: 16,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Text('Change',
                      style: GoogleFonts.nunito(
                          color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
    curCtrl.dispose(); newCtrl.dispose(); conCtrl.dispose();
  }

  Widget _pwField(String label, TextEditingController ctrl, bool obscure,
      void Function(bool) onToggle, String? Function(String?) validator) {
    return TextFormField(
      controller: ctrl, obscureText: obscure,
      style: GoogleFonts.nunito(fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        suffixIcon: IconButton(
          icon: Icon(obscure ? Icons.visibility_off : Icons.visibility, size: 18),
          onPressed: () => onToggle(!obscure),
        ),
      ),
      validator: validator,
    );
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Logout',
            style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
        content: Text('Are you sure?', style: GoogleFonts.nunito()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false),
              child: Text('Cancel', style: GoogleFonts.nunito())),
          TextButton(onPressed: () => Navigator.pop(context, true),
              child: Text('Logout',
                  style: GoogleFonts.nunito(
                      color: const Color(0xFFEF4444),
                      fontWeight: FontWeight.bold))),
        ],
      ),
    );
    if (ok == true && mounted) {
      try {
        await _api.logout();
        await DatabaseHelper().clearAllTables();
        if (mounted) Navigator.of(context)
            .pushNamedAndRemoveUntil(LoginScreen.id, (r) => false);
      } catch (e) {
        _snack('Error: $e', const Color(0xFFEF4444));
      }
    }
  }

  void _snack(String msg, Color color) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: GoogleFonts.nunito(color: Colors.white)),
      backgroundColor: color,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  String _formatAgo(String? ts) {
    if (ts == null) return '';
    try {
      final d = DateTime.parse(ts);
      final diff = DateTime.now().difference(d);
      if (diff.inDays > 30) return '${(diff.inDays / 30).floor()}mo ago';
      if (diff.inDays > 0)  return '${diff.inDays}d ago';
      if (diff.inHours > 0) return '${diff.inHours}h ago';
      return '${diff.inMinutes}m ago';
    } catch (_) { return ''; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BUILD
  // ─────────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FF),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(
              color: Color(0xFF5B6EF5)))
          : RefreshIndicator(
              onRefresh: _loadAll,
              color: const Color(0xFF5B6EF5),
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics()),
                slivers: [
                  _buildHeader(),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        // ── Badges (right below avatar, before wallet) ──
                        const SizedBox(height: 20),
                        _label('🏅 Badges'),
                        const SizedBox(height: 10),
                        _buildBadges(),

                        // ── Wallet + Goins ──
                        const SizedBox(height: 24),
                        _label('💰 Wallet & Goins'),
                        const SizedBox(height: 10),
                        _buildWalletGoinsRow(),

                        // ── Analytics with count-up ──
                        const SizedBox(height: 24),
                        _label('📊 Your Activity'),
                        const SizedBox(height: 10),
                        _buildAnalyticsGrid(),

                        // ── Account ──
                        const SizedBox(height: 24),
                        _label('⚙️ Account'),
                        const SizedBox(height: 10),
                        _tile(Icons.lock_reset, 'Change Password',
                            const Color(0xFF5B6EF5), _changePassword),
                        const SizedBox(height: 8),
                        _tile(Icons.privacy_tip_outlined, 'Privacy Policy',
                            const Color(0xFF60A5FA),
                            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LegalScreen(initialTab: 0)))),
                        const SizedBox(height: 8),
                        _tile(Icons.description_outlined, 'Terms & Conditions',
                            const Color(0xFF60A5FA),
                            () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LegalScreen(initialTab: 1)))),

                        const SizedBox(height: 24),
                        _buildLogoutBtn(),
                      ]),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────
  SliverAppBar _buildHeader() {
    final name     = _user?.name ?? 'Maker';
    final email    = _user?.email ?? '';
    final initials = name.isNotEmpty ? name[0].toUpperCase() : 'M';

    return SliverAppBar(
      expandedHeight: 230,
      pinned: true,
      backgroundColor: const Color(0xFF5B6EF5),
      elevation: 0,
      actions: [
        Stack(children: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: Colors.white),
            onPressed: _showNotifications,
          ),
          if (_unreadCount > 0)
            Positioned(
              right: 8, top: 8,
              child: Container(
                width: 16, height: 16,
                decoration: const BoxDecoration(
                    color: Color(0xFFEF4444), shape: BoxShape.circle),
                child: Center(child: Text('$_unreadCount',
                    style: GoogleFonts.nunito(
                        fontSize: 9, color: Colors.white,
                        fontWeight: FontWeight.w800))),
              ),
            ),
        ]),
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: Colors.white),
          onPressed: _loadAll,
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF5B6EF5), Color(0xFF8B5CF6)],
            ),
          ),
          child: SafeArea(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(height: 36),
                Stack(children: [
                  GestureDetector(
                    onTap: _pickAndUploadPhoto,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: Colors.white.withOpacity(0.8), width: 3)),
                      child: CircleAvatar(
                        radius: 48,
                        backgroundColor: Colors.white.withOpacity(0.2),
                        backgroundImage: _avatarBytes != null
                            ? MemoryImage(_avatarBytes!) : null,
                        child: _avatarBytes == null
                            ? Text(initials,
                                style: GoogleFonts.nunito(
                                    fontSize: 38,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white))
                            : null,
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 0, right: 0,
                    child: GestureDetector(
                      onTap: _pickAndUploadPhoto,
                      child: Container(
                        width: 30, height: 30,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE8A000),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2)),
                        child: _isUploadingPhoto
                            ? const Padding(padding: EdgeInsets.all(6),
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2))
                            : const Icon(Icons.camera_alt,
                                color: Colors.white, size: 14),
                      ),
                    ),
                  ),
                ]),
                const SizedBox(height: 10),
                Text(name,
                    style: GoogleFonts.nunito(
                        fontSize: 20, fontWeight: FontWeight.w900,
                        color: Colors.white)),
                const SizedBox(height: 2),
                Text(email,
                    style: GoogleFonts.nunito(
                        fontSize: 12,
                        color: Colors.white.withOpacity(0.8))),
                if (_user?.age != null) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20)),
                    child: Text('Age ${_user!.age}',
                        style: GoogleFonts.nunito(
                            fontSize: 11, color: Colors.white,
                            fontWeight: FontWeight.w600)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Badges — colourful horizontal scroll ──────────────────────────────────
  Widget _buildBadges() {
    if (_badgesLoading) {
      return const Center(child: Padding(
          padding: EdgeInsets.all(12),
          child: CircularProgressIndicator(color: Color(0xFF5B6EF5))));
    }

    // Badge colours by category
    final catColors = {
      'projects': [const Color(0xFF3B82F6), const Color(0xFFEFF6FF)],
      'goins':    [const Color(0xFFE8A000), const Color(0xFFFFFBEB)],
      'learning': [const Color(0xFF10B981), const Color(0xFFF0FDF4)],
      'social':   [const Color(0xFFEC4899), const Color(0xFFFFF1F2)],
    };

    // Sort: earned first
    final sorted = [..._badges]..sort((a, b) {
        final ae = a['earned'] == true ? 0 : 1;
        final be = b['earned'] == true ? 0 : 1;
        return ae.compareTo(be);
      });

    if (sorted.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE8EAFF))),
        child: Center(child: Text('Complete projects to earn badges! 🏅',
            style: GoogleFonts.nunito(
                color: Colors.black45, fontSize: 13))));
    }

    return SizedBox(
      height: 120,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: sorted.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final b        = sorted[i];
          final isEarned = b['earned'] == true;
          final cat      = b['category'] as String? ?? 'projects';
          final colors   = catColors[cat] ??
              [const Color(0xFF5B6EF5), const Color(0xFFEEF0FF)];
          final accent   = colors[0];
          final bg       = colors[1];

          return Tooltip(
            message: b['desc'] ?? '',
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: 88,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isEarned ? bg : const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isEarned
                      ? accent.withOpacity(0.4)
                      : const Color(0xFFE8EAFF),
                  width: isEarned ? 2 : 1,
                ),
                boxShadow: isEarned
                    ? [BoxShadow(
                        color: accent.withOpacity(0.15),
                        blurRadius: 8, offset: const Offset(0, 3))]
                    : [],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Emoji with glow for earned
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: isEarned
                          ? accent.withOpacity(0.15)
                          : Colors.grey.withOpacity(0.08),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        b['emoji'] ?? '🏅',
                        style: TextStyle(
                          fontSize: 22,
                          color: isEarned ? null : Colors.grey.shade400,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(b['name'] ?? '',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.nunito(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: isEarned ? accent : Colors.grey.shade400,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Wallet + Goins row ────────────────────────────────────────────────────
  Widget _buildWalletGoinsRow() {
    final walletBalance =
        _user?.walletBalance?.toStringAsFixed(2) ?? '0.00';
    final goinsScore = _analytics['score'] ?? _user?.score ?? 0;

    return Row(children: [
      Expanded(
        child: GestureDetector(
          onTap: () {
            if (_user != null) Navigator.push(context,
                MaterialPageRoute(builder: (_) => WalletPage(user: _user!)));
          },
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
                begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [BoxShadow(
                  color: const Color(0xFF667EEA).withOpacity(0.3),
                  blurRadius: 12, offset: const Offset(0, 4))],
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                children: [
              Row(children: [
                const Icon(Icons.account_balance_wallet,
                    color: Colors.white, size: 16),
                const SizedBox(width: 6),
                Text('Wallet', style: GoogleFonts.nunito(
                    color: Colors.white70, fontSize: 12,
                    fontWeight: FontWeight.w600)),
              ]),
              const SizedBox(height: 8),
              Text('₹$walletBalance',
                  style: GoogleFonts.nunito(
                      fontSize: 22, fontWeight: FontWeight.w900,
                      color: Colors.white)),
              const SizedBox(height: 2),
              Text('Real money · Razorpay',
                  style: GoogleFonts.nunito(
                      color: Colors.white54, fontSize: 10)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20)),
                child: Text('View history →',
                    style: GoogleFonts.nunito(
                        color: Colors.white, fontSize: 10,
                        fontWeight: FontWeight.w700)),
              ),
            ]),
          ),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFFFD60A), Color(0xFFE8A000)],
              begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(
                color: const Color(0xFFE8A000).withOpacity(0.35),
                blurRadius: 12, offset: const Offset(0, 4))],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start,
              children: [
            Row(children: [
              const Text('🪙', style: TextStyle(fontSize: 14)),
              const SizedBox(width: 6),
              Text('Goins', style: GoogleFonts.nunito(
                  color: const Color(0xFF5A3800), fontSize: 12,
                  fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 8),
            Text('$goinsScore G',
                style: GoogleFonts.nunito(
                    fontSize: 22, fontWeight: FontWeight.w900,
                    color: const Color(0xFF3A2400))),
            const SizedBox(height: 2),
            Text('Virtual · Earn by building',
                style: GoogleFonts.nunito(
                    color: const Color(0xFF5A3800).withOpacity(0.7),
                    fontSize: 10)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.35),
                borderRadius: BorderRadius.circular(20)),
              child: Text('Earn more →',
                  style: GoogleFonts.nunito(
                      color: const Color(0xFF3A2400), fontSize: 10,
                      fontWeight: FontWeight.w700)),
            ),
          ]),
        ),
      ),
    ]);
  }

  // ── Analytics with animated count-up ─────────────────────────────────────
  Widget _buildAnalyticsGrid() {
    if (_analyticsLoading) {
      return const Center(child: Padding(
          padding: EdgeInsets.all(20),
          child: CircularProgressIndicator(color: Color(0xFF5B6EF5))));
    }

    final values = [
      _analytics['videosWatched']     ?? 0,
      _analytics['ongoingProjects']   ?? 0,
      _analytics['completedProjects'] ?? 0,
      _analytics['likesReceived']     ?? 0,
      _analytics['commentsReceived']  ?? 0,
      _analytics['totalProjects']     ?? _user?.totalProjects ?? 0,
    ];

    final stats = [
      _StatDef('Videos\nWatched',    '🎬', const Color(0xFF60A5FA), const Color(0xFFEFF6FF)),
      _StatDef('Ongoing\nProjects',  '🔧', const Color(0xFF5B6EF5), const Color(0xFFEEF0FF)),
      _StatDef('Completed\nBuilds',  '✅', const Color(0xFF10B981), const Color(0xFFF0FDF4)),
      _StatDef('Likes\nReceived',    '⭐', const Color(0xFFE8A000), const Color(0xFFFFFBEB)),
      _StatDef('Comments\nReceived', '💬', const Color(0xFFEC4899), const Color(0xFFFFF1F2)),
      _StatDef('Total\nProjects',    '🏗️', const Color(0xFF8B5CF6), const Color(0xFFF5F3FF)),
    ];

    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 0.95,
      children: List.generate(stats.length, (i) {
        final s      = stats[i];
        final target = (values[i] as num).toDouble();
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          decoration: BoxDecoration(
            color: s.bg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: s.color.withOpacity(0.2)),
            boxShadow: [BoxShadow(
                color: s.color.withOpacity(0.08),
                blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(s.emoji, style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 6),
            // Animated count-up
            AnimatedBuilder(
              animation: _countAnims[i],
              builder: (_, __) {
                final displayed =
                    (_countAnims[i].value * target).round();
                return Text('$displayed',
                    style: GoogleFonts.nunito(
                        fontSize: 22, fontWeight: FontWeight.w900,
                        color: s.color));
              },
            ),
            Text(s.label,
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(
                    fontSize: 9, fontWeight: FontWeight.w600,
                    color: s.color.withOpacity(0.8), height: 1.3)),
          ]),
        );
      }),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  Widget _label(String text) => Text(text,
      style: GoogleFonts.nunito(
          fontSize: 15, fontWeight: FontWeight.w800, color: Colors.black87));

  Widget _tile(IconData icon, String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE8EAFF)),
          boxShadow: [BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 20)),
          const SizedBox(width: 14),
          Expanded(child: Text(label,
              style: GoogleFonts.nunito(
                  fontSize: 14, fontWeight: FontWeight.w600,
                  color: Colors.black87))),
          const Icon(Icons.arrow_forward_ios_rounded,
              color: Colors.black26, size: 14),
        ]),
      ),
    );
  }

  Widget _buildLogoutBtn() => SizedBox(
    width: double.infinity,
    child: ElevatedButton.icon(
      onPressed: _logout,
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFFFEE2E2),
        foregroundColor: const Color(0xFFEF4444),
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14))),
      icon: const Icon(Icons.logout_rounded, size: 18),
      label: Text('Logout',
          style: GoogleFonts.nunito(
              fontWeight: FontWeight.w700, fontSize: 15,
              color: const Color(0xFFEF4444))),
    ),
  );
}

class _StatDef {
  final String label, emoji;
  final Color  color, bg;
  const _StatDef(this.label, this.emoji, this.color, this.bg);
}