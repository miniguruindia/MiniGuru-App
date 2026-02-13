// /workspaces/MiniGuru-App/app/miniguru/lib/screens/navScreen/consultancy.dart
// MiniGuru Consultancy Page - For non-logged-in users
// Replaces Library tab for guests

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:miniguru/screens/loginScreen.dart';

class ConsultancyPage extends StatefulWidget {
  const ConsultancyPage({super.key});

  @override
  State<ConsultancyPage> createState() => _ConsultancyPageState();
}

class _ConsultancyPageState extends State<ConsultancyPage> {
  int _selectedService = 0; // 0 = Home Tinkering, 1 = School T-LAB

  final List<Map<String, dynamic>> _services = [
    {'label': 'Home Tinkering Corner', 'icon': Icons.home_repair_service},
    {'label': 'School T-LAB', 'icon': Icons.school},
  ];

  // ── REPLACE THESE WITH YOUR REAL CONTENT ──────────────────────────────

  // CONTACT DETAILS
  static const String _phoneNumber   = '+91 9399756846';   // ← YOUR PHONE
  static const String _whatsappNumber = '919399756846';    // ← WHATSAPP (no +)
  static const String _email         = 'miniguru.in@gmail.com'; // ← YOUR EMAIL
  static const String _websiteUrl    = 'https://miniguru.in'; // ← YOUR WEBSITE

  // HOME TINKERING CORNER
  static const String _homeHeadline  = 'Build a Creative Space at Home';
  static const String _homeSubtitle  = 
      'We help you design and set up a personalised tinkering corner '
      'for your child — right in your home.';

  static const List<Map<String, String>> _homeSteps = [
    {
      'step': '01',
      'title': 'Discovery Call',
      'desc': 'We understand your child\'s interests, age, and available space.',
    },
    {
      'step': '02',
      'title': 'Custom Design',
      'desc': 'Our experts design a layout and curated kit for your space.',
    },
    {
      'step': '03',
      'title': 'Kit Delivery',
      'desc': 'Tools, materials, and project guides delivered to your door.',
    },
    {
      'step': '04',
      'title': 'Ongoing Support',
      'desc': 'Monthly project packs + live guidance sessions with mentors.',
    },
  ];

  static const List<Map<String, String>> _homePackages = [
    {
      'name': 'Starter',
      'price': '₹ XXXX',
      'desc': 'Perfect for beginners aged 8–10',
      'features': 'Discovery Call\nBasic Kit\n3 Project Guides\nEmail Support',
    },
    {
      'name': 'Explorer',
      'price': '₹ XXXX',
      'desc': 'For curious learners aged 10–12',
      'features': 'Discovery Call\nAdvanced Kit\n6 Project Guides\nMonthly Pack\nLive Session',
      'highlight': 'true',
    },
    {
      'name': 'Maker Pro',
      'price': '₹ XXXX',
      'desc': 'For serious makers aged 12–14',
      'features': 'Discovery Call\nPro Kit\n12 Project Guides\nMonthly Pack\n4 Live Sessions\nMentor Access',
    },
  ];

  // SCHOOL T-LAB
  static const String _schoolHeadline = 'Transform Your School with a T-LAB';
  static const String _schoolSubtitle =
      'End-to-end design, setup, and training for a world-class '
      'Tinkering Laboratory in your school.';

  static const List<Map<String, String>> _schoolSteps = [
    {
      'step': '01',
      'title': 'Site Assessment',
      'desc': 'We visit your school, assess space, and understand your goals.',
    },
    {
      'step': '02',
      'title': 'T-LAB Design',
      'desc': 'Custom layout, equipment list, and operating manual for your school.',
    },
    {
      'step': '03',
      'title': 'Installation',
      'desc': 'Full setup of furniture, tools, and safety infrastructure.',
    },
    {
      'step': '04',
      'title': 'Teacher Training',
      'desc': 'Hands-on training for teachers to run engaging STEM sessions.',
    },
    {
      'step': '05',
      'title': 'Handholding Support',
      'desc': 'Monthly project packs and continuous operating guidance.',
    },
  ];

