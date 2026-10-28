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
import 'package:miniguru/widgets/mgIcons.dart';
import 'package:miniguru/utils/deepLink.dart';

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
    DeepLink.opener = _openPath;
    NavShell.attach();
    _checkAuth();
  }

  void _onShellIndex() {
    final i = NavShell.index.value;
    if (mounted && i != _currentIndex) {
      setState(() => _currentIndex = i);
      _syncUrl();
    }
  }

  // Address-bar name of each tab (the tabs differ for guests, children and mentors).
  String _slug(int i) {
    final mentor = _user?.isMentor == true && !SessionState.isChildSession;
    final authed = SessionState.isChildSession || _isAuthenticated;
    switch (i) {
      case 0: return 'home';
      case 1: return (mentor || !authed) ? 'consult' : 'community';
      case 2: return 'shop';
      case 3: return mentor ? 'children' : authed ? 'projects' : 'community';
      default: return mentor ? 'account' : authed ? 'profile' : 'about';
    }
  }

  // Opened from a shared address (miniguru.in/shop ...)? Go to that tab.
  void _applyDeepLink() {
    final base = DeepLink.takeBase();
    if (base == null) return;
    for (var i = 0; i < 5; i++) {
      if (_slug(i) == base) {
        _currentIndex = i;
        break;
      }
    }
  }

  // Open an existing tab (and its inner tab) instead of a second copy of it.
  bool _openPath(String path) {
    final parts = path.split('/').where((s) => s.isNotEmpty).toList();
    if (parts.isEmpty) return false;
    for (var i = 0; i < 5; i++) {
      if (_slug(i) != parts[0]) continue;
      NavShell.go(i);
      if (parts.length > 1) {
        if (parts[0] == 'community') DeepLink.communityTabRequest.value = parts[1];
        if (parts[0] == 'consult') DeepLink.consultTabRequest.value = parts[1];
      }
      return true;
    }
    return false;
  }

  void _syncUrl() => DeepLink.setActive(_slug(_currentIndex));

  @override
  void dispose() {
    NavShell.index.removeListener(_onShellIndex);
    if (DeepLink.opener == _openPath) DeepLink.opener = null;
    NavShell.detach();
    super.dispose();
  }

  Future<void> _checkAuth() async {
    print('🔵 [HomeScreen] Checking authentication...');
    
    // If we are in a child session, just mark authenticated — don't overwrite with mentor data
    if (SessionState.isChildSession) {
      print('✅ [HomeScreen] Child session detected, marking as authenticated');
      setState(() { _isAuthenticated = true; _authChecked = true; _applyDeepLink(); });
      _syncUrl();
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
          _applyDeepLink();
        });
        _syncUrl();
      }
    } catch (e) {
      print('❌ [HomeScreen] Auth check failed: $e');
      if (mounted) {
        setState(() {
          _user = null;
          _isAuthenticated = false;
          _authChecked = true;
          _applyDeepLink();
        });
        _syncUrl();
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
            _cachedScreens[index] = ConsultancyPage(initialService: DeepLink.takeTab('consult', DeepLink.consultTabs));
            break;
          }
          _cachedScreens[index] = _isAuthenticated
              ? CommunityScreen(initialTab: DeepLink.takeTab('community', DeepLink.communityTabs))
              : ConsultancyPage(initialService: DeepLink.takeTab('consult', DeepLink.consultTabs));
          break;
        case 2:
          _cachedScreens[index] = const Shop();
          break;
        case 3:
          if (_user?.isMentor == true && !SessionState.isChildSession) {
            _cachedScreens[index] = const MentorActivityTab();
            break;
          }
          _cachedScreens[index] = _isAuthenticated ? const ProjectScreen() : CommunityScreen(initialTab: DeepLink.takeTab('community', DeepLink.communityTabs));
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
    _syncUrl();
  }

  PreferredSizeWidget? _buildTopBar() {
    if (SessionState.isChildSession) {
      return PreferredSize(
        preferredSize: const Size.fromHeight(36),
        child: Container(
          color: const Color(0xFF0A6CFF),
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
                        Icon(Icons.supervisor_account, size: 18, color: Color(0xFF0A6CFF)),
                        SizedBox(width: 6),
                        Text('My Account',
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0A6CFF))),
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

  // One coloured tab: filled icon on a tinted pill when selected, same
  // colour a little softer when not. Colours: Google blue / green / yellow /
  // red (see widgets/mgIcons.dart).
  BottomNavigationBarItem _tab(IconData outlined, IconData filled, Color color, String label) {
    return BottomNavigationBarItem(
      icon: NavIcon(icon: outlined, color: color),
      activeIcon: NavIcon(icon: filled, color: color, selected: true),
      label: label,
    );
  }

  List<BottomNavigationBarItem> _navItems() {
    return [
      _tab(Icons.home_rounded, Icons.home_rounded, GColors.blue, 'Home'),
      // Mentors/parents/schools see the same Consultancy tab a guest sees
      // here — "Learners" moved into Children's Activity.
      _tab(
        (_isMentorView || !_isAuthenticated) ? Icons.support_agent_rounded : Icons.diversity_3_rounded,
        (_isMentorView || !_isAuthenticated) ? Icons.support_agent_rounded : Icons.diversity_3_rounded,
        GColors.green,
        _isMentorView ? 'Consult' : _isAuthenticated ? 'Community' : 'Consult',
      ),
      _tab(Icons.shopping_basket_rounded, Icons.shopping_basket_rounded, GColors.orange, 'Shop'),
      _tab(
        _isAuthenticated ? Icons.rocket_launch_rounded : Icons.diversity_3_rounded,
        _isAuthenticated ? Icons.rocket_launch_rounded : Icons.diversity_3_rounded,
        GColors.pink,
        _isMentorView
            ? "Children's Activity"
            : _isAuthenticated ? 'Projects' : 'Community',
      ),
      (!_isMentorView && !_isAuthenticated)
          ? BottomNavigationBarItem(
              icon: _logoIcon(0.65), activeIcon: _logoIcon(1.0), label: 'About')
          : _tab(
              _isMentorView ? Icons.supervisor_account_rounded : Icons.face_rounded,
              _isMentorView ? Icons.supervisor_account_rounded : Icons.face_rounded,
              GColors.purple,
              _isMentorView ? 'My Account' : 'Profile',
            ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (!_authChecked) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF0A6CFF)),
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
                  vertical: BorderSide(color: Color(0xFFC9D0F0))),
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
                selectedItemColor: const Color(0xFF0A6CFF),
                unselectedItemColor: Colors.grey.shade500,
                selectedLabelStyle: GoogleFonts.nunito(
                    fontSize: 11, fontWeight: FontWeight.w700),
                unselectedLabelStyle:
                    GoogleFonts.nunito(fontSize: 10, fontWeight: FontWeight.w600),
                backgroundColor: Colors.white,
                elevation: 0,
                items: items,
              ),
            ),
    );
  }
}
