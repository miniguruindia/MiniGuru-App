// lib/screens/about.dart
import 'package:miniguru/screens/legalScreen.dart';
// CMS-wired: mission text + hero description fetched from GET /cms/about

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';

class AboutScreen extends StatefulWidget {
  const AboutScreen({super.key});

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen> {
  // ── CMS-driven fields (with hardcoded fallbacks) ───────────────────────
  final _api = MiniguruApi();

  String _heroTagline =
      'A dedicated video sharing online platform for children';
  String _heroDescription =
      'Every child acts as a guru to their peer children, facilitating '
      'constructive offline engagements. Children are naturally curious '
      'and creative.';
  String _missionText =
      'MiniGuru is a hub of children\'s dreams and ideas, encouraging children '
      'to work on their ideas at their own pace and interest. Their uploaded '
      'project videos and communications among themselves are learning '
      'opportunities for each other.';
  String _missionQuote =
      '"Children learn from anything and everything they see. They learn '
      'wherever they are, not just in special learning places." - John Holt';

  @override
  void initState() {
    super.initState();
    _loadCms();
  }

  Future<void> _loadCms() async {
    try {
      final data = await _api.getCmsContent('about');
      if (data == null || !mounted) return;

      setState(() {
        // Hero section
        if (data['heroTagline'] != null) {
          _heroTagline = data['heroTagline'].toString();
        }
        if (data['heroDescription'] != null) {
          _heroDescription = data['heroDescription'].toString();
        }

        // Mission section
        if (data['mission'] != null) {
          _missionText = data['mission'].toString();
        }
        if (data['missionQuote'] != null) {
          _missionQuote = data['missionQuote'].toString();
        }
      });
    } catch (e) {
      debugPrint('❌ About CMS load error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              _buildHeader(context),
              _buildHeroSection(),
              _buildMissionSection(),
              _buildPlatformFeatures(),
              _buildOfferingsSection(),
              _buildSTEAMLabsSection(),
              _buildAwardsSection(),
              _buildContactSection(),
              _buildFooter(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF6C63FF), Color(0xFF4CAF50)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Image.asset(
                  'assets/mg-logo.png',
                  width: 32,
                  height: 32,
                  errorBuilder: (context, error, stackTrace) {
                    return const Icon(Icons.science, color: Colors.white, size: 32);
                  },
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'MiniGuru',
                    style: GoogleFonts.poppins(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF2C3E50),
                    ),
                  ),
                  Text(
                    'About Us',
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ],
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pushNamed(context, LoginScreen.id);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6C63FF),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text('Login', style: GoogleFonts.poppins()),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroSection() {
    return Container(
      margin: const EdgeInsets.all(20),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF667EEA).withOpacity(0.4),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          const Icon(Icons.lightbulb, size: 60, color: Colors.white),
          const SizedBox(height: 16),
          Text(
            'MiniGuru',
            style: GoogleFonts.poppins(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          // CMS-driven tagline
          Text(
            _heroTagline,
            style: GoogleFonts.poppins(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: Colors.white.withOpacity(0.95),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          // CMS-driven description
          Text(
            _heroDescription,
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: Colors.white.withOpacity(0.9),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildMissionSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF6C63FF).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.hub, color: Color(0xFF6C63FF), size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Our Mission',
                  style: GoogleFonts.poppins(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF2C3E50),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // CMS-driven mission text
          Text(
            _missionText,
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: Colors.grey.shade700,
              height: 1.6,
            ),
          ),
          const SizedBox(height: 12),
          // CMS-driven quote
          Text(
            _missionQuote,
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: const Color(0xFF6C63FF),
              fontStyle: FontStyle.italic,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlatformFeatures() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Platform Features',
            style: GoogleFonts.poppins(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF2C3E50),
            ),
          ),
          const SizedBox(height: 16),
          _buildFeatureCard(
            Icons.video_library,
            'Video Sharing Platform',
            'Children (aged 8-14) upload their project videos for peer community to review and comment. It becomes a comprehensive project knowledge bank created by children for children.',
            const Color(0xFFFF6B6B),
          ),
          const SizedBox(height: 12),
          _buildFeatureCard(
            Icons.description,
            'Planning & Documentation Tools',
            'MiniGuru assists and guides children to work on their ideas with ease. Planning page to draw and describe their projects, select materials, and score estimated costs.',
            const Color(0xFF4ECDC4),
          ),
          const SizedBox(height: 12),
          _buildFeatureCard(
            Icons.stars,
            'Gamification with Goins',
            'Virtual currency "Goins" and constructive peer review process keep children motivated. Video uploads give them double the score they spend on materials.',
            const Color(0xFFFFA502),
          ),
          const SizedBox(height: 12),
          _buildFeatureCard(
            Icons.shopping_cart,
            'E-Commerce for Materials',
            'Access good quality kit materials for projects at affordable prices. Solve the issue of finding materials in local markets with just a few clicks.',
            const Color(0xFF95E1D3),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureCard(IconData icon, String title, String description, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF2C3E50),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  description,
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: Colors.grey.shade600,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOfferingsSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Our Offerings',
            style: GoogleFonts.poppins(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF2C3E50),
            ),
          ),
          const SizedBox(height: 20),
          _buildOfferingItem(
            '🏫 T-LAB centers',
            'We design and set up T-LAB tinkering spaces in schools and community locations, enabling hands-on learning during school hours and beyond through structured and open project time.',
            'For Schools, NGOs, CSR Programs & Communities',
          ),
          const SizedBox(height: 16),
          _buildOfferingItem(
            '⚡ Tinkering Workshops',
            'Short workshops for children and teachers ranging from 1 to 15 days, depending on organizer schedule.',
            'For Schools & NGOs',
          ),
          const SizedBox(height: 16),
          _buildOfferingItem(
            '🛠️ Home Tinkering Corner',
            'We help families set up simple, hands-on tinkering spaces that encourage curiosity, problem solving, and real project building at home.',
            'For Young Learners & Parents',
          ),
        ],
      ),
    );
  }

