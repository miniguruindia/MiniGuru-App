// lib/screens/getStartedScreen.dart
// MiniGuru Get Started / Onboarding — Updated April 2026

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/screens/homeScreen.dart';

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
    // ── SLIDE 1 — For Children ───────────────────────────────────────────
    _OnboardSlide(
      bgColor: const Color(0xFFFFF8F0),
      accentColor: const Color(0xFF5B6EF5),
      title: 'Welcome to\nMiniGuru',
      subtitle:
          'Where children make real things,\nshare real projects, and learn\nfrom each other.',
      smallTag: 'For curious makers aged 8–14',
      chips: [],
      showStats: false,
      illustration: Image.asset(
        'assets/MGlogo.png',
        fit: BoxFit.contain,
      ),
    ),

    // ── SLIDE 2 — Community ──────────────────────────────────────────────
    _OnboardSlide(
      bgColor: const Color(0xFFFFF8F0),
      accentColor: const Color(0xFFE8A000),
      title: 'See What Children\nAre Building',
      subtitle:
          'Hands-on projects — volcanoes, circuits,\nfans, boats, solar cookers —\nmade from scratch.',
      smallTag: '',
      chips: [
        'Made by children of your age',
        'Shared with the peer community',
        'Trial & error leads them',
      ],
      showStats: false,
      illustration: const _ProjectCollageIllustration(),
    ),

    // ── SLIDE 3 — Make & Earn ────────────────────────────────────────────
    _OnboardSlide(
      bgColor: const Color(0xFFFFF8F0),
      accentColor: const Color(0xFF10B981),
      title: 'Make It. Document It.\nShare It.',
      subtitle:
          'Plan your project, record your making,\nshare with peers — including what went wrong.\nEarn back value in Goins for completing the journey.',
      smallTag: '',
      chips: [
        'Plan your project',
        'Document your process',
        'Share with your community',
        'Earn back value in Goins',
      ],
      showStats: false,
      illustration: const _MakingIllustration(),
    ),

    // ── SLIDE 4 — For Parents & Schools ─────────────────────────────────
    _OnboardSlide(
      bgColor: const Color(0xFFFFF8F0),
      accentColor: const Color(0xFF5B6EF5),
      title: 'Start a T-LAB —\nAt Home or in\nYour School',
      subtitle:
          '10 years. 32+ schools. 10,000+ children.\nWe know how to build a space\nwhere children thrive.',
      smallTag: '',
      chips: [
        'Home tinkering corners',
        'School T-LAB setup',
        'Expert guidance',
      ],
      showStats: true,
      illustration: const _TLabIllustration(),
    ),
  ];

  @override
  void initState() {
    super.initState();
    _floatController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat(reverse: true);
    _floatAnimation = Tween<double>(begin: -6, end: 6).animate(
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
      backgroundColor: const Color(0xFFFFF8F0),
      body: SafeArea(
        child: Column(
          children: [
            // ── Skip button ──────────────────────────────────────────────
            Align(
              alignment: Alignment.topRight,
              child: TextButton(
                onPressed: () => _showAuthSheet(context),
                child: Text(
                  'Skip',
                  style: GoogleFonts.poppins(
                    fontSize: 14,
                    color: Colors.black38,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),

            // ── Page content ─────────────────────────────────────────────
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

            // ── Bottom: dots + buttons ────────────────────────────────────
            _buildBottomSection(context, slide),
          ],
        ),
      ),
    );
  }

  Widget _buildSlide(BuildContext context, _OnboardSlide slide) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          // ── Illustration — 48% of screen height ──────────────────────
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.38,
            child: AnimatedBuilder(
              animation: _floatAnimation,
              builder: (context, child) => Transform.translate(
                offset: Offset(0, _floatAnimation.value),
                child: child,
              ),
              child: slide.illustration,
            ),
          ),

          const SizedBox(height: 20),

          // ── Headline ─────────────────────────────────────────────────
          Text(
            slide.title,
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              fontSize: 30,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF1A1A2E),
              height: 1.2,
            ),
          ),

          const SizedBox(height: 12),

          // ── Subline ──────────────────────────────────────────────────
          Text(
            slide.subtitle,
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              fontSize: 15,
              color: Colors.black54,
              height: 1.55,
            ),
          ),

          // ── Small tag (slide 1 only) ──────────────────────────────────
          if (slide.smallTag.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
              decoration: BoxDecoration(
                color: slide.accentColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(30),
              ),
              child: Text(
                slide.smallTag,
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  color: slide.accentColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],

          // ── Descriptor chips (slides 2, 3, 4) ────────────────────────
          if (slide.chips.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: slide.chips
                  .map((chip) => _DescriptorChip(
                        label: chip,
                        color: slide.accentColor,
                      ))
                  .toList(),
            ),
          ],

          // ── Stats bar (slide 4 only) ──────────────────────────────────
          if (slide.showStats) ...[
            const SizedBox(height: 18),
            _StatsBar(),
          ],

          const SizedBox(height: 8),
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
          // ── Navigation dots ───────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_slides.length, (index) {
              final isActive = index == _currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: isActive ? 28 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: isActive
                      ? slide.accentColor
                      : Colors.black.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
              );
            }),
          ),

          const SizedBox(height: 20),

          if (isLast) ...[
            // ── Final slide: 3-button row ─────────────────────────────
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () =>
                    Navigator.pushNamed(context, RegisterScreen.id),
                style: ElevatedButton.styleFrom(
                  backgroundColor: slide.accentColor,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: Text(
                  'Join Free',
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () =>
                    Navigator.pushNamed(context, LoginScreen.id),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  side: BorderSide(color: slide.accentColor, width: 2),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(
                  'Login',
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: slide.accentColor,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            GestureDetector(
              onTap: () =>
                  Navigator.pushReplacementNamed(context, HomeScreen.id),
              child: Text(
                'Explore first →',
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  color: Colors.black38,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ] else ...[
            // ── Not last: Next button ─────────────────────────────────
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

  // ── Skip → bottom sheet ──────────────────────────────────────────────────
  void _showAuthSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: const Color(0xFFFFF8F0),
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
              'Create a free account or log in to get started',
              style:
                  GoogleFonts.poppins(fontSize: 13, color: Colors.black54),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.pushNamed(context, RegisterScreen.id);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF5B6EF5),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: Text('Join Free',
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
                  Navigator.pushNamed(context, LoginScreen.id);
                },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(
                      color: Color(0xFF5B6EF5), width: 2),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Login',
                    style: GoogleFonts.poppins(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF5B6EF5))),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.pushReplacementNamed(context, HomeScreen.id);
              },
              child: Text('Explore first →',
                  style: GoogleFonts.poppins(
                      fontSize: 13, color: Colors.black38)),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

// ── DATA MODEL ───────────────────────────────────────────────────────────────
class _OnboardSlide {
  final Color bgColor;
  final Color accentColor;
  final String title;
  final String subtitle;
  final String smallTag;
  final List<String> chips;
  final bool showStats;
  final Widget illustration;

  const _OnboardSlide({
    required this.bgColor,
    required this.accentColor,
    required this.title,
    required this.subtitle,
    required this.smallTag,
    required this.chips,
    required this.showStats,
    required this.illustration,
  });
}

// ── DESCRIPTOR CHIP — pill, soft fill, no border, no icon ────────────────────
class _DescriptorChip extends StatelessWidget {
  final String label;
  final Color color;
  const _DescriptorChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Text(
        label,
        style: GoogleFonts.poppins(
          fontSize: 12,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ── STATS BAR (slide 4 only) ──────────────────────────────────────────────────
class _StatsBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF5B6EF5).withOpacity(0.07),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: const [
          _StatItem(value: '10+', label: 'Years'),
          _StatDivider(),
          _StatItem(value: '32+', label: 'T-LABs'),
          _StatDivider(),
          _StatItem(value: '10k+', label: 'Children'),
          _StatDivider(),
          _StatItem(value: '200+', label: 'Workshops'),
        ],
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String value;
  final String label;
  const _StatItem({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(value,
            style: GoogleFonts.poppins(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF5B6EF5),
            )),
        Text(label,
            style: GoogleFonts.poppins(
              fontSize: 10,
              color: Colors.black45,
            )),
      ],
    );
  }
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 28,
      color: Colors.black12,
    );
  }
}

