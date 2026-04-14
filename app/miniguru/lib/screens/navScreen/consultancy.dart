// lib/screens/navScreen/consultancy.dart
// CMS-wired: header stats + tagline fetched from GET /cms/consultancy

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';

class ConsultancyPage extends StatefulWidget {
  final int initialService;
  const ConsultancyPage({super.key, this.initialService = 0});

  @override
  State<ConsultancyPage> createState() => _ConsultancyPageState();
}

class _ConsultancyPageState extends State<ConsultancyPage> {
  int _selectedService = 0; // 0=T-LAB, 1=Workshops, 2=Home Corner

  // ── CONTACT DETAILS ────────────────────────────────────────────────────
  static const String _phone    = '+919399756846';
  static const String _whatsapp = '919399756846';
  static const String _email    = 'connect@miniguru.in';
  static const String _website  = 'https://www.miniguru.in';

  // ── CMS-driven header values (with hardcoded fallbacks) ────────────────
  final _api = MiniguruApi();
  String _tagline  = 'T-LAB, home tinkering spaces, and workshops — '
                     'built around the Natural Learning Model.';
  String _statTlabs      = '32+';
  String _statStudents   = '10,000+';
  String _statWorkshops  = '200+';
  String _statExperience = '10+ yrs';

  String _tlabBannerTlabs    = '32+';
  String _tlabBannerStudents = '10,000+';
  String _tlabBannerRunning  = '10+ yrs';

  String _wsBannerDone         = '200+';
  String _wsBannerParticipants = '800+';
  String _wsBannerProjects     = '1500+';

  // ── FAQ / ACCORDION STATE ──────────────────────────────────────────────
  final Map<String, bool> _faqOpen = {
    'faq1': false, 'faq2': false, 'faq3': false,
  };
  final Map<String, bool> _profileOpen = {
    'p1': false, 'p2': false, 'p3': false, 'p4': false,
  };

  final List<Map<String, dynamic>> _services = [
    {'label': 'School T-LAB',  'icon': Icons.school},
    {'label': 'Workshops',     'icon': Icons.handyman},
    {'label': 'Home Corner',   'icon': Icons.home_repair_service},
  ];

  @override
  void initState() {
    super.initState();
    _selectedService = widget.initialService;
    _loadCms();
  }

  Future<void> _loadCms() async {
    try {
      final data = await _api.getCmsContent('consultancy');
      if (data == null || !mounted) return;
      setState(() {
        if (data['tagline'] != null) _tagline = data['tagline'].toString();
        final stats = data['stats'] as Map<String, dynamic>?;
        if (stats != null) {
          _statTlabs      = stats['tlabs']?.toString()      ?? _statTlabs;
          _statStudents   = stats['students']?.toString()   ?? _statStudents;
          _statWorkshops  = stats['workshops']?.toString()  ?? _statWorkshops;
          _statExperience = stats['experience']?.toString() ?? _statExperience;
        }
        final tlabStats = data['tlabStats'] as Map<String, dynamic>?;
        if (tlabStats != null) {
          _tlabBannerTlabs    = tlabStats['tlabs']?.toString()    ?? _statTlabs;
          _tlabBannerStudents = tlabStats['students']?.toString() ?? _statStudents;
          _tlabBannerRunning  = tlabStats['running']?.toString()  ?? _statExperience;
        } else {
          _tlabBannerTlabs    = _statTlabs;
          _tlabBannerStudents = _statStudents;
          _tlabBannerRunning  = _statExperience;
        }
        final wsStats = data['workshopStats'] as Map<String, dynamic>?;
        if (wsStats != null) {
          _wsBannerDone         = wsStats['done']?.toString()         ?? _wsBannerDone;
          _wsBannerParticipants = wsStats['participants']?.toString() ?? _wsBannerParticipants;
          _wsBannerProjects     = wsStats['projects']?.toString()     ?? _wsBannerProjects;
        }
      });
    } catch (e) {
      debugPrint('❌ Consultancy CMS load error: $e');
    }
  }

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

