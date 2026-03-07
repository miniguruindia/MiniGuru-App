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
import 'package:miniguru/models/User.dart';
import 'package:google_fonts/google_fonts.dart';

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
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    try {
      final userData = await _miniguruApi.getUserData();
      if (mounted) {
        setState(() {
          _user = userData;
          _isAuthenticated = userData != null;
          _authChecked = true;
          // Clear cached screens that depend on auth state
          _cachedScreens.remove(1);
          _cachedScreens.remove(3);
          _cachedScreens.remove(4);
        });
      }
    } catch (e) {
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
      if (_isAuthenticated && _user != null) {
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
          // Library for logged-in, Consultancy for guests
          _cachedScreens[index] = _isAuthenticated
              ? const Library()
              : const ConsultancyPage();
          break;
        case 2:
          _cachedScreens[index] = const Shop();
          break;
        case 3:
          // Projects for logged-in, Community for guests
          _cachedScreens[index] = _isAuthenticated
              ? const ProjectScreen()
              : const CommunityScreen();
          break;
      }
    }
    return _cachedScreens[index]!;
  }

  void _onNavBarTap(int index) {
    if (_currentIndex != index) {
      setState(() => _currentIndex = index);
    }
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

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _getScreen(0),
          _getScreen(1),
          _getScreen(2),
          _getScreen(3),
          _getScreen(4),
        ],
      ),
      bottomNavigationBar: Container(
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
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Icon(_isAuthenticated
                  ? Icons.library_books_outlined
                  : Icons.support_agent_outlined),
              activeIcon: Icon(_isAuthenticated
                  ? Icons.library_books
                  : Icons.support_agent),
              label: _isAuthenticated ? 'Library' : 'Consult',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.shopping_bag_outlined),
              activeIcon: Icon(Icons.shopping_bag),
              label: 'Shop',
            ),
            BottomNavigationBarItem(
              icon: Icon(_isAuthenticated
                  ? Icons.work_outline
                  : Icons.people_outline),
              activeIcon: Icon(
                  _isAuthenticated ? Icons.work : Icons.people),
              label: _isAuthenticated ? 'Projects' : 'Community',
            ),
            BottomNavigationBarItem(
              icon: Icon(_isAuthenticated
                  ? Icons.person_outline
                  : Icons.info_outline),
              activeIcon:
                  Icon(_isAuthenticated ? Icons.person : Icons.info),
              label: _isAuthenticated ? 'Profile' : 'About',
            ),
          ],
        ),
      ),
    );
  }
}