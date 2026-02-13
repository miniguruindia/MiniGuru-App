// lib/screens/getStartedScreen.dart
// MiniGuru Get Started / Onboarding Page

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';

class GetStartedScreen extends StatefulWidget {
  static const String id = 'GetStartedScreen';
  const GetStartedScreen({super.key});

  @override
  State<GetStartedScreen> createState() => _GetStartedScreenState();
}

class _GetStartedScreenState extends State<GetStartedScreen>
    with TickerProviderStateMixin {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  late AnimationController _floatController;
  late Animation<double> _floatAnimation;

  final List<_OnboardSlide> _slides = [
    _OnboardSlide(
      bgColor: const Color(0xFFEFF6FF),
      accentColor: const Color(0xFF3B82F6),
      emoji: '🚀',
      title: 'Welcome to\nMiniGuru',
      subtitle: 'The creative learning platform\nbuilt for young makers aged 8–14.',
      features: [],
      illustrationWidgets: _RocketIllustration(),
    ),
    _OnboardSlide(
      bgColor: const Color(0xFFFFFBEB),
      accentColor: const Color(0xFFF59E0B),
      emoji: '🎬',
      title: 'Watch & Learn\nFrom Real Makers',
      subtitle: 'Explore hundreds of DIY project videos\nin Robotics, Electronics, Arts & Science.',
      features: ['Robotics & Electronics', 'Arts & Crafts', 'Science Projects'],
      illustrationWidgets: _VideoIllustration(),
    ),
    _OnboardSlide(
      bgColor: const Color(0xFFF0FDF4),
      accentColor: const Color(0xFF10B981),
      emoji: '🔧',
      title: 'Build, Share &\nEarn Recognition',
      subtitle: 'Post your own projects, get likes\nand build your maker portfolio.',
      features: ['Share your builds', 'Get community feedback', 'Earn badges & scores'],
      illustrationWidgets: _BuildIllustration(),
    ),
    _OnboardSlide(
      bgColor: const Color(0xFFFFF1F2),
      accentColor: const Color(0xFFEC4899),
      emoji: '🏠',
      title: 'Set Up Your\nTinkering Space',
      subtitle: 'Get expert help setting up a home\ntinkering corner or school T-LAB.',
      features: ['Home tinkering corners', 'School T-LAB setup', 'Expert consultancy'],
      illustrationWidgets: _SpaceIllustration(),
    ),
  ];

  @override
  void initState() {
    super.initState();
    _floatController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    _floatAnimation = Tween<double>(begin: -8, end: 8).animate(
      CurvedAnimation(parent: _floatController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_currentPage < _slides.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final slide = _slides[_currentPage];

    return Scaffold(
      backgroundColor: slide.bgColor,
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 400),
        color: slide.bgColor,
        child: SafeArea(
          child: Column(
            children: [
              // Skip button
              Align(
                alignment: Alignment.topRight,
                child: TextButton(
                  onPressed: () => _showAuthSheet(context),
                  child: Text(
                    'Skip',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: Colors.black45,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),

              // Page content
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: _slides.length,
                  onPageChanged: (index) =>
                      setState(() => _currentPage = index),
                  itemBuilder: (context, index) {
                    return _buildSlide(context, _slides[index]);
                  },
                ),
              ),

              // Bottom section
              _buildBottomSection(context, slide),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSlide(BuildContext context, _OnboardSlide slide) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          const SizedBox(height: 8),

          // Floating illustration
          Expanded(
            flex: 5,
            child: AnimatedBuilder(
              animation: _floatAnimation,
              builder: (context, child) {
                return Transform.translate(
                  offset: Offset(0, _floatAnimation.value),
                  child: child,
                );
              },
              child: SizedBox(
                width: double.infinity,
                child: slide.illustrationWidgets,
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Emoji badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: slide.accentColor.withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              slide.emoji,
              style: const TextStyle(fontSize: 28),
            ),
          ),

          const SizedBox(height: 16),

          // Title
          Text(
            slide.title,
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
              height: 1.2,
            ),
          ),

          const SizedBox(height: 12),

          // Subtitle
          Text(
            slide.subtitle,
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: Colors.black54,
              height: 1.5,
            ),
          ),

          const SizedBox(height: 12),

          // Feature pills
          if (slide.features.isNotEmpty)
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 6,
              children: slide.features.map((f) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: slide.accentColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: slide.accentColor.withOpacity(0.3), width: 1),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle,
                        size: 13, color: slide.accentColor),
                    const SizedBox(width: 5),
                    Text(f,
                        style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: slide.accentColor,
                            fontWeight: FontWeight.w500)),
                  ],
                ),
              )).toList(),
            ),

          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildBottomSection(BuildContext context, _OnboardSlide slide) {
    final isLast = _currentPage == _slides.length - 1;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
      child: Column(
        children: [
          // Page dots
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_slides.length, (index) {
              final isActive = index == _currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: isActive ? 24 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: isActive ? slide.accentColor : Colors.black12,
                  borderRadius: BorderRadius.circular(4),
                ),
              );
            }),
          ),

          const SizedBox(height: 20),

          if (isLast) ...[
            // Final slide — show Login + Register buttons
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () =>
                    Navigator.pushNamed(context, LoginScreen.id),
                style: ElevatedButton.styleFrom(
                  backgroundColor: slide.accentColor,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: Text(
                  'Login to MiniGuru',
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () =>
                    Navigator.pushNamed(context, RegisterScreen.id),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  side: BorderSide(color: slide.accentColor, width: 2),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(
                  'Create Free Account',
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: slide.accentColor,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () => Navigator.pushNamed(context, 'HomeScreen'),
              child: Text(
                'Continue without login →',
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  color: Colors.black45,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ] else ...[
            // Not last — show Next button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _nextPage,
                style: ElevatedButton.styleFrom(
                  backgroundColor: slide.accentColor,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Next',
                      style: GoogleFonts.poppins(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_forward,
                        color: Colors.white, size: 18),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showAuthSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.black12,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Join MiniGuru',
              style: GoogleFonts.poppins(
                  fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Text(
              'Login or create a free account to get started',
              style: GoogleFonts.poppins(fontSize: 13, color: Colors.black54),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.pushNamed(context, LoginScreen.id);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B82F6),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Login',
                    style: GoogleFonts.poppins(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.white)),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.pushNamed(context, RegisterScreen.id);
                },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(color: Color(0xFF3B82F6), width: 2),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Create Free Account',
                    style: GoogleFonts.poppins(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF3B82F6))),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, 'HomeScreen');
              },
              child: Text('Continue without login',
                  style: GoogleFonts.poppins(
                      fontSize: 13, color: Colors.black45)),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

// ── DATA MODEL ─────────────────────────────────────────────────────────────
class _OnboardSlide {
  final Color bgColor;
  final Color accentColor;
  final String emoji;
  final String title;
  final String subtitle;
  final List<String> features;
  final Widget illustrationWidgets;

  const _OnboardSlide({
    required this.bgColor,
    required this.accentColor,
    required this.emoji,
    required this.title,
    required this.subtitle,
    required this.features,
    required this.illustrationWidgets,
  });
}

// ── ILLUSTRATIONS (Flutter-drawn, no external assets needed) ───────────────

class _RocketIllustration extends StatelessWidget {
  const _RocketIllustration();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        height: 220,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Stars
            Positioned(top: 10, left: 30,
                child: _Star(size: 16, color: const Color(0xFF3B82F6).withOpacity(0.3))),
            Positioned(top: 40, right: 20,
                child: _Star(size: 12, color: const Color(0xFF3B82F6).withOpacity(0.5))),
            Positioned(top: 80, left: 10,
                child: _Star(size: 10, color: const Color(0xFF3B82F6).withOpacity(0.4))),
            // Main rocket circle
            Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
            ),
            // Rocket emoji large
            const Text('🚀', style: TextStyle(fontSize: 80)),
            // Orbiting dots
            Positioned(top: 20, right: 50,
                child: _Dot(color: const Color(0xFF3B82F6), size: 10)),
            Positioned(bottom: 30, left: 40,
                child: _Dot(color: const Color(0xFF93C5FD), size: 8)),
            Positioned(top: 60, left: 30,
                child: _Dot(color: const Color(0xFFFBBF24), size: 6)),
          ],
        ),
      ),
    );
  }
}