  static const List<Map<String, String>> _schoolOfferings = [
    {
      'icon': 'design',
      'title': 'Space Design',
      'desc': 'Ergonomic, age-appropriate lab design aligned to ATL guidelines.',
    },
    {
      'icon': 'tools',
      'title': 'Equipment & Kits',
      'desc': 'Curated robotics, electronics, arts, and science toolkits.',
    },
    {
      'icon': 'curriculum',
      'title': 'Curriculum',
      'desc': '40+ project-based learning modules mapped to school syllabus.',
    },
    {
      'icon': 'training',
      'title': 'Teacher Training',
      'desc': 'Certified STEM facilitator training programme.',
    },
    {
      'icon': 'support',
      'title': '1-Year Support',
      'desc': 'On-call technical support, refills, and programme reviews.',
    },
    {
      'icon': 'community',
      'title': 'Student Community',
      'desc': 'Access to MiniGuru platform for students to share projects.',
    },
  ];

  static const List<Map<String, String>> _schoolStats = [
    {'value': 'XX+',  'label': 'Schools Served'},
    {'value': 'XX+',  'label': 'Cities'},
    {'value': 'XXXX+','label': 'Students Impacted'},
    {'value': 'XX+',  'label': 'Projects Completed'},
  ];

  // TESTIMONIALS (shared)
  static const List<Map<String, String>> _testimonials = [
    {
      'quote': '"[Add a real parent/teacher testimonial here]"',
      'name': 'Parent Name',
      'role': 'Parent, City',
    },
    {
      'quote': '"[Add a real school testimonial here]"',
      'name': 'Principal Name',
      'role': 'Principal, School Name',
    },
  ];

  // ── END OF CONTENT SECTION ─────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            _buildHeader(),
            SliverToBoxAdapter(
              child: Column(
                children: [
                  _buildServiceToggle(),
                  _selectedService == 0
                      ? _buildHomeTinkeringContent()
                      : _buildSchoolTLabContent(),
                  _buildTestimonials(),
                  _buildContactSection(),
                  _buildLoginCTA(),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── HEADER ────────────────────────────────────────────────────────────
  Widget _buildHeader() {
    return SliverToBoxAdapter(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)],
          ),
        ),
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Expert Consultancy',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'MiniGuru\nConsultancy',
              style: GoogleFonts.poppins(
                fontSize: 30,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'From home tinkering corners to full school T-LABs — '
              'we design, build, and support creative learning spaces.',
              style: GoogleFonts.poppins(
                fontSize: 13,
                color: Colors.white.withOpacity(0.85),
                height: 1.5,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                _buildHeaderStat('500+', 'Happy Families'),
                const SizedBox(width: 24),
                _buildHeaderStat('50+', 'Schools'),
                const SizedBox(width: 24),
                _buildHeaderStat('8+', 'Years'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderStat(String value, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: GoogleFonts.poppins(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 10,
            color: Colors.white.withOpacity(0.75),
          ),
        ),
      ],
    );
  }

  // ── SERVICE TOGGLE ────────────────────────────────────────────────────
  Widget _buildServiceToggle() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFE5E7EB),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: List.generate(_services.length, (i) {
          final selected = _selectedService == i;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedService = i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: selected ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: selected
                      ? [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 4)]
                      : [],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _services[i]['icon'],
                      size: 16,
                      color: selected ? const Color(0xFF3B82F6) : Colors.black54,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        _services[i]['label'],
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                          color: selected ? const Color(0xFF3B82F6) : Colors.black54,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  // ── HOME TINKERING CONTENT ────────────────────────────────────────────
  Widget _buildHomeTinkeringContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Hero image placeholder
        Container(
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          height: 180,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: const Color(0xFFDEEEFF),
          ),
          child: Stack(
            children: [
              // ← REPLACE WITH: Image.asset('assets/home_tinkering.jpg', fit: BoxFit.cover)
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  width: double.infinity,
                  color: const Color(0xFFBFDAFF),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.add_photo_alternate_outlined,
                          size: 40, color: Color(0xFF3B82F6)),
                      const SizedBox(height: 8),
                      Text(
                        'Add hero image here\n(home_tinkering.jpg)',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          color: const Color(0xFF3B82F6),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                bottom: 16, left: 16, right: 16,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.95),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_homeHeadline,
                          style: GoogleFonts.poppins(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Colors.black87)),
                      const SizedBox(height: 4),
                      Text(_homeSubtitle,
                          style: GoogleFonts.poppins(
                              fontSize: 11, color: Colors.black54),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        // How it works
        _buildSectionTitle('How It Works', Icons.autorenew),
        ...List.generate(_homeSteps.length, (i) =>
            _buildStepCard(_homeSteps[i])),

        // Packages
        _buildSectionTitle('Choose Your Package', Icons.inventory_2_outlined),
        SizedBox(
          height: 260,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _homePackages.length,
            itemBuilder: (context, i) => _buildPackageCard(_homePackages[i]),
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  // ── SCHOOL T-LAB CONTENT ──────────────────────────────────────────────
  Widget _buildSchoolTLabContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Hero image placeholder
        Container(
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          height: 180,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: const Color(0xFFD1FAE5),
          ),
          child: Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  width: double.infinity,
                  color: const Color(0xFFA7F3D0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.add_photo_alternate_outlined,
                          size: 40, color: Color(0xFF10B981)),
                      const SizedBox(height: 8),
                      Text(
                        'Add hero image here\n(school_tlab.jpg)',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          color: const Color(0xFF10B981),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                bottom: 16, left: 16, right: 16,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.95),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_schoolHeadline,
                          style: GoogleFonts.poppins(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Colors.black87)),
                      const SizedBox(height: 4),
                      Text(_schoolSubtitle,
                          style: GoogleFonts.poppins(
                              fontSize: 11, color: Colors.black54),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        // Stats
        _buildSchoolStats(),

        // What we offer
        _buildSectionTitle('What We Offer', Icons.star_outline),
        _buildOfferingsGrid(),

        // Process
        _buildSectionTitle('Our Process', Icons.autorenew),
        ...List.generate(_schoolSteps.length, (i) =>
            _buildStepCard(_schoolSteps[i])),

        const SizedBox(height: 8),
      ],
    );
  }

