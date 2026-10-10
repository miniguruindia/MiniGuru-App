// lib/screens/homeScreen.dart
import 'package:flutter/material.dart';
import 'package:miniguru/screens/navScreen/home.dart';
import 'package:miniguru/screens/navScreen/library.dart';
import 'package:miniguru/screens/navScreen/consultancy.dart';
import 'package:miniguru/screens/navScreen/profile.dart';
import 'package:miniguru/screens/navScreen/projects.dart';
import 'package:miniguru/screens/navScreen/shop.dart';
import 'package:miniguru/screens/navScreen/community_screen.dart';
import 'package:miniguru/screens/about.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/state/sessionState.dart';
import 'package:miniguru/screens/mentor/mentorChildPickerScreen.dart';
import 'package:miniguru/screens/mentor/mentorProfileTab.dart';
import 'package:miniguru/screens/mentor/mentorActivityTab.dart';
import 'package:miniguru/models/User.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/widgets/navShell.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  static const String id = 'HomeScreen';

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  final _miniguruApi = MiniguruApi();
  User? _user;
  bool _isAuthenticated = false;
  bool _authChecked = false;

  final Map<int, Widget> _cachedScreens = {};

  @override
  void initState() {
    super.initState();
    NavShell.index.addListener(_onShellIndex);
    WidgetsBinding.instance.addPostFrameCallback((_) => NavShell.visible.value = true);
    _checkAuth();
  }

  void _onShellIndex() {
    final i = NavShell.index.value;
    if (mounted && i != _currentIndex) setState(() => _currentIndex = i);
  }

  @override
  void dispose() {
    NavShell.index.removeListener(_onShellIndex);
    WidgetsBinding.instance.addPostFrameCallback((_) => NavShell.visible.value = false);
    super.dispose();
  }

  Future<void> _checkAuth() async {
    print('🔵 [HomeScreen] Checking authentication...');
    
    // If we are in a child session, just mark authenticated — don't overwrite with mentor data
    if (SessionState.isChildSession) {
      print('✅ [HomeScreen] Child session detected, marking as authenticated');
      setState(() { _isAuthenticated = true; _authChecked = true; });
      return;
    }
    try {
      print('🔵 [HomeScreen] Calling getUserData()...');
      final userData = await _miniguruApi.getUserData();
      if (mounted) {
        if (userData != null) {
          print('✅ [HomeScreen] User authenticated: ${userData.name}');
        } else {
          print('❌ [HomeScreen] No user data received');
        }
        setState(() {
          _user = userData;
          _isAuthenticated = userData != null;
          _authChecked = true;
          // Clear cached screens that depend on auth state
          _cachedScreens.remove(1);
          _cachedScreens.remove(3);
          _cachedScreens.remove(4);
          // Mentors/parents/schools land on "Children's Activity" (now the
          // merged Learners+Activity tab) right after login, instead of the
          // old separate MentorChildPickerScreen landing page. Only applies
          // on this first auth check (fresh HomeScreen instance right after
          // login) — doesn't override manual tab taps afterward.
          if (userData?.isMentor == true && !SessionState.isChildSession) {
            _currentIndex = 3;
          }
        });
      }
    } catch (e) {
      print('❌ [HomeScreen] Auth check failed: $e');
      if (mounted) {
        setState(() {
          _user = null;
          _isAuthenticated = false;
          _authChecked = true;
        });
      }
    }
  }

  Widget _getScreen(int index) {
    // Home is always fresh
    if (index == 0) return const Home();

    // Profile (logged in) or About (guest)
    if (index == 4) {
      if (_user?.isMentor == true && !SessionState.isChildSession) return const MentorProfileTab();
      if (SessionState.isChildSession || (_isAuthenticated && _user != null)) {
        if (!_cachedScreens.containsKey(index)) {
          _cachedScreens[index] = const Profile();
        }
        return _cachedScreens[index]!;
      }
      return const AboutScreen();
    }

    if (!_cachedScreens.containsKey(index)) {
      switch (index) {
        case 1:
          // "Learners" used to live here as its own tab (MentorChildrenTab).
          // That picker (child cards, PIN entry, Add Learner, Bulk Add) was
          // merged into the top of "Children's Activity" (index 3) instead,
          // so this slot is free for mentors/parents/schools — reuse the
          // same Consultancy page shown to guests, matching what a
          // logged-out visitor sees.
          if (_user?.isMentor == true && !SessionState.isChildSession) {
            _cachedScreens[index] = const ConsultancyPage();
            break;
          }
          _cachedScreens[index] = _isAuthenticated ? const CommunityScreen() : const ConsultancyPage();
          break;
        case 2:
          _cachedScreens[index] = const Shop();
          break;
        case 3:
          if (_user?.isMentor == true && !SessionState.isChildSession) {
            _cachedScreens[index] = const MentorActivityTab();
            break;
          }
          _cachedScreens[index] = _isAuthenticated ? const ProjectScreen() : const CommunityScreen();
          break;
      }
    }
    return _cachedScreens[index]!;
  }

  void _onNavBarTap(int index) {
    if (_currentIndex != index) {
      setState(() => _currentIndex = index);
    }
    NavShell.index.value = index;
  }

  PreferredSizeWidget? _buildTopBar() {
    if (SessionState.isChildSession) {
      return PreferredSize(
        preferredSize: const Size.fromHeight(36),
        child: Container(
          color: const Color(0xFF5B6EF5),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.child_care, color: Colors.white, size: 16),
              const SizedBox(width: 6),
              Text('Viewing as ${SessionState.activeChildName}',
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
              const SizedBox(width: 16),
              GestureDetector(
                onTap: () {
                  SessionState.clearChild();
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const MentorChildPickerScreen()),
                    (route) => false,
                  );
                },
                child: const Text('Switch', style: TextStyle(color: Colors.white, fontSize: 12, decoration: TextDecoration.underline)),
              ),
            ],
          ),
        ),
      );
    }
    // Always-visible "My Account" shortcut for mentors/teachers — previously
    // only reachable via the last (right-most) bottom-nav icon.
    if (_user?.isMentor == true) {
      return PreferredSize(
        preferredSize: const Size.fromHeight(40),
        child: SafeArea(
          bottom: false,
          child: Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            height: 40,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                InkWell(
                  onTap: () => _onNavBarTap(4),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.supervisor_account, size: 18, color: Color(0xFF3B82F6)),
                        SizedBox(width: 6),
                        Text('My Account',
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF3B82F6))),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return null;
  }

  bool get _isMentorView => _user?.isMentor == true && !SessionState.isChildSession;

  // Same five destinations for the bottom bar (phone/tablet) and the left
  // rail (laptop), so the two can never drift apart.
  // MiniGuru logo for the guest "About" tab (instead of the (i) icon).
  Widget _logoIcon(double opacity) => Opacity(
        opacity: opacity,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: Image.asset('assets/MGlogo.png',
              width: 24,
              height: 24,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const Icon(Icons.info_outline)),
        ),
      );

  List<BottomNavigationBarItem> _navItems() {
    return [
      const BottomNavigationBarItem(
        icon: Icon(Icons.home_outlined),
        activeIcon: Icon(Icons.home),
        label: 'Home',
      ),
      BottomNavigationBarItem(
        // Mentors/parents/schools see the same Consultancy tab a guest sees
        // here — "Learners" moved into Children's Activity.
        icon: Icon(_isMentorView ? Icons.support_agent_outlined : _isAuthenticated ? Icons.library_books_outlined : Icons.support_agent_outlined),
        activeIcon: Icon(_isMentorView ? Icons.support_agent : _isAuthenticated ? Icons.library_books : Icons.support_agent),
        label: _isMentorView ? 'Consult' : _isAuthenticated ? 'Community' : 'Consult',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.shopping_bag_outlined),
        activeIcon: Icon(Icons.shopping_bag),
        label: 'Shop',
      ),
      BottomNavigationBarItem(
        icon: Icon(_isAuthenticated ? Icons.work_outline : Icons.people_outline),
        activeIcon: Icon(_isAuthenticated ? Icons.work : Icons.people),
        label: _isMentorView
            ? "Children's Activity"
            : _isAuthenticated ? 'Projects' : 'Community',
      ),
      BottomNavigationBarItem(
        icon: (!_isMentorView && !_isAuthenticated)
            ? _logoIcon(0.65)
            : Icon(_isMentorView ? Icons.supervisor_account_outlined : _isAuthenticated ? Icons.person_outline : Icons.info_outline),
        activeIcon: (!_isMentorView && !_isAuthenticated)
            ? _logoIcon(1.0)
            : Icon(_isMentorView ? Icons.supervisor_account : _isAuthenticated ? Icons.person : Icons.info),
        label: _isMentorView ? 'My Account' : _isAuthenticated ? 'Profile' : 'About',
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (!_authChecked) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF3B82F6)),
        ),
      );
    }

    final width = MediaQuery.of(context).size.width;
    final wide = width >= 1000;      // laptop: the left bar + centred strip come from NavShellFrame (main.dart)
    final medium = width >= 600;     // tablet: centred column here, bottom bar stays
    final items = _navItems();

    // Tell the shared left bar what the tabs are and which one is open.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      NavShell.items.value = items;
      if (NavShell.index.value != _currentIndex) NavShell.index.value = _currentIndex;
    });

    Widget body = IndexedStack(
      index: _currentIndex,
      children: [
        _getScreen(0),
        _getScreen(1),
        _getScreen(2),
        _getScreen(3),
        _getScreen(4),
      ],
    );

    // Phones (under 600 px) are left exactly as they were.
    if (medium && !wide) {
      const maxW = 720.0;
      final inner = body;
      body = LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth < maxW ? c.maxWidth : maxW;
        return Align(
          alignment: Alignment.topCenter,
          child: Container(
            width: w,
            height: c.maxHeight,
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border.symmetric(
                  vertical: BorderSide(color: Color(0xFFE3E6F7))),
            ),
            child: inner,
          ),
        );
      });
    }

    return Scaffold(
      backgroundColor: medium && !wide ? const Color(0xFFEEF0FA) : null,
      appBar: _buildTopBar(),
      body: body,
      bottomNavigationBar: wide
          ? null
          : Container(
              decoration: BoxDecoration(
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 10,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: BottomNavigationBar(
                currentIndex: _currentIndex,
                onTap: _onNavBarTap,
                type: BottomNavigationBarType.fixed,
                selectedItemColor: const Color(0xFF3B82F6),
                unselectedItemColor: Colors.grey.shade500,
                selectedLabelStyle: GoogleFonts.nunito(
                    fontSize: 11, fontWeight: FontWeight.w700),
                unselectedLabelStyle:
                    GoogleFonts.nunito(fontSize: 10, fontWeight: FontWeight.w500),
                backgroundColor: Colors.white,
                elevation: 0,
                items: items,
              ),
            ),
    );
  }
}