  Widget _buildOfferingItem(String title, String description, String target) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF6C63FF).withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF6C63FF).withOpacity(0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.poppins(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF2C3E50),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: Colors.grey.shade700,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF6C63FF).withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              target,
              style: GoogleFonts.poppins(
                fontSize: 11,
                color: const Color(0xFF6C63FF),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSTEAMLabsSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF11998E), Color(0xFF38EF7D)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.hub, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 12),
              Text(
                'STEAM Labs Network',
                style: GoogleFonts.poppins(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Part of a larger network focused on Science, Technology, Engineering, '
            'Arts, and Mathematics education. We collaborate with schools, '
            'makerspaces, and educational institutions to bring innovative learning '
            'experiences to students.',
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: Colors.white.withOpacity(0.95),
              height: 1.6,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildTag('Science', Colors.white),
              _buildTag('Technology', Colors.white),
              _buildTag('Engineering', Colors.white),
              _buildTag('Arts', Colors.white),
              _buildTag('Mathematics', Colors.white),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTag(String text, Color textColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.3)),
      ),
      child: Text(
        text,
        style: GoogleFonts.poppins(
          fontSize: 12,
          color: textColor,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildAwardsSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.emoji_events, color: Color(0xFFFFA502), size: 28),
              const SizedBox(width: 12),
              Text(
                'Awards & Recognition',
                style: GoogleFonts.poppins(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF2C3E50),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _buildAwardItem(
            'REX Karmaveer Global Fellowship',
            'Karmaveer Chakra Awards by iCONGO in partnership with UN',
            'September 2019',
          ),
          _buildAwardItem(
            'Outstanding Achievement Award',
            'Start-up Award (Social Enterprise) by FMPCCI, Bhopal',
            'August 2017',
          ),
          _buildAwardItem(
            'Dream Start-up Challenge',
            'Jury Award by CII-YI Bhopal',
            'March 2017',
          ),
        ],
      ),
    );
  }

  Widget _buildAwardItem(String title, String description, String date) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFA502).withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFA502).withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFA502).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.star, color: Color(0xFFFFA502), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.poppins(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF2C3E50),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  date,
                  style: GoogleFonts.poppins(
                    fontSize: 11,
                    color: const Color(0xFFFFA502),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContactSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Contact Us',
            style: GoogleFonts.poppins(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF2C3E50),
            ),
          ),
          const SizedBox(height: 16),
          _buildContactItem(Icons.location_on, 'Address',
            'MiniGuru Innovation Pvt Ltd\nUjjain, Madhya Pradesh, 456010, India'),
          const SizedBox(height: 12),
          _buildContactItem(Icons.email, 'Email', 'miniguru.in@gmail.com'),
          const SizedBox(height: 12),
          _buildContactItem(Icons.phone, 'Phone', '+91 93997 56846'),
          const SizedBox(height: 12),
          _buildContactItem(Icons.language, 'Website', 'www.miniguru.in'),
        ],
      ),
    );
  }

  Widget _buildContactItem(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: const Color(0xFF6C63FF), size: 24),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  color: const Color(0xFF2C3E50),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFooter() {
    return Container(
      margin: const EdgeInsets.only(top: 20),
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: Color(0xFF2C3E50),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildSocialButton(Icons.facebook, const Color(0xFF1877F2)),
              const SizedBox(width: 12),
              _buildSocialButton(Icons.play_arrow, const Color(0xFFFF0000)),
              const SizedBox(width: 12),
              _buildSocialButton(Icons.chat, const Color(0xFF1DA1F2)),
              const SizedBox(width: 12),
              _buildSocialButton(Icons.camera_alt, const Color(0xFFE4405F)),
            ],
          ),
          const SizedBox(height: 20),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 20,
            runSpacing: 12,
            children: [
              _buildFooterLink('Terms & Conditions', legalTab: 1),
              _buildFooterLink('Privacy Policy', legalTab: 0),
              _buildFooterLink('Cookie Policy', legalTab: 2),
              _buildFooterLink('Help & Support', legalTab: 3),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            '© 2025 MiniGuru Innovation',
            style: GoogleFonts.poppins(
              fontSize: 12,
              color: Colors.white.withOpacity(0.7),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Part of STEAM Labs Network',
            style: GoogleFonts.poppins(
              fontSize: 11,
              color: Colors.white.withOpacity(0.6),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSocialButton(IconData icon, Color color) {
    return GestureDetector(
      onTap: () {},
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          shape: BoxShape.circle,
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }

  Widget _buildFooterLink(String text, {int legalTab = 3}) {
    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => LegalScreen(initialTab: legalTab))),
      child: Text(
        text,
        style: GoogleFonts.poppins(
          fontSize: 13,
          color: Colors.white.withOpacity(0.9),
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}