  Widget _buildSchoolStats() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF065F46), Color(0xFF10B981)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: _schoolStats.map((stat) => Column(
          children: [
            Text(stat['value']!,
                style: GoogleFonts.poppins(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Colors.white)),
            Text(stat['label']!,
                style: GoogleFonts.poppins(
                    fontSize: 9,
                    color: Colors.white.withOpacity(0.8)),
                textAlign: TextAlign.center),
          ],
        )).toList(),
      ),
    );
  }

  Widget _buildOfferingsGrid() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 1.4,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
        ),
        itemCount: _schoolOfferings.length,
        itemBuilder: (context, i) {
          final item = _schoolOfferings[i];
          final iconMap = {
            'design':    Icons.design_services_outlined,
            'tools':     Icons.construction_outlined,
            'Operating Manual':Icons.menu_book_outlined,
            'training':  Icons.people_outlined,
            'support':   Icons.headset_mic_outlined,
            'community': Icons.groups_outlined,
          };
          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(iconMap[item['icon']] ?? Icons.star,
                    color: const Color(0xFF10B981), size: 22),
                const SizedBox(height: 6),
                Text(item['title']!,
                    style: GoogleFonts.poppins(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87)),
                const SizedBox(height: 2),
                Expanded(
                  child: Text(item['desc']!,
                      style: GoogleFonts.poppins(
                          fontSize: 10, color: Colors.black54),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 2),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // ── SHARED WIDGETS ────────────────────────────────────────────────────
  Widget _buildSectionTitle(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF3B82F6)),
          const SizedBox(width: 8),
          Text(title,
              style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87)),
        ],
      ),
    );
  }

  Widget _buildStepCard(Map<String, String> step) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(step['step']!,
                  style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF3B82F6))),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(step['title']!,
                    style: GoogleFonts.poppins(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87)),
                const SizedBox(height: 2),
                Text(step['desc']!,
                    style: GoogleFonts.poppins(
                        fontSize: 11, color: Colors.black54)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPackageCard(Map<String, String> pkg) {
    final isHighlight = pkg['highlight'] == 'true';
    return Container(
      width: 180,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isHighlight ? const Color(0xFF1E3A8A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isHighlight
            ? null
            : Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: isHighlight
            ? [BoxShadow(color: const Color(0xFF1E3A8A).withOpacity(0.3),
                blurRadius: 12, offset: const Offset(0, 4))]
            : [],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isHighlight)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFFBBF24),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text('Most Popular',
                  style: GoogleFonts.poppins(
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                      color: Colors.black)),
            ),
          if (isHighlight) const SizedBox(height: 8),
          Text(pkg['name']!,
              style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isHighlight ? Colors.white : Colors.black87)),
          Text(pkg['price']!,
              style: GoogleFonts.poppins(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: isHighlight ? const Color(0xFFFBBF24) : const Color(0xFF3B82F6))),
          const SizedBox(height: 4),
          Text(pkg['desc']!,
              style: GoogleFonts.poppins(
                  fontSize: 10,
                  color: isHighlight ? Colors.white60 : Colors.black54)),
          const Divider(height: 16),
          Expanded(
            child: Text(
              pkg['features']!.replaceAll('\n', '\n• ').replaceAll(
                  pkg['features']!.split('\n').first,
                  '• ${pkg['features']!.split('\n').first}'),
              style: GoogleFonts.poppins(
                  fontSize: 10,
                  color: isHighlight ? Colors.white70 : Colors.black54,
                  height: 1.6),
              overflow: TextOverflow.fade,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTestimonials() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('What People Say', Icons.format_quote),
        SizedBox(
          height: 130,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _testimonials.length,
            itemBuilder: (context, i) {
              final t = _testimonials[i];
              return Container(
                width: 260,
                margin: const EdgeInsets.only(right: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.format_quote,
                        color: Color(0xFF3B82F6), size: 20),
                    const SizedBox(height: 6),
                    Expanded(
                      child: Text(t['quote']!,
                          style: GoogleFonts.poppins(
                              fontSize: 11,
                              color: Colors.black54,
                              fontStyle: FontStyle.italic),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 3),
                    ),
                    const SizedBox(height: 8),
                    Text(t['name']!,
                        style: GoogleFonts.poppins(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.black87)),
                    Text(t['role']!,
                        style: GoogleFonts.poppins(
                            fontSize: 10, color: Colors.black38)),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildContactSection() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Text('Ready to Get Started?',
              style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white)),
          const SizedBox(height: 6),
          Text('Talk to our experts and get a free consultation',
              style: GoogleFonts.poppins(
                  fontSize: 12, color: Colors.white70),
              textAlign: TextAlign.center),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildContactButton(
                  icon: Icons.phone,
                  label: 'Call Us',
                  color: Colors.white,
                  textColor: const Color(0xFF1E3A8A),
                  onTap: () => _launchUrl('tel:$_phoneNumber'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildContactButton(
                  icon: Icons.chat,
                  label: 'WhatsApp',
                  color: const Color(0xFF25D366),
                  textColor: Colors.white,
                  onTap: () => _launchUrl(
                    'https://wa.me/$_whatsappNumber?text=Hi%20MiniGuru!%20I%20am%20interested%20in%20your%20consultancy%20services.',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => _launchUrl('mailto:$_email'),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.email_outlined, color: Colors.white60, size: 14),
                const SizedBox(width: 6),
                Text(_email,
                    style: GoogleFonts.poppins(
                        fontSize: 12, color: Colors.white70)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContactButton({
    required IconData icon,
    required String label,
    required Color color,
    required Color textColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: textColor, size: 18),
            const SizedBox(width: 8),
            Text(label,
                style: GoogleFonts.poppins(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: textColor)),
          ],
        ),
      ),
    );
  }

  Widget _buildLoginCTA() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        children: [
          const Icon(Icons.star, color: Color(0xFFF59E0B), size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Already a MiniGuru member?',
                    style: GoogleFonts.poppins(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87)),
                Text('Login to access your personalised library',
                    style: GoogleFonts.poppins(
                        fontSize: 11, color: Colors.black54)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, LoginScreen.id),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('Login',
                  style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}