import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/screens/navScreen/home.dart';
import 'package:miniguru/screens/navScreen/library.dart';
import 'package:miniguru/screens/navScreen/profile.dart';
import 'package:miniguru/screens/navScreen/projects.dart';
import 'package:miniguru/screens/navScreen/shop.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  static String id = "HomeScreen";

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  // Lazy loading - create widgets only when needed
  final Map<int, Widget> _cachedScreens = {};

  Widget _getScreen(int index) {
    // Return cached screen if exists, otherwise create new one
    if (!_cachedScreens.containsKey(index)) {
      switch (index) {
        case 0:
          _cachedScreens[index] = const Home();
          break;
        case 1:
          _cachedScreens[index] = const Library();
          break;
        case 2:
          _cachedScreens[index] = const Shop();
          break;
        case 3:
          _cachedScreens[index] = const ProjectScreen();
          break;
        case 4:
          _cachedScreens[index] = const Profile();
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
      // Use IndexedStack to preserve state and avoid rebuilds
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _getScreen(0), // Home
          _getScreen(1), // Library
          _getScreen(2), // Shop
          _getScreen(3), // Projects
          _getScreen(4), // Profile
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onNavBarTap,
        type: BottomNavigationBarType
            .fixed, // Changed from shifting for better performance
        selectedItemColor: pastelBlueText,
        unselectedItemColor: Colors.grey,
        selectedLabelStyle:
            bodyTextStyle.copyWith(fontSize: 12, fontWeight: FontWeight.w600),
        unselectedLabelStyle: bodyTextStyle.copyWith(fontSize: 11),
        backgroundColor: Colors.white,
        elevation: 8,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.library_books_outlined),
            activeIcon: Icon(Icons.library_books),
            label: 'Library',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.shopping_bag_outlined),
            activeIcon: Icon(Icons.shopping_bag),
            label: 'Shop',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.work_outline),
            activeIcon: Icon(Icons.work),
            label: 'Projects',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
