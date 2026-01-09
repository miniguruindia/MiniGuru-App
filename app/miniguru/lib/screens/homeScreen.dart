import 'package:flutter/material.dart';
import 'package:miniguru/screens/navScreen/home.dart';
import 'package:miniguru/screens/navScreen/library.dart';
import 'package:miniguru/screens/navScreen/profile.dart';
import 'package:miniguru/screens/navScreen/projects.dart';
import 'package:miniguru/screens/navScreen/shop.dart';
import 'package:miniguru/screens/about.dart'; // ✅ This imports AboutScreen
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/models/User.dart';
import 'package:google_fonts/google_fonts.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  static const String id = "HomeScreen";

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  final _miniguruApi = MiniguruApi();
  User? _user;
  bool _isAuthenticated = false;

  // Cache for screens except Home (index 0)
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
        });
      }
    } catch (e) {
      print('Auth check error: $e');
    }
  }

  Widget _getScreen(int index) {
    // NEVER cache Home screen - always create fresh so auth updates
    if (index == 0) {
      return const Home();
    }
    
    // For Profile/About - show About if not authenticated, Profile if authenticated
    if (index == 4) {
      if (_isAuthenticated && _user != null) {
        if (!_cachedScreens.containsKey(index)) {
          _cachedScreens[index] = const Profile();
        }
        return _cachedScreens[index]!;
      } else {
        // Return AboutScreen for guest users
        return const AboutScreen(); // ✅ FIXED: Changed from About() to AboutScreen()
      }
    }
    
    // Cache other screens
    if (!_cachedScreens.containsKey(index)) {
      switch (index) {
        case 1:
          _cachedScreens[index] = const Library();
          break;
        case 2:
          _cachedScreens[index] = const Shop();
          break;
        case 3:
          _cachedScreens[index] = const ProjectScreen();
          break;
      }
    }
    return _cachedScreens[index]!;
  }

  void _onNavBarTap(int index) {
    if (_currentIndex != index) {
      setState(() {
        _currentIndex = index;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _getScreen(0), // Home - always fresh
          _getScreen(1), // Library
          _getScreen(2), // Shop
          _getScreen(3), // Projects
          _getScreen(4), // Profile or About
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
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
          unselectedItemColor: Colors.grey.shade600,
          selectedLabelStyle: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: GoogleFonts.poppins(
            fontSize: 11,
          ),
          backgroundColor: Colors.white,
          elevation: 0,
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'Home',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.library_books_outlined),
              activeIcon: Icon(Icons.library_books),
              label: 'Library',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.shopping_bag_outlined),
              activeIcon: Icon(Icons.shopping_bag),
              label: 'Shop',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.work_outline),
              activeIcon: Icon(Icons.work),
              label: 'Projects',
            ),
            // Show "About" for guests, "Profile" for authenticated users
            BottomNavigationBarItem(
              icon: _isAuthenticated 
                  ? const Icon(Icons.person_outline)
                  : const Icon(Icons.info_outline),
              activeIcon: _isAuthenticated 
                  ? const Icon(Icons.person)
                  : const Icon(Icons.info),
              label: _isAuthenticated ? 'Profile' : 'About',
            ),
          ],
        ),
      ),
    );
  }
}