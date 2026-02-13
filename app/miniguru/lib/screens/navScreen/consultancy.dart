// lib/screens/navScreen/consultancy.dart

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
  int _selectedService = 0; // 0=T-LAB, 1=Workshops, 2=Home Corner

  // ── CONTACT DETAILS ────────────────────────────────────────────────────
  static const String _phone    = '+919399756846';
  static const String _whatsapp = '919399756846';
  static const String _email    = 'miniguru.in@gmail.com';
  static const String _website  = 'https://www.miniguru.in';

  final List<Map<String, dynamic>> _services = [
    {'label': 'School T-LAB',  'icon': Icons.school},
    {'label': 'Workshops',     'icon': Icons.handyman},
    {'label': 'Home Corner',   'icon': Icons.home_repair_service},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _buildHeader()),
            SliverToBoxAdapter(child: _buildServiceToggle()),
            SliverToBoxAdapter(
              child: Column(
                children: [
                  if (_selectedService == 0) _buildSchoolTLab(),
                  if (_selectedService == 1) _buildWorkshops(),
                  if (_selectedService == 2) _buildHomeTinkering(),
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

  // ── HEADER ─────────────────────────────────────────────────────────────
  Widget _buildHeader() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text('MiniGuru Innovation Pvt Ltd',
                style: GoogleFonts.poppins(
                    fontSize: 11,
                    color: Colors.white,
                    fontWeight: FontWeight.w500)),
          ),
          const SizedBox(height: 12),
          Text('Expert\nConsultancy',
              style: GoogleFonts.poppins(
                  fontSize: 30,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  height: 1.2)),
          const SizedBox(height: 8),
          Text(
            'We design, set up, and support creative STEM learning spaces '
            '— from home tinkering corners to full school T-LABs.',
            style: GoogleFonts.poppins(
                fontSize: 13,
                color: Colors.white.withOpacity(0.85),
                height: 1.5),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _headerStat('23+',   'T-LABs'),
              const SizedBox(width: 20),
              _headerStat('8000+', 'Students'),
              const SizedBox(width: 20),
              _headerStat('200+',  'Workshops'),
              const SizedBox(width: 20),
              _headerStat('5 yrs', 'Experience'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _headerStat(String value, String label) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value,
              style: GoogleFonts.poppins(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.white)),
          Text(label,
              style: GoogleFonts.poppins(
                  fontSize: 10, color: Colors.white.withOpacity(0.75))),
        ],
      );

  // ── SERVICE TOGGLE ──────────────────────────────────────────────────────
  Widget _buildServiceToggle() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFE5E7EB),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: List.generate(_services.length, (i) {
          final sel = _selectedService == i;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedService = i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: sel ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: sel
                      ? [BoxShadow(
                          color: Colors.black.withOpacity(0.07),
                          blurRadius: 4)]
                      : [],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(_services[i]['icon'] as IconData,
                        size: 13,
                        color: sel
                            ? const Color(0xFF3B82F6)
                            : Colors.black45),
                    const SizedBox(width: 4),
                    Text(_services[i]['label'] as String,
                        style: GoogleFonts.poppins(
                            fontSize: 11,
                            fontWeight: sel
                                ? FontWeight.w600
                                : FontWeight.normal,
                            color: sel
                                ? const Color(0xFF3B82F6)
                                : Colors.black45)),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 1 — SCHOOL T-LAB
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildSchoolTLab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Hero banner
        Container(
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [Color(0xFF065F46), Color(0xFF10B981)]),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('School T-LAB Setup',
                            style: GoogleFonts.poppins(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white)),
                        const SizedBox(height: 6),
                        Text(
                          'End-to-end design, installation, and support '
                          'for a world-class Tinkering Laboratory in your school.',
                          style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: Colors.white.withOpacity(0.85),
                              height: 1.45),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text('🏫', style: TextStyle(fontSize: 44)),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _bannerStat('23+',   'T-LABs Setup'),
                  _bannerStat('8000+', 'Students'),
                  _bannerStat('5 yrs', 'Running Strong'),
                ],
              ),
            ],
          ),
        ),

        _sectionTitle('What We Offer', Icons.star_outline),
        _offeringsGrid(),

        _sectionTitle('Our Process', Icons.autorenew),
        _stepCard('01', 'Site Assessment',
            'We visit your school, assess the space, and understand your goals and budget.'),
        _stepCard('02', 'T-LAB Design',
            'Custom lab layout, equipment list, and curriculum plan tailored to your school.'),
        _stepCard('03', 'Installation',
            'Full setup of furniture, tools, safety infrastructure, and signage.'),
        _stepCard('04', 'Teacher Training',
            'Hands-on certified training for teachers to run engaging STEM sessions.'),
        _stepCard('05', 'Curriculum & Support',
            'Monthly project packs, student activity guides, and 1-year ongoing support.'),

        const SizedBox(height: 8),
      ],
    );
  }

  Widget _bannerStat(String v, String l) => Column(children: [
        Text(v,
            style: GoogleFonts.poppins(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.white)),
        Text(l,
            style: GoogleFonts.poppins(
                fontSize: 10, color: Colors.white.withOpacity(0.8)),
            textAlign: TextAlign.center),
      ]);

  Widget _offeringsGrid() {
    final items = [
      {'icon': Icons.design_services_outlined,  'title': 'Space Design',      'desc': 'Ergonomic lab design aligned to ATL & NEP guidelines.'},
      {'icon': Icons.construction_outlined,      'title': 'Equipment & Kits',  'desc': 'Robotics, electronics, arts, and science toolkits.'},
      {'icon': Icons.menu_book_outlined,         'title': 'Curriculum',        'desc': 'Project-based learning modules mapped to school syllabus.'},
      {'icon': Icons.people_outlined,            'title': 'Teacher Training',  'desc': 'Certified STEM facilitator training programme.'},
      {'icon': Icons.headset_mic_outlined,       'title': '1-Year Support',    'desc': 'On-call support, material refills, and programme reviews.'},
      {'icon': Icons.groups_outlined,            'title': 'Student Community', 'desc': 'Students get MiniGuru app access to post and share projects.'},
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 1.35,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
        ),
        itemCount: items.length,
        itemBuilder: (_, i) => Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(items[i]['icon'] as IconData,
                  color: const Color(0xFF10B981), size: 22),
              const SizedBox(height: 6),
              Text(items[i]['title'] as String,
                  style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87)),
              const SizedBox(height: 2),
              Expanded(
                child: Text(items[i]['desc'] as String,
                    style: GoogleFonts.poppins(
                        fontSize: 10, color: Colors.black54),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 2 — WORKSHOPS
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildWorkshops() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Hero banner
        Container(
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [Color(0xFF92400E), Color(0xFFF59E0B)]),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Tinkering Workshops',
                            style: GoogleFonts.poppins(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white)),
                        const SizedBox(height: 6),
                        Text(
                          'Immersive hands-on workshops for students and teachers. '
                          '1 to 15 days — every participant builds a real project.',
                          style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: Colors.white.withOpacity(0.85),
                              height: 1.45),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text('🔧', style: TextStyle(fontSize: 44)),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _bannerStat('200+',  'Workshops Done'),
                  _bannerStat('800+',  'Participants'),
                  _bannerStat('1500+', 'Projects Built'),
                ],
              ),
            ],
          ),
        ),

        _sectionTitle('Workshop Formats', Icons.event_available_outlined),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              _workshopFormatCard(
                emoji: '⚡',
                title: 'Short Workshops',
                duration: '1–3 Days',
                darkBg: false,
                points: [
                  'Introductory STEM sessions',
                  'Single project completion',
                  'Perfect for school events & fests',
                  'For students or teachers',
                ],
              ),
              const SizedBox(height: 12),
              _workshopFormatCard(
                emoji: '🔥',
                title: 'Intensive Workshops',
                duration: '5–15 Days',
                darkBg: true,
                points: [
                  'Deep-dive learning experience',
                  'Multiple projects built',
                  'Design thinking & prototyping',
                  'Ideal for summer / winter camps',
                  'Teacher certification programmes',
                ],
              ),
            ],
          ),
        ),

        _sectionTitle('Workshop Themes', Icons.science_outlined),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              '🤖 Robotics',
              '⚡ Electronics',
              '🎨 Design & Arts',
              '🔬 Science',
              '♻️ Upcycling',
              '💡 Innovation',
              '🏗️ Structures',
              '🌱 Environment',
            ]
                .map((t) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: const Color(0xFFF59E0B).withOpacity(0.5),
                            width: 1.5),
                      ),
                      child: Text(t,
                          style: GoogleFonts.poppins(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: const Color(0xFF92400E))),
                    ))
                .toList(),
          ),
        ),

        _sectionTitle('Who Is It For?', Icons.people_outline),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                  child: _audienceCard('👧', 'Students',
                      'Ages 8–18\nSchool & college level',
                      const Color(0xFFEFF6FF), const Color(0xFF3B82F6))),
              const SizedBox(width: 12),
              Expanded(
                  child: _audienceCard('👩‍🏫', 'Teachers',
                      'STEM facilitator\ncertification focus',
                      const Color(0xFFF0FDF4), const Color(0xFF10B981))),
            ],
          ),
        ),

        const SizedBox(height: 8),
      ],
    );
  }

  Widget _workshopFormatCard({
    required String emoji,
    required String title,
    required String duration,
    required bool darkBg,
    required List<String> points,
  }) {
    final bg        = darkBg ? const Color(0xFF1E3A8A) : const Color(0xFFFDE68A);
    final textColor = darkBg ? Colors.white : const Color(0xFF92400E);
    final checkColor= darkBg ? Colors.white54 : const Color(0xFFF59E0B);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: bg, borderRadius: BorderRadius.circular(14)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 32)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(title,
                      style: GoogleFonts.poppins(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: textColor)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(duration,
                        style: GoogleFonts.poppins(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: textColor)),
                  ),
                ]),
                const SizedBox(height: 8),
                ...points.map((p) => Padding(
                      padding: const EdgeInsets.only(bottom: 5),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.check_circle_rounded,
                              size: 13, color: checkColor),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(p,
                                style: GoogleFonts.poppins(
                                    fontSize: 11,
                                    color: darkBg
                                        ? Colors.white70
                                        : const Color(0xFF92400E))),
                          ),
                        ],
                      ),
                    )),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _audienceCard(
      String emoji, String title, String sub, Color bg, Color accent) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withOpacity(0.2)),
      ),
      child: Column(children: [
        Text(emoji, style: const TextStyle(fontSize: 36)),
        const SizedBox(height: 8),
        Text(title,
            style: GoogleFonts.poppins(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87)),
        const SizedBox(height: 4),
        Text(sub,
            style: GoogleFonts.poppins(
                fontSize: 11, color: Colors.black54, height: 1.4),
            textAlign: TextAlign.center),
      ]),
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 3 — HOME TINKERING CORNER
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildHomeTinkering() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Hero banner
        Container(
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [Color(0xFF4C1D95), Color(0xFF7C3AED)]),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text('Coming Soon',
                          style: GoogleFonts.poppins(
                              fontSize: 10,
                              color: Colors.white,
                              fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(height: 10),
                    Text('Home Tinkering\nCorner',
                        style: GoogleFonts.poppins(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            height: 1.2)),
                    const SizedBox(height: 8),
                    Text(
                      'We help you design and set up a personalised '
                      'tinkering space for your child — right at home.',
                      style: GoogleFonts.poppins(
                          fontSize: 12,
                          color: Colors.white.withOpacity(0.85),
                          height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const Text('🏠', style: TextStyle(fontSize: 52)),
            ],
          ),
        ),

        _sectionTitle('How It Works', Icons.autorenew),
        _stepCard('01', 'Discovery Call',
            'We understand your child\'s interests, age, and the available space at home.'),
        _stepCard('02', 'Custom Design',
            'Our experts design a layout and curated kit list personalised for your child.'),
        _stepCard('03', 'Kit & Guidance',
            'Tools, materials, and project guides delivered with a full setup walkthrough.'),
        _stepCard('04', 'Ongoing Support',
            'Monthly project packs and live guidance sessions to keep the spark alive.'),

        _sectionTitle('Choose Your Plan', Icons.inventory_2_outlined),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _homePlanCard(
                icon: '💻',
                name: 'Virtual\nConsultancy',
                tag: 'Remote',
                tagColor: const Color(0xFF7C3AED),
                highlight: false,
                features: [
                  'Video discovery call',
                  'Custom space design',
                  'Curated kit recommendation',
                  'Project guide pack',
                  'Online support sessions',
                ],
              )),
              const SizedBox(width: 12),
              Expanded(child: _homePlanCard(
                icon: '🤝',
                name: 'In-Person\nConsultancy',
                tag: 'Recommended',
                tagColor: const Color(0xFFF59E0B),
                highlight: true,
                features: [
                  'Home visit & assessment',
                  'On-site space design',
                  'Kit selection & setup',
                  'Hands-on demo session',
                  'Follow-up support visits',
                  'Priority mentor access',
                ],
              )),
            ],
          ),
        ),

        const SizedBox(height: 8),
      ],
    );
  }

  Widget _homePlanCard({
    required String icon,
    required String name,
    required String tag,
    required Color tagColor,
    required bool highlight,
    required List<String> features,
  }) {
    final bg        = highlight ? const Color(0xFF4C1D95) : Colors.white;
    final textColor = highlight ? Colors.white : Colors.black87;
    final subColor  = highlight ? Colors.white60 : Colors.black54;
    final checkColor= highlight ? const Color(0xFFA78BFA) : const Color(0xFF7C3AED);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: highlight ? null : Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: highlight
            ? [BoxShadow(
                color: const Color(0xFF4C1D95).withOpacity(0.3),
                blurRadius: 16,
                offset: const Offset(0, 4))]
            : [],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tag
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: tagColor.withOpacity(highlight ? 0.3 : 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(tag,
                style: GoogleFonts.poppins(
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    color: highlight ? tagColor : tagColor)),
          ),
          const SizedBox(height: 10),
          Text(icon, style: const TextStyle(fontSize: 28)),
          const SizedBox(height: 6),
          Text(name,
              style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: textColor,
                  height: 1.2)),
          const SizedBox(height: 12),
          ...features.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.check_circle_rounded,
                        size: 13, color: checkColor),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(f,
                          style: GoogleFonts.poppins(
                              fontSize: 11,
                              color: subColor,
                              height: 1.3)),
                    ),
                  ],
                ),
              )),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => _launchWhatsApp(
                  'Hi MiniGuru! I am interested in the ${name.replaceAll('\n', ' ')} for my home tinkering corner.'),
              style: ElevatedButton.styleFrom(
                backgroundColor: highlight
                    ? const Color(0xFF7C3AED)
                    : const Color(0xFF4C1D95),
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              child: Text('Enquire Now',
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

  // ══════════════════════════════════════════════════════════════════════
  // CONTACT SECTION
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildContactSection() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)]),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Text('Get In Touch',
              style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white)),
          const SizedBox(height: 4),
          Text('Free consultation — no commitment',
              style: GoogleFonts.poppins(
                  fontSize: 12, color: Colors.white70)),
          const SizedBox(height: 18),

          // Call + WhatsApp
          Row(children: [
            Expanded(
              child: _contactBtn(
                icon: Icons.phone,
                label: 'Call Us',
                bg: Colors.white,
                textColor: const Color(0xFF1E3A8A),
                onTap: () => _launchUrl('tel:$_phone'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _contactBtn(
                icon: Icons.chat,
                label: 'WhatsApp',
                bg: const Color(0xFF25D366),
                textColor: Colors.white,
                onTap: () => _launchWhatsApp(
                    'Hi MiniGuru! I am interested in your consultancy services.'),
              ),
            ),
          ]),

          const SizedBox(height: 12),

          // Email
          GestureDetector(
            onTap: () => _launchUrl('mailto:$_email'),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.email_outlined, color: Colors.white60, size: 14),
              const SizedBox(width: 6),
              Text(_email,
                  style: GoogleFonts.poppins(
                      fontSize: 12, color: Colors.white70)),
            ]),
          ),

          const SizedBox(height: 6),

          // Website
          GestureDetector(
            onTap: () => _launchUrl(_website),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.language, color: Colors.white60, size: 14),
              const SizedBox(width: 6),
              Text('www.miniguru.in',
                  style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.white70,
                      decoration: TextDecoration.underline,
                      decorationColor: Colors.white38)),
            ]),
          ),

          const SizedBox(height: 12),
          const Divider(color: Colors.white24, height: 1),
          const SizedBox(height: 12),

          // Address
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.location_on_outlined,
                color: Colors.white60, size: 14),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                'MiniGuru Innovation Pvt Ltd\n'
                '311, Mahamangal City, Ujjain, MP 456010, India',
                style: GoogleFonts.poppins(
                    fontSize: 11, color: Colors.white60, height: 1.5),
              ),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _contactBtn({
    required IconData icon,
    required String label,
    required Color bg,
    required Color textColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
            color: bg, borderRadius: BorderRadius.circular(10)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, color: textColor, size: 17),
          const SizedBox(width: 7),
          Text(label,
              style: GoogleFonts.poppins(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: textColor)),
        ]),
      ),
    );
  }

  // ── LOGIN CTA ───────────────────────────────────────────────────────────
  Widget _buildLoginCTA() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(children: [
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
      ]),
    );
  }

  // ── SHARED HELPERS ──────────────────────────────────────────────────────
  Widget _sectionTitle(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 22, 16, 12),
      child: Row(children: [
        Icon(icon, size: 18, color: const Color(0xFF3B82F6)),
        const SizedBox(width: 8),
        Text(title,
            style: GoogleFonts.poppins(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.black87)),
      ]),
    );
  }

  Widget _stepCard(String step, String title, String desc) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Center(
            child: Text(step,
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
              Text(title,
                  style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87)),
              const SizedBox(height: 2),
              Text(desc,
                  style: GoogleFonts.poppins(
                      fontSize: 11, color: Colors.black54)),
            ],
          ),
        ),
      ]),
    );
  }

  // ── URL LAUNCHERS ───────────────────────────────────────────────────────
  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _launchWhatsApp(String message) async {
    final url =
        'https://wa.me/$_whatsapp?text=${Uri.encodeComponent(message)}';
    await _launchUrl(url);
  }
}