// ── ILLUSTRATIONS ─────────────────────────────────────────────────────────────

// SLIDE 1 — Maker hands: tools, wire, cardboard
class _MakerHandsIllustration extends StatelessWidget {
  const _MakerHandsIllustration();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Soft background circle
          Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(
              color: const Color(0xFF5B6EF5).withOpacity(0.08),
              shape: BoxShape.circle,
            ),
          ),
          // Workbench card
          Container(
            width: 200,
            height: 160,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.orange.withOpacity(0.12),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                )
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('🛠️', style: TextStyle(fontSize: 52)),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _MaterialChip('🪛 wire', const Color(0xFFFF7043)),
                    const SizedBox(width: 6),
                    _MaterialChip('📦 cardboard', const Color(0xFF8D6E63)),
                  ],
                ),
              ],
            ),
          ),
          // Floating tool badges
          Positioned(
            top: 10,
            right: 20,
            child: _FloatingBadge('⚡', const Color(0xFFFDD835)),
          ),
          Positioned(
            bottom: 12,
            left: 16,
            child: _FloatingBadge('🔩', const Color(0xFF90A4AE)),
          ),
          Positioned(
            top: 40,
            left: 10,
            child: _FloatingBadge('💡', const Color(0xFFFFCA28)),
          ),
        ],
      ),
    );
  }
}