class _VideoIllustration extends StatelessWidget {
  const _VideoIllustration();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        height: 220,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              width: 200,
              height: 130,
              decoration: BoxDecoration(
                color: const Color(0xFFFDE68A),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Play button
                  Container(
                    width: 55,
                    height: 55,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF59E0B),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.play_arrow,
                        color: Colors.white, size: 32),
                  ),
                  // Progress bar
                  Positioned(
                    bottom: 16,
                    left: 16,
                    right: 16,
                    child: Column(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: 0.6,
                            backgroundColor: Colors.white38,
                            valueColor: const AlwaysStoppedAnimation(
                                Color(0xFFF59E0B)),
                            minHeight: 6,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Category tags
            Positioned(
              top: 10,
              right: 20,
              child: _Tag('Robotics 🤖', const Color(0xFF3B82F6)),
            ),
            Positioned(
              bottom: 10,
              left: 20,
              child: _Tag('Science 🔬', const Color(0xFF10B981)),
            ),
          ],
        ),
      ),
    );
  }
}

class _BuildIllustration extends StatelessWidget {
  const _BuildIllustration();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        height: 220,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Main card
            Container(
              width: 180,
              height: 140,
              decoration: BoxDecoration(
                color: const Color(0xFFBBF7D0),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('🔧', style: TextStyle(fontSize: 44)),
                  const SizedBox(height: 8),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                    height: 8,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 32),
                    height: 6,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withOpacity(0.4),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ],
              ),
            ),
            // Like badge
            Positioned(
              top: 16,
              right: 24,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 8)
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('⭐', style: TextStyle(fontSize: 14)),
                    const SizedBox(width: 4),
                    Text('4.9',
                        style: GoogleFonts.poppins(
                            fontSize: 12, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
            // Points badge
            Positioned(
              bottom: 16,
              left: 24,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBBF24),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text('+50 pts',
                    style: GoogleFonts.poppins(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpaceIllustration extends StatelessWidget {
  const _SpaceIllustration();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        height: 220,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // House shape
            Container(
              width: 170,
              height: 140,
              decoration: BoxDecoration(
                color: const Color(0xFFFECDD3),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Center(
                child: Text('🏠', style: TextStyle(fontSize: 70)),
              ),
            ),
            // Tool icons
            Positioned(
              top: 12,
              right: 18,
              child: _IconBadge(Icons.precision_manufacturing,
                  const Color(0xFFEC4899)),
            ),
            Positioned(
              bottom: 12,
              left: 18,
              child: _IconBadge(Icons.school, const Color(0xFF8B5CF6)),
            ),
            Positioned(
              top: 60,
              left: 8,
              child: _IconBadge(Icons.lightbulb_outline,
                  const Color(0xFFF59E0B)),
            ),
          ],
        ),
      ),
    );
  }
}

// ── SMALL REUSABLE WIDGETS ──────────────────────────────────────────────────

class _Star extends StatelessWidget {
  final double size;
  final Color color;
  const _Star({required this.size, required this.color});
  @override
  Widget build(BuildContext context) {
    return Icon(Icons.star, size: size, color: color);
  }
}

class _Dot extends StatelessWidget {
  final Color color;
  final double size;
  const _Dot({required this.color, required this.size});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final Color color;
  const _Tag(this.label, this.color);
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 6)
        ],
      ),
      child: Text(label,
          style: GoogleFonts.poppins(
              fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

class _IconBadge extends StatelessWidget {
  final IconData icon;
  final Color color;
  const _IconBadge(this.icon, this.color);
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        shape: BoxShape.circle,
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Icon(icon, size: 18, color: color),
    );
  }
}