  // ══════════════════════════════════════════════════════════════════════
  // HEADER (CMS-wired)
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildHeader() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1B5E20), Color(0xFF2E7D32)],
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
                    fontSize: 11, color: Colors.white, fontWeight: FontWeight.w500)),
          ),
          const SizedBox(height: 12),
          Text('MiniGuru\nConsultancy',
              style: GoogleFonts.poppins(
                  fontSize: 28, fontWeight: FontWeight.bold,
                  color: Colors.white, height: 1.2)),
          const SizedBox(height: 8),
          Text(_tagline,
              style: GoogleFonts.poppins(
                  fontSize: 14,
                  color: Colors.white.withOpacity(0.85),
                  height: 1.55)),
          const SizedBox(height: 20),
          Row(
            children: [
              _headerStat(_statTlabs,      'T-LABs'),
              const SizedBox(width: 20),
              _headerStat(_statStudents,   'Students'),
              const SizedBox(width: 20),
              _headerStat(_statWorkshops,  'Workshops'),
              const SizedBox(width: 20),
              _headerStat(_statExperience, 'Experience'),
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
                  fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
          Text(label,
              style: GoogleFonts.poppins(
                  fontSize: 10, color: Colors.white.withOpacity(0.75))),
        ],
      );

  // ══════════════════════════════════════════════════════════════════════
  // SERVICE TOGGLE (unchanged)
  // ══════════════════════════════════════════════════════════════════════
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
                      ? [BoxShadow(color: Colors.black.withOpacity(0.07), blurRadius: 4)]
                      : [],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(_services[i]['icon'] as IconData,
                        size: 13,
                        color: sel ? const Color(0xFF1B5E20) : Colors.black45),
                    const SizedBox(width: 4),
                    Text(_services[i]['label'] as String,
                        style: GoogleFonts.poppins(
                            fontSize: 11,
                            fontWeight: sel ? FontWeight.w600 : FontWeight.normal,
                            color: sel ? const Color(0xFF1B5E20) : Colors.black45)),
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
        // ── HERO ────────────────────────────────────────────────────────
        Container(
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [Color(0xFF1B5E20), Color(0xFF388E3C)]),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('T-LAB School Setup',
                  style: GoogleFonts.poppins(
                      fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 8),
              Text(
                'A tinkering community where children govern their own space, '
                'work on their own projects, and learn by making real things.',
                style: GoogleFonts.poppins(
                    fontSize: 15, color: Colors.white.withOpacity(0.95), height: 1.5),
              ),
              const SizedBox(height: 14),
              Text(
                'T-LAB is not a programme you implement. It is a community you grow — '
                'alongside children who elect their own teams, manage their own economy, '
                'and make things that genuinely matter to them. We have spent 10 years '
                'learning how to build this. We will spend a year alongside you, learning '
                'how to build yours.',
                style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: Colors.white.withOpacity(0.85),
                    height: 1.6),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _bannerStat(_tlabBannerTlabs,    'T-LABs Built'),
                  _bannerStat(_tlabBannerStudents, 'Students'),
                  _bannerStat(_tlabBannerRunning,  'Years Running'),
                ],
              ),
            ],
          ),
        ),

        // ── WHAT MAKES T-LAB DIFFERENT ───────────────────────────────────
        _sectionTitle('What Makes T-LAB Different', Icons.compare_arrows_outlined),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(children: [
            _differentiatorCard(
              icon: Icons.groups_outlined,
              iconColor: const Color(0xFF1B5E20),
              title: 'Children Run It',
              body: 'An elected Planning Team manages weekly meetings. A Finance Team '
                  'runs the Goin economy. A Material Team oversees tools and resources. '
                  'Children hold real authority — and develop real responsibility.',
            ),
            const SizedBox(height: 12),
            _differentiatorCard(
              assetIcon: 'assets/Goine.png',
              iconColor: const Color(0xFFE8A000),
              title: 'A Real Economy',
              body: 'The Goin is T-LAB\'s internal currency. Children earn Goins for '
                  'making and sharing, spend them on materials, and negotiate the value '
                  'of their finished projects with peers. Economics — lived, not taught.',
            ),
            const SizedBox(height: 12),
            _differentiatorCard(
              icon: Icons.dashboard_outlined,
              iconColor: const Color(0xFF1565C0),
              title: 'Every Project Is Theirs',
              body: 'No assigned tasks. No required topics. Every child chooses what to '
                  'make, plans it, builds it, fails, iterates, and presents it on a '
                  'Sharing schedule. The facilitator supports — but never directs.',
            ),
          ]),
        ),

        // ── WHAT WE OFFER ────────────────────────────────────────────────
        _sectionTitle('What We Offer', Icons.star_outline),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(children: [
            _offerCard(
              icon: Icons.space_dashboard_outlined,
              title: 'Space Design',
              body: 'A T-LAB layout tailored to your room, your children, and your '
                  'community. Six functional zones — Workstations, Material Storage, '
                  'Planning Board, T-LAB Bank, Sharing Desk, and Meeting Circle — '
                  'each designed for a specific purpose.',
            ),
            const SizedBox(height: 10),
            _offerCard(
              icon: Icons.construction_outlined,
              title: 'Materials & Tools',
              body: 'A curated kit across five domains: Electricity & Electronics, '
                  'Mechanics, Soft Cutting (craft and art), Hard Cutting (wood and '
                  'fabrication), and General Science (Chem/Bio). Includes storage for '
                  'scrap materials.',
            ),
            const SizedBox(height: 10),
            _offerCard(
              icon: Icons.menu_book_outlined,
              title: 'The T-LAB Handbook',
              body: 'Every system documented for your facilitator — the Goin economy, '
                  'governance and elections, the planning board, Sharing protocol, and '
                  'the facilitation approach. Your lab\'s complete operating guide.',
            ),
            const SizedBox(height: 10),
            _offerCard(
              icon: Icons.person_outlined,
              title: 'Facilitator Orientation & Mentorship',
              body: 'A detailed orientation on T-LAB\'s facilitation approach — how to '
                  'observe, ask generative questions, and hold space without instructing. '
                  'Ongoing mentorship and reflection support throughout the first year.',
            ),
            const SizedBox(height: 10),
            _offerCard(
              icon: Icons.calendar_month_outlined,
              title: 'Year-Long Partnership',
              body: 'Regular onsite visits throughout the year, remote support between '
                  'visits, facilitator reflection sessions, and connection to the T-LAB '
                  'network across India. The goal: a lab that runs itself.',
            ),
            const SizedBox(height: 10),
            _offerCard(
              icon: Icons.phone_android_outlined,
              title: 'MiniGuru Community Access',
              body: 'Every child in your T-LAB joins the MiniGuru network — documenting '
                  'their projects, sharing with children in other T-LAB schools and STEAM '
                  'spaces, and connecting with a community of young makers across India.',
            ),
          ]),
        ),

        // ── OUR PROCESS ──────────────────────────────────────────────────
        _sectionTitle('Our Process', Icons.autorenew),
        _processStep('01', const Color(0xFF1B5E20),
            'Understanding Your School',
            'We spend time in your school — meeting teachers, conducting a workshop '
            'with children to make them co-creators, assessing the space, and '
            'learning what matters to your community. T-LAB adapts to context. '
            'This step ensures the adaptation is right.'),
        _processStep('02', const Color(0xFF2E7D32),
            'Designing Your T-LAB',
            'A space layout, material list, and session structure tailored to your '
            'room, your children, and your school\'s rhythm — designed with your '
            'team, not for them. Children participate in designing their own space '
            'and begin collecting scrap materials.'),
        _processStep('03', const Color(0xFF388E3C),
            'Setting Up & Launching',
            'The physical space comes together: shelves, tools, planning board, '
            'material bank. The launch includes a 3–4 day tinkering workshop where '
            'children elect their representatives, take charge, and experience '
            'T-LAB for the first time — helping shape what it will become.'),
        _processStep('04', const Color(0xFF43A047),
            'Facilitator Orientation',
            'An orientation on T-LAB\'s facilitation approach — not how to teach, '
            'but how to observe, question, and trust. The facilitator receives the '
            'full handbook and begins a mentored practice period alongside our team. '
            'This is an evolution of facilitation, not a one-time training.'),
        _processStep('05', const Color(0xFF4CAF50),
            'Building Momentum Together',
            'The lab begins. We visit regularly throughout the year, organise local '
            'and online events, reflect with your facilitator, help solve problems '
            'that emerge, and connect your school to the wider T-LAB network. '
            'The goal: a lab that runs itself.'),

        // ── INVESTMENT ───────────────────────────────────────────────────
        _sectionTitle('Investment', Icons.account_balance_wallet_outlined),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'T-LAB setup costs vary by school size, space, and material context. '
                'The figures below are a guide for 2025–26. We have worked with '
                'government schools, NGOs, and private schools — the model adapts '
                'to budget and context.',
                style: GoogleFonts.poppins(
                    fontSize: 13, color: Colors.black54, height: 1.6),
              ),
              const SizedBox(height: 16),
              _investmentCard(
                label: 'One-Time Setup',
                icon: Icons.build_outlined,
                description: 'Room preparation, furniture, tools, and initial material '
                    'kit (school-managed procurement under our guidance)',
                amount: '₹80,000 – ₹1,50,000',
                note: 'Varies by room size and existing resources. Excludes room '
                    'renovation and decoration.',
                amountColor: const Color(0xFF1B5E20),
              ),
              const SizedBox(height: 10),
              _investmentCard(
                label: 'Year-Long Partnership',
                icon: Icons.handshake_outlined,
                description: 'Consultancy fee covering all visits, facilitator '
                    'orientation, remote support, handbook, and MiniGuru school access',
                amount: 'On enquiry',
                note: 'Travel, food, and accommodation for onsite visits arranged by school.',
                amountColor: const Color(0xFF1B5E20),
                isEnquiry: true,
              ),
              const SizedBox(height: 10),
              _investmentCard(
                label: 'Monthly Running',
                icon: Icons.loop_outlined,
                description: 'Consumable materials replenishment, managed by the school '
                    '',
                amount: '₹5,000 – ₹10,000 / month',
                note: 'Facilitator is appointed by and on the payroll of the school.',
                amountColor: const Color(0xFF1B5E20),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F8F1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFA5D6A7)),
                ),
                child: Text(
                  '"We have implemented T-LAB in government schools with minimal budgets '
                  'and in private schools with dedicated spaces. The philosophy does not '
                  'change. The materials adapt to what is available."',
                  style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontStyle: FontStyle.italic,
                      color: const Color(0xFF2E7D32),
                      height: 1.6),
                ),
              ),
            ],
          ),
        ),

        // ── EVIDENCE ─────────────────────────────────────────────────────
        _sectionTitle('T-LAB Across India', Icons.place_outlined),
        SizedBox(
          height: 150,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _evidenceCard('Jinglebell School',
                  'Faizabad, UP',
                  '4-year run · 100 students/week'),
              _evidenceCard('Aga Khan Foundation',
                  '17 govt. schools, Bihar',
                  '2022–23 implementation'),
              _evidenceCard('Sunbeam School',
                  'Mugalsarai, UP',
                  '2+ years · 200 students/week'),
              _evidenceCard('Sahyadri School (KFI)',
                  'Pune, MH',
                  'Ongoing since 2024 · Residential'),
              _evidenceCard('28+ more schools',
                  'MP · UP · MH · GJ',
                  'Across India, ongoing'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.only(left: 16),
                decoration: const BoxDecoration(
                  border: Border(
                      left: BorderSide(color: Color(0xFF1B5E20), width: 4)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '"T-LAB is a living testimony of what can be achieved when '
                      'grown-ups show respect and trust in the genuineness of '
                      'children\'s efforts."',
                      style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontStyle: FontStyle.italic,
                          color: Colors.black87,
                          height: 1.6),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '— Dr. Anish Mokashi, IISc / APU Bangalore (after visiting T-LAB)',
                      style: GoogleFonts.poppins(
                          fontSize: 12,
                          color: Colors.black45,
                          fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => _launchUrl(
                    'https://photos.app.goo.gl/nJDG4s6FTt5KCDCLA'),
                child: Row(children: [
                  const Icon(Icons.photo_library_outlined,
                      size: 16, color: Color(0xFF1B5E20)),
                  const SizedBox(width: 6),
                  Text('View T-LAB photo gallery',
                      style: GoogleFonts.poppins(
                          fontSize: 13,
                          color: const Color(0xFF1B5E20),
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                          decorationColor: const Color(0xFF1B5E20))),
                ]),
              ),
            ],
          ),
        ),

        // ── CTA ──────────────────────────────────────────────────────────
        Container(
          margin: const EdgeInsets.fromLTRB(16, 24, 16, 0),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F8F1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFA5D6A7)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Ready to build a T-LAB in your school?',
                  style: GoogleFonts.poppins(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF1B5E20))),
              const SizedBox(height: 8),
              Text(
                'The first conversation is always about your school — your children, '
                'your space, your context. No commitment required.',
                style: GoogleFonts.poppins(
                    fontSize: 13, color: Colors.black54, height: 1.5),
              ),
              const SizedBox(height: 18),
              Row(children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _launchWhatsApp(
                        'Hello MiniGuru! I am interested in setting up a T-LAB '
                        'in my school. I would like to start a conversation.'),
                    icon: const Icon(Icons.chat, size: 16),
                    label: Text('Start the Conversation',
                        style: GoogleFonts.poppins(
                            fontSize: 13, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1B5E20),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ]),
            ],
          ),
        ),

        const SizedBox(height: 8),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 2 — WORKSHOPS
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildWorkshops() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [Color(0xFF92400E), Color(0xFFF59E0B)]),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Tinkering Workshops',
                          style: GoogleFonts.poppins(
                              fontSize: 20, fontWeight: FontWeight.bold,
                              color: Colors.white)),
                      const SizedBox(height: 8),
                      Text(
                        'Immersive, open-ended workshops where every participant '
                        'makes a real project. 1 to 15 days — no kits, no instructions, '
                        'real materials and real learning.',
                        style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: Colors.white.withOpacity(0.9),
                            height: 1.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                const Text('🔧', style: TextStyle(fontSize: 44)),
              ]),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _bannerStat(_wsBannerDone,         'Workshops Done'),
                  _bannerStat(_wsBannerParticipants, 'Participants'),
                  _bannerStat(_wsBannerProjects,     'Projects Built'),
                ],
              ),
            ],
          ),
        ),

        _sectionTitle('Workshop Formats', Icons.event_available_outlined),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(children: [
            _workshopFormatCard(
              emoji: '⚡',
              title: 'Short Workshops',
              duration: '1–3 Days',
              darkBg: false,
              points: [
                'Introductory open-ended STEAM sessions',
                'Every participant completes and shares a project',
                'Ideal for school events, fests, and orientation days',
                'Available for students and teachers',
              ],
            ),
            const SizedBox(height: 12),
            _workshopFormatCard(
              emoji: '🔥',
              title: 'Intensive Workshops',
              duration: '5–15 Days',
              darkBg: true,
              points: [
                'Deep-dive making experience across multiple sessions',
                'Multiple projects built, iterated, and shared',
                'Design thinking and hands-on prototyping',
                'Ideal for summer and winter camps',
                'Teacher orientation and facilitator enrichment programmes',
              ],
            ),
          ]),
        ),

        

        _sectionTitle('Who Is It For?', Icons.people_outline),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            Expanded(
                child: _audienceCard('👧', 'Students', 'Ages 8–14\nSchool level',
                    const Color(0xFFFFF8F0), const Color(0xFFF59E0B))),
            const SizedBox(width: 12),
            Expanded(
                child: _audienceCard('👩‍🏫', 'Teachers',
                    'STEAM facilitator\nenrichment focus',
                    const Color(0xFFF1F8F1), const Color(0xFF1B5E20))),
          ]),
        ),

        Container(
          margin: const EdgeInsets.fromLTRB(16, 24, 16, 0),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF8F0),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFFDE68A)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Interested in a workshop?',
                  style: GoogleFonts.poppins(
                      fontSize: 15, fontWeight: FontWeight.bold,
                      color: const Color(0xFF92400E))),
              const SizedBox(height: 6),
              Text(
                'Tell us your school, the number of participants, and dates. '
                'We will suggest the right format.',
                style: GoogleFonts.poppins(
                    fontSize: 13, color: Colors.black54, height: 1.5),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _launchWhatsApp(
                      'Hello MiniGuru! I am interested in booking a tinkering workshop.'),
                  icon: const Icon(Icons.chat, size: 16),
                  label: Text('WhatsApp Us',
                      style: GoogleFonts.poppins(
                          fontSize: 13, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF25D366),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 8),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 3 — HOME TINKERING CORNER
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildHomeTinkering() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── HERO ────────────────────────────────────────────────────────
        Container(
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [Color(0xFF4C1D95), Color(0xFF7C3AED)]),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('A Tinkering Corner for Your Child — At Home',
                          style: GoogleFonts.poppins(
                              fontSize: 20, fontWeight: FontWeight.bold,
                              color: Colors.white, height: 1.3)),
                      const SizedBox(height: 8),
                      Text(
                        'Designed around their specific curiosity.\n'
                        'Not a kit. Not a toy corner. A real making space.',
                        style: GoogleFonts.poppins(
                            fontSize: 14,
                            color: Colors.white.withOpacity(0.95),
                            fontWeight: FontWeight.w600,
                            height: 1.4),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                const Text('🏠', style: TextStyle(fontSize: 44)),
              ]),
              const SizedBox(height: 12),
              Text(
                'Every child has something they are quietly drawn to — circuits and '
                'electricity, clay and sculpture, wood and construction, science and '
                'experiment. Most homes have nowhere for that curiosity to go. A '
                'tinkering corner gives it a place. We help you design the right space, '
                'choose the right materials, and set it up so that your child is '
                'invited to make — and keeps coming back.',
                style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: Colors.white.withOpacity(0.85),
                    height: 1.6),
              ),
            ],
          ),
        ),

        // ── WHY A DEDICATED SPACE ────────────────────────────────────────
        _sectionTitle('Why a Dedicated Space?', Icons.lightbulb_outline),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(children: [
            _whyCard(Icons.location_on_outlined, 'A Space Signals Permission',
                'When a child has their own corner — their own tools, their own '
                'materials, their own space — it signals something important: this '
                'is real. Your making matters. That signal changes how they engage.'),
            const SizedBox(height: 10),
            _whyCard(Icons.lightbulb_outlined, 'Materials Invite Ideas',
                'The right materials in view spark projects that wouldn\'t otherwise '
                'arrive. A child who can see wire, clay, cardboard, and small motors '
                'is already planning something.'),
            const SizedBox(height: 10),
            _whyCard(Icons.loop_outlined, 'Continuity Builds Depth',
                'The best making happens over multiple sessions — returning to a '
                'project, rebuilding after failure, trying a different approach. '
                'A permanent corner makes this possible in a way that a one-off '
                'kit or activity never can.'),
          ]),
        ),

        // ── HOW IT WORKS ─────────────────────────────────────────────────
        _sectionTitle('How It Works', Icons.autorenew),
        _homeStep('01', const Color(0xFF4C1D95),
            'A Conversation — With Your Child',
            'We begin with a short call with you and your child together. What is '
            'your child curious about? What do they like to make, take apart, or '
            'experiment with? What space is available at home? The child\'s voice '
            'shapes everything that follows.',
            callout: 'The corner must belong to your child, not to the parent\'s idea '
                'of what their child should be interested in. This first conversation '
                'ensures it does.'),
        _homeStep('02', const Color(0xFF6D28D9),
            'Your Space & Materials Plan',
            'Based on the conversation, we design a simple layout for the available '
            'space — even a corner of a room or a single dedicated shelf works — '
            'and a curated materials list matched to your child\'s interests. '
            'Not a generic kit. A specific starter collection for specific ideas.'),
        _homeStep('03', const Color(0xFF7C3AED),
            'Setting Up',
            'Materials arrive with a setup guide, age-appropriate safety notes for '
            'parents, and a first-project suggestion to help the corner come alive '
            'immediately. For families in Bhopal, Ujjain, Pune, or nearby cities, '
            'we offer an optional in-person setup session.'),
        _homeStep('04', const Color(0xFF8B5CF6),
            'Staying Connected',
            'Periodic check-in calls where your child shares what they have made, '
            'gets suggestions for what to try next, and connects with the MiniGuru '
            'community of young makers. We stay involved for as long as it is useful.'),

        // ── PLANS ────────────────────────────────────────────────────────
        _sectionTitle('Plans', Icons.inventory_2_outlined),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(children: [
            // Plan 2 first (most popular)
            _homePlanCard(
              icon: '💻',
              name: 'Full Virtual Support',
              tag: 'Most Popular',
              tagColor: const Color(0xFFF59E0B),
              highlight: true,
              price: '₹3,999',
              bestFor: 'Families who want ongoing guidance',
              features: [
                '45-minute video discovery call (parent + child)',
                'Custom space design sketch',
                'Curated materials list with sourcing guide',
                'Monthly 30-min video calls for 6 months',
                'WhatsApp support as questions arise',
                'MiniGuru community access — 6 months',
                'Project review and suggestions after each sharing',
              ],
              ctaLabel: 'Book Full Support',
              ctaMessage: 'Hello MiniGuru! I want to book the Full Virtual Support plan.',
            ),
            const SizedBox(height: 12),
            _homePlanCard(
              icon: '📱',
              name: 'Virtual Setup',
              tag: 'Starter',
              tagColor: const Color(0xFF7C3AED),
              highlight: false,
              price: '₹1,499',
              bestFor: 'Families anywhere in India',
              features: [
                '45-minute video discovery call (parent + child)',
                'Custom space design sketch',
                'Curated materials list with sourcing guide',
                'One follow-up call after setup (30 min)',
                'MiniGuru community access — 3 months',
              ],
              ctaLabel: 'Book Virtual Setup',
              ctaMessage: 'Hello MiniGuru! I want to book the Virtual Setup plan.',
            ),
            const SizedBox(height: 12),
            _homePlanCard(
              icon: '🤝',
              name: 'In-Person Setup',
              tag: 'Select Cities',
              tagColor: const Color(0xFF059669),
              highlight: false,
              price: '₹6,999 + travel',
              bestFor: 'Families in Bhopal, Ujjain, Pune and nearby areas',
              features: [
                'Everything in Full Virtual Support',
                '2-hour in-person setup session at your home',
                'First making session with your child on the day',
                '3 in-person follow-up visits (monthly)',
              ],
              ctaLabel: 'Enquire for In-Person',
              ctaMessage: 'Hello MiniGuru! I am interested in the In-Person Setup. '
                  'Please let me know if it is available in my city.',
            ),
          ]),
        ),

        // ── WHAT GOES IN THE CORNER ──────────────────────────────────────
        _sectionTitle('What a Tinkering Corner Typically Contains',
            Icons.category_outlined),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Every corner is different — designed around your child. '
                'Here are the kinds of materials suited to different interest profiles:',
                style: GoogleFonts.poppins(
                    fontSize: 13, color: Colors.black54, height: 1.6),
              ),
              const SizedBox(height: 12),
              _profileAccordion('p1', '⚡ Circuits & Electronics',
                  'Copper wire, LEDs, AA batteries and holders, small switches, a basic '
                  'motor, and a multimeter. Starts with simple circuits. Grows toward '
                  'sensors and Arduino as confidence builds.'),
              _profileAccordion('p2', '🎨 Clay, Craft & Making',
                  'Air-dry clay, cardboard, scissors, paints, fabric scraps, hot glue '
                  '(with safety guidance), and wire for armatures. Starts with free '
                  'modelling. Grows toward structured and mixed-media projects.'),
              _profileAccordion('p3', '🪵 Wood & Mechanics',
                  'Scrap wood offcuts, bamboo, ice cream sticks, sandpaper, hammer, '
                  'nails, rubber bands, and pulleys. Starts with simple structures. '
                  'Grows toward working mechanical models.'),
              _profileAccordion('p4', '🔬 Science & Experiment',
                  'Measuring tools, pH strips, magnifying glass, small containers, '
                  'plant pots and seeds, and basic chemistry materials (vinegar, '
                  'baking soda, turmeric). Starts with observation. Grows toward '
                  'designed investigations.'),
              const SizedBox(height: 12),
              Text(
                'Most children eventually cross all four profiles. '
                'The starting collection gives them somewhere to begin.',
                style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: Colors.black45,
                    fontStyle: FontStyle.italic,
                    height: 1.5),
              ),
            ],
          ),
        ),

        // ── PARENT FAQ ───────────────────────────────────────────────────
        _sectionTitle('Parent FAQ', Icons.help_outline),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(children: [
            _faqAccordion('faq1',
                "My child doesn't know what they want to make. Is that okay?",
                'Yes — and it is completely normal. Most children who have spent years '
                'in structured school settings have lost practice in following their own '
                'curiosity. The first sessions of any tinkering space often involve '
                'looking, handling materials, and waiting. This is the beginning of '
                'learning, not the absence of it. It passes.'),
            _faqAccordion('faq2',
                'What if my child loses interest after a few weeks?',
                'Some children need more time to find the project that captures them. '
                'If the corner isn\'t working, we talk through what might be different '
                '— different materials, a different arrangement, a new project trigger. '
                'Our follow-up support is specifically designed for this moment.'),
            _faqAccordion('faq3',
                'Is this safe for younger children?',
                'Yes, with age-appropriate materials. We tailor every materials list '
                'to the child\'s age and supervise the introduction of tools through '
                'the setup process. All plans include safety guidance for parents. '
                'For children under 8, we begin with craft, clay, and basic '
                'construction — and introduce electronics and sharp tools gradually.'),
          ]),
        ),

        // ── CTA ──────────────────────────────────────────────────────────
        Container(
          margin: const EdgeInsets.fromLTRB(16, 24, 16, 0),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F3FF),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFDDD6FE)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Start with a conversation',
                  style: GoogleFonts.poppins(
                      fontSize: 17, fontWeight: FontWeight.bold,
                      color: const Color(0xFF4C1D95))),
              const SizedBox(height: 8),
              Text(
                'Tell us about your child — their age, what they are curious about '
                'right now, and what space you have at home. We will suggest the '
                'right starting point.',
                style: GoogleFonts.poppins(
                    fontSize: 13, color: Colors.black54, height: 1.5),
              ),
              const SizedBox(height: 18),
              Row(children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => _launchWhatsApp(
                        'Hello MiniGuru! I would like to book a discovery call '
                        'for a home tinkering corner for my child.'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4C1D95),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text('Book a Discovery Call',
                        style: GoogleFonts.poppins(
                            fontSize: 13, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _launchWhatsApp(
                        'Hello MiniGuru! I am interested in setting up a '
                        'home tinkering corner for my child.'),
                    icon: const Icon(Icons.chat, size: 16),
                    label: Text('WhatsApp Us',
                        style: GoogleFonts.poppins(
                            fontSize: 13, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ]),
            ],
          ),
        ),

        const SizedBox(height: 8),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // CONTACT SECTION (unchanged structure)
  // ══════════════════════════════════════════════════════════════════════
  Widget _buildContactSection() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            colors: [Color(0xFF1B5E20), Color(0xFF2E7D32)]),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(children: [
        Text('Get In Touch',
            style: GoogleFonts.poppins(
                fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 4),
        Text('Free first conversation — no commitment',
            style: GoogleFonts.poppins(fontSize: 12, color: Colors.white70)),
        const SizedBox(height: 18),
        Row(children: [
          Expanded(
            child: _contactBtn(
              icon: Icons.phone,
              label: 'Call Us',
              bg: Colors.white,
              textColor: const Color(0xFF1B5E20),
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
                  'Hello MiniGuru! I am interested in your consultancy services.'),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: () => _launchUrl('mailto:$_email'),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.email_outlined, color: Colors.white60, size: 14),
            const SizedBox(width: 6),
            Text(_email,
                style: GoogleFonts.poppins(fontSize: 12, color: Colors.white70)),
          ]),
        ),
        const SizedBox(height: 6),
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
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.location_on_outlined, color: Colors.white60, size: 14),
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
      ]),
    );
  }

  Widget _contactBtn({
    required IconData icon, required String label,
    required Color bg, required Color textColor, required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, color: textColor, size: 17),
          const SizedBox(width: 7),
          Text(label,
              style: GoogleFonts.poppins(
                  fontSize: 13, fontWeight: FontWeight.w600, color: textColor)),
        ]),
      ),
    );
  }

  // ── LOGIN CTA (unchanged) ───────────────────────────────────────────────
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
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Already a MiniGuru member?',
                style: GoogleFonts.poppins(
                    fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black87)),
            Text('Login to access your personalised project library',
                style: GoogleFonts.poppins(fontSize: 11, color: Colors.black54)),
          ]),
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
                    fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
          ),
        ),
      ]),
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // SHARED HELPERS
  // ══════════════════════════════════════════════════════════════════════
  Widget _sectionTitle(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 22, 16, 12),
      child: Row(children: [
        Icon(icon, size: 18, color: const Color(0xFF1B5E20)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(title,
              style: GoogleFonts.poppins(
                  fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87)),
        ),
      ]),
    );
  }

  Widget _bannerStat(String v, String l) => Column(children: [
        Text(v,
            style: GoogleFonts.poppins(
                fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
        Text(l,
            style: GoogleFonts.poppins(
                fontSize: 10, color: Colors.white.withOpacity(0.8)),
            textAlign: TextAlign.center),
      ]);

  Widget _differentiatorCard({
    IconData? icon, String? assetIcon, required Color iconColor,
    required String title, required String body,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10)),
          child: assetIcon != null
              ? Padding(
                  padding: const EdgeInsets.all(8),
                  child: Image.asset(assetIcon,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) =>
                          Icon(Icons.monetization_on, color: iconColor)))
              : Icon(icon, color: iconColor, size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: GoogleFonts.poppins(
                    fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black87)),
            const SizedBox(height: 4),
            Text(body,
                style: GoogleFonts.poppins(
                    fontSize: 12, color: Colors.black54, height: 1.55)),
          ]),
        ),
      ]),
    );
  }

  Widget _offerCard({
    required IconData icon, required String title, required String body,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: const Color(0xFF1B5E20), size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: GoogleFonts.poppins(
                    fontSize: 13, fontWeight: FontWeight.w700, color: Colors.black87)),
            const SizedBox(height: 4),
            Text(body,
                style: GoogleFonts.poppins(
                    fontSize: 12, color: Colors.black54, height: 1.55)),
          ]),
        ),
      ]),
    );
  }

  Widget _processStep(String step, Color color, String title, String desc) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10)),
          child: Center(
            child: Text(step,
                style: GoogleFonts.poppins(
                    fontSize: 13, fontWeight: FontWeight.bold, color: color)),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: GoogleFonts.poppins(
                    fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black87)),
            const SizedBox(height: 4),
            Text(desc,
                style: GoogleFonts.poppins(
                    fontSize: 12, color: Colors.black54, height: 1.55)),
          ]),
        ),
      ]),
    );
  }

  Widget _investmentCard({
    required String label, required IconData icon,
    required String description, required String amount,
    required String note, required Color amountColor, bool isEnquiry = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE0E0E0)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(icon, size: 18, color: const Color(0xFF1B5E20)),
          const SizedBox(width: 8),
          Text(label,
              style: GoogleFonts.poppins(
                  fontSize: 13, fontWeight: FontWeight.w700, color: Colors.black87)),
        ]),
        const SizedBox(height: 6),
        Text(description,
            style: GoogleFonts.poppins(fontSize: 12, color: Colors.black54, height: 1.5)),
        const SizedBox(height: 10),
        Row(children: [
          Text(amount,
              style: GoogleFonts.poppins(
                  fontSize: 16, fontWeight: FontWeight.bold, color: amountColor)),
          if (isEnquiry) ...[
            const SizedBox(width: 10),
            GestureDetector(
              onTap: () => _launchWhatsApp(
                  'Hello MiniGuru! I would like to know about the year-long '
                  'T-LAB partnership fee for my school.'),
              child: Text('Contact us →',
                  style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: const Color(0xFF1B5E20),
                      fontWeight: FontWeight.w600,
                      decoration: TextDecoration.underline,
                      decorationColor: const Color(0xFF1B5E20))),
            ),
          ],
        ]),
        const SizedBox(height: 6),
        Text(note,
            style: GoogleFonts.poppins(
                fontSize: 11, color: Colors.black38,
                fontStyle: FontStyle.italic)),
      ]),
    );
  }

  Widget _evidenceCard(String name, String location, String detail) {
    return Container(
      width: 200,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(name,
            style: GoogleFonts.poppins(
                fontSize: 13, fontWeight: FontWeight.bold, color: Colors.black87)),
        const SizedBox(height: 4),
        Text(location,
            style: GoogleFonts.poppins(fontSize: 11, color: const Color(0xFF1B5E20),
                fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Text(detail,
            style: GoogleFonts.poppins(fontSize: 11, color: Colors.black45, height: 1.4)),
      ]),
    );
  }

  Widget _whyCard(IconData icon, String title, String body) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F3FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFDDD6FE)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
              color: const Color(0xFFEDE9FE),
              borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: const Color(0xFF4C1D95), size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: GoogleFonts.poppins(
                    fontSize: 13, fontWeight: FontWeight.w700, color: Colors.black87)),
            const SizedBox(height: 4),
            Text(body,
                style: GoogleFonts.poppins(
                    fontSize: 12, color: Colors.black54, height: 1.55)),
          ]),
        ),
      ]),
    );
  }

  Widget _homeStep(String step, Color color, String title, String desc,
      {String? callout}) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10)),
            child: Center(
              child: Text(step,
                  style: GoogleFonts.poppins(
                      fontSize: 13, fontWeight: FontWeight.bold, color: color)),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  style: GoogleFonts.poppins(
                      fontSize: 13, fontWeight: FontWeight.w600,
                      color: Colors.black87)),
              const SizedBox(height: 4),
              Text(desc,
                  style: GoogleFonts.poppins(
                      fontSize: 12, color: Colors.black54, height: 1.55)),
            ]),
          ),
        ]),
        if (callout != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F8F1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFA5D6A7)),
            ),
            child: Text('"$callout"',
                style: GoogleFonts.poppins(
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                    color: const Color(0xFF2E7D32),
                    height: 1.5)),
          ),
        ],
      ]),
    );
  }

  Widget _homePlanCard({
    required String icon, required String name, required String tag,
    required Color tagColor, required bool highlight, required String price,
    required String bestFor, required List<String> features,
    required String ctaLabel, required String ctaMessage,
  }) {
    final bg = highlight ? const Color(0xFF4C1D95) : Colors.white;
    final textColor = highlight ? Colors.white : Colors.black87;
    final subColor = highlight ? Colors.white60 : Colors.black54;
    final checkColor = highlight ? const Color(0xFFA78BFA) : const Color(0xFF7C3AED);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: highlight ? null : Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: highlight
            ? [BoxShadow(
                color: const Color(0xFF4C1D95).withOpacity(0.25),
                blurRadius: 16, offset: const Offset(0, 4))]
            : [],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: tagColor.withOpacity(highlight ? 0.3 : 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(tag,
                style: GoogleFonts.poppins(
                    fontSize: 10, fontWeight: FontWeight.bold, color: tagColor)),
          ),
          const Spacer(),
          Text(price,
              style: GoogleFonts.poppins(
                  fontSize: 16, fontWeight: FontWeight.bold,
                  color: highlight ? Colors.white : const Color(0xFF4C1D95))),
        ]),
        const SizedBox(height: 10),
        Text(icon, style: const TextStyle(fontSize: 28)),
        const SizedBox(height: 6),
        Text(name,
            style: GoogleFonts.poppins(
                fontSize: 15, fontWeight: FontWeight.bold,
                color: textColor, height: 1.2)),
        const SizedBox(height: 4),
        Text('Best for: $bestFor',
            style: GoogleFonts.poppins(
                fontSize: 11, color: subColor, fontStyle: FontStyle.italic)),
        const SizedBox(height: 12),
        ...features.map((f) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(Icons.check_circle_rounded, size: 13, color: checkColor),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(f,
                      style: GoogleFonts.poppins(
                          fontSize: 11, color: subColor, height: 1.4)),
                ),
              ]),
            )),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => _launchWhatsApp(ctaMessage),
            style: ElevatedButton.styleFrom(
              backgroundColor: highlight
                  ? const Color(0xFF7C3AED)
                  : const Color(0xFF4C1D95),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 11),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: Text(ctaLabel,
                style: GoogleFonts.poppins(
                    fontSize: 12, fontWeight: FontWeight.bold)),
          ),
        ),
      ]),
    );
  }

  Widget _profileAccordion(String key, String title, String body) {
    final isOpen = _profileOpen[key] ?? false;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(children: [
        GestureDetector(
          onTap: () => setState(() => _profileOpen[key] = !isOpen),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Expanded(
                child: Text(title,
                    style: GoogleFonts.poppins(
                        fontSize: 13, fontWeight: FontWeight.w600,
                        color: Colors.black87)),
              ),
              Icon(isOpen ? Icons.expand_less : Icons.expand_more,
                  color: Colors.black45),
            ]),
          ),
        ),
        if (isOpen)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Text(body,
                style: GoogleFonts.poppins(
                    fontSize: 12, color: Colors.black54, height: 1.6)),
          ),
      ]),
    );
  }

  Widget _faqAccordion(String key, String question, String answer) {
    final isOpen = _faqOpen[key] ?? false;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(children: [
        GestureDetector(
          onTap: () => setState(() => _faqOpen[key] = !isOpen),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Expanded(
                child: Text(question,
                    style: GoogleFonts.poppins(
                        fontSize: 13, fontWeight: FontWeight.w600,
                        color: Colors.black87)),
              ),
              Icon(isOpen ? Icons.expand_less : Icons.expand_more,
                  color: Colors.black45),
            ]),
          ),
        ),
        if (isOpen)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Text(answer,
                style: GoogleFonts.poppins(
                    fontSize: 12, color: Colors.black54, height: 1.6)),
          ),
      ]),
    );
  }

  Widget _workshopFormatCard({
    required String emoji, required String title, required String duration,
    required bool darkBg, required List<String> points,
  }) {
    final bg        = darkBg ? const Color(0xFF1B5E20) : const Color(0xFFFFF8F0);
    final textColor = darkBg ? Colors.white : const Color(0xFF92400E);
    final checkColor= darkBg ? Colors.white54 : const Color(0xFFF59E0B);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(emoji, style: const TextStyle(fontSize: 32)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(title,
                  style: GoogleFonts.poppins(
                      fontSize: 15, fontWeight: FontWeight.bold, color: textColor)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(duration,
                    style: GoogleFonts.poppins(
                        fontSize: 10, fontWeight: FontWeight.bold, color: textColor)),
              ),
            ]),
            const SizedBox(height: 8),
            ...points.map((p) => Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(Icons.check_circle_rounded, size: 13, color: checkColor),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(p,
                          style: GoogleFonts.poppins(
                              fontSize: 11,
                              color: darkBg ? Colors.white70 : const Color(0xFF92400E))),
                    ),
                  ]),
                )),
          ]),
        ),
      ]),
    );
  }

  Widget _audienceCard(String emoji, String title, String sub, Color bg, Color accent) {
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
                fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black87)),
        const SizedBox(height: 4),
        Text(sub,
            style: GoogleFonts.poppins(
                fontSize: 11, color: Colors.black54, height: 1.4),
            textAlign: TextAlign.center),
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
    final url = 'https://wa.me/$_whatsapp?text=${Uri.encodeComponent(message)}';
    await _launchUrl(url);
  }
}