// SLIDE 2 — Project collage: circuit, clay, fan, boat
class _ProjectCollageIllustration extends StatelessWidget {
  const _ProjectCollageIllustration();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: 260,
        height: 200,
        child: Stack(
          children: [
            // Top-left card
            Positioned(
              top: 0,
              left: 0,
              child: _ProjectCard('⚡', 'Circuit', const Color(0xFF5B6EF5)),
            ),
            // Top-right card
            Positioned(
              top: 0,
              right: 0,
              child: _ProjectCard('🌋', 'Volcano', const Color(0xFFE53935)),
            ),
            // Bottom-left card
            Positioned(
              bottom: 0,
              left: 0,
              child: _ProjectCard('🌀', 'Fan', const Color(0xFF10B981)),
            ),
            // Bottom-right card
            Positioned(
              bottom: 0,
              right: 0,
              child: _ProjectCard('⛵', 'Boat', const Color(0xFFE8A000)),
            ),
            // Centre connector
            Center(
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 12,
                    )
                  ],
                ),
                child: const Center(
                  child: Text('🤝', style: TextStyle(fontSize: 22)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// SLIDE 3 — Child with finished project + planning board
class _MakingIllustration extends StatelessWidget {
  const _MakingIllustration();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Background circle
          Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withOpacity(0.08),
              shape: BoxShape.circle,
            ),
          ),
          // Main card — finished project
          Container(
            width: 175,
            height: 150,
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('🏆', style: TextStyle(fontSize: 42)),
                const SizedBox(height: 8),
                Text(
                  'Project Complete!',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF10B981),
                  ),
                ),
                const SizedBox(height: 8),
                // Goins earned — coin, NOT star/badge
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8A000).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('🪙',
                          style: TextStyle(fontSize: 14)),
                      const SizedBox(width: 5),
                      Text(
                        '+50 Goins',
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFE8A000),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Planning sticky note
          Positioned(
            top: 8,
            right: 14,
            child: Container(
              width: 60,
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF9C4),
                borderRadius: BorderRadius.circular(8),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 6,
                  )
                ],
              ),
              child: Column(
                children: [
                  Container(height: 4, color: Colors.black12,
                      margin: const EdgeInsets.only(bottom: 3)),
                  Container(height: 4, color: Colors.black12,
                      margin: const EdgeInsets.only(bottom: 3)),
                  Container(height: 4, width: 24, color: Colors.black12),
                ],
              ),
            ),
          ),
          // Video upload badge
          Positioned(
            bottom: 14,
            left: 12,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 8,
                  )
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.videocam,
                      size: 14, color: Color(0xFF10B981)),
                  const SizedBox(width: 4),
                  Text('Shared!',
                      style: GoogleFonts.poppins(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF10B981))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// SLIDE 4 — T-LAB / parent+child scene
class _TLabIllustration extends StatelessWidget {
  const _TLabIllustration();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Background
          Container(
            width: 210,
            height: 200,
            decoration: BoxDecoration(
              color: const Color(0xFF5B6EF5).withOpacity(0.07),
              borderRadius: BorderRadius.circular(28),
            ),
          ),
          // Main scene card
          Container(
            width: 185,
            height: 155,
            decoration: BoxDecoration(
              color: const Color(0xFFE8EAF6),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // People row
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('👨‍🏫', style: TextStyle(fontSize: 34)),
                    const SizedBox(width: 8),
                    const Text('👧', style: TextStyle(fontSize: 30)),
                    const SizedBox(width: 8),
                    const Text('👦', style: TextStyle(fontSize: 30)),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  'T-LAB in action',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF5B6EF5),
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Text('🔧', style: TextStyle(fontSize: 18)),
                    SizedBox(width: 6),
                    Text('🔬', style: TextStyle(fontSize: 18)),
                    SizedBox(width: 6),
                    Text('🎨', style: TextStyle(fontSize: 18)),
                  ],
                ),
              ],
            ),
          ),
          // School badge
          Positioned(
            top: 8,
            right: 12,
            child: _FloatingBadge('🏫', const Color(0xFF5B6EF5)),
          ),
          // Home badge
          Positioned(
            bottom: 10,
            left: 12,
            child: _FloatingBadge('🏠', const Color(0xFFE8A000)),
          ),
        ],
      ),
    );
  }
}

// ── SMALL REUSABLE WIDGETS ────────────────────────────────────────────────────

class _MaterialChip extends StatelessWidget {
  final String label;
  final Color color;
  const _MaterialChip(this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: GoogleFonts.poppins(
              fontSize: 10,
              color: color,
              fontWeight: FontWeight.w600)),
    );
  }
}

class _FloatingBadge extends StatelessWidget {
  final String emoji;
  final Color color;
  const _FloatingBadge(this.emoji, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(emoji, style: const TextStyle(fontSize: 18)),
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  final String emoji;
  final String label;
  final Color color;
  const _ProjectCard(this.emoji, this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 108,
      height: 88,
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.2), width: 1),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 28)),
          const SizedBox(height: 4),
          Text(label,
              style: GoogleFonts.poppins(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: color)),
        ],
      ),
    );
  }
}