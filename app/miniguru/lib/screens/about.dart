// lib/screens/about.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:miniguru/screens/legalScreen.dart';
import 'package:miniguru/screens/navScreen/consultancy.dart';
import 'package:miniguru/network/MiniguruApi.dart';

// ─── COLOURS ────────────────────────────────────────────────────────────────
class _AC {
  static const deepGreen  = Color(0xFF1B5E20);
  static const paleGreen  = Color(0xFFF1F8F1);
  static const white      = Colors.white;
  static const ink        = Color(0xFF1A1A2E);
  static const muted      = Color(0xFF6B7280);
  static const accent     = Color(0xFF5B6EF5);
  static const amber      = Color(0xFFE8A000);
  static const chipBg     = Color(0xFFE8F5E9);
  static const chipText   = Color(0xFF2E7D32);
}

// ─── TYPE HELPERS ───────────────────────────────────────────────────────────
TextStyle _h(double size, Color color, {FontWeight w = FontWeight.w900}) =>
    GoogleFonts.nunito(fontSize: size, fontWeight: w, color: color);

TextStyle _b(double size, Color color, {FontWeight w = FontWeight.w500}) =>
    GoogleFonts.nunito(fontSize: size, fontWeight: w, color: color, height: 1.65);

// ─── HELPERS ────────────────────────────────────────────────────────────────
Future<void> _launchUrl(String url) async {
  final uri = Uri.parse(url);
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

void _goConsultancy(BuildContext context, int tab) {
  Navigator.push(context,
      MaterialPageRoute(builder: (_) => ConsultancyPage(initialService: tab)));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════
class AboutScreen extends StatefulWidget {
  const AboutScreen({super.key});

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen> {
  final _api = MiniguruApi();
  Map<String, dynamic>? _cms;

  @override
  void initState() {
    super.initState();
    _loadCms();
  }

  Future<void> _loadCms() async {
    try {
      final data = await _api.getCmsContent('about');
      if (data != null && mounted) setState(() => _cms = data);
    } catch (e) {
      debugPrint('About CMS load error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FF),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _HeroSection(),
              const _OriginStorySection(),
              const _NaturalLearningSection(),
              const _PlatformFeaturesSection(),
              const _OfferingsSection(),
              const _TLabNetworkSection(),
              const _AwardsSection(),
              _ContactSection(
                email:   _cms?['contactEmail']?.toString(),
                phone:   _cms?['contactPhone']?.toString(),
                address: _cms?['address']?.toString(),
              ),
              const _FooterSection(),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — HERO
// ═══════════════════════════════════════════════════════════════════════════
class _HeroSection extends StatelessWidget {
  const _HeroSection();

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final isMobile = w < 700;
    return isMobile ? const _HeroMobile() : const _HeroDesktop();
  }
}

class _HeroDesktop extends StatelessWidget {
  const _HeroDesktop();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 520,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // LEFT — solid green + text
          Expanded(
            flex: 55,
            child: Container(
              color: _AC.deepGreen,
              padding: const EdgeInsets.symmetric(horizontal: 64, vertical: 48),
              child: const _HeroText(),
            ),
          ),
          // RIGHT — Pari image only, no overlay line
          Expanded(
            flex: 45,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(
                  color: const Color(0xFF145218),
                  child: Image.asset(
                    'assets/pari T-LAB.jpg',
                    fit: BoxFit.contain,
                    alignment: Alignment.bottomCenter,
                    errorBuilder: (_, __, ___) => Container(),
                  ),
                ),
                // Seamless left fade — no hard line
                Positioned(
                  left: 0, top: 0, bottom: 0, width: 40,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          _AC.deepGreen,
                          _AC.deepGreen.withOpacity(0.0),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroMobile extends StatelessWidget {
  const _HeroMobile();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Top — image
        SizedBox(
          height: 220,
          width: double.infinity,
          child: Image.asset(
            'assets/pari T-LAB.jpg',
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            errorBuilder: (_, __, ___) => Container(color: _AC.deepGreen),
          ),
        ),
        // Bottom — green text area
        Container(
          color: _AC.deepGreen,
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 36),
          child: const _HeroText(),
        ),
      ],
    );
  }
}

class _HeroText extends StatelessWidget {
  const _HeroText();

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 700;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // MiniGuru logo + title
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Image.asset(
              'assets/MGlogo.png',
              height: isMobile ? 36 : 44,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
            const SizedBox(width: 12),
            Text('MiniGuru', style: _h(isMobile ? 36 : 50, _AC.white)),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          'A changemaker platform for young makers\nBuilt on the Natural Learning Model',
          style: _h(isMobile ? 13 : 16, _AC.white.withOpacity(0.9),
              w: FontWeight.w700),
        ),
        const SizedBox(height: 14),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Text(
            'MiniGuru brings T-LAB, home tinkering, and community workshops '
            'together under one roof. Children plan, make, document, and share '
            'real projects — and in doing so, learn things that no lesson can teach.',
            style: _b(isMobile ? 13 : 15, _AC.white.withOpacity(0.85)),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Every child here is a maker. Every project here is real.',
          style: GoogleFonts.nunito(
              fontSize: 13,
              fontStyle: FontStyle.italic,
              color: _AC.white.withOpacity(0.7),
              fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 22),
        Wrap(spacing: 10, runSpacing: 10, children: [
          _StatChip('10+ Years'),
          _StatChip('32+ T-LABs'),
          _StatChip('10,000+ Students'),
          _StatChip('200+ Workshops'),
        ]),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  const _StatChip(this.label);
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.15),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withOpacity(0.35)),
        ),
        child: Text(label, style: _h(12, Colors.white, w: FontWeight.w800)),
      );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — ORIGIN STORY
// ═══════════════════════════════════════════════════════════════════════════
class _OriginStorySection extends StatelessWidget {
  const _OriginStorySection();

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final isMobile = w < 700;

    return Container(
      color: _AC.paleGreen,
      padding: EdgeInsets.symmetric(
          horizontal: isMobile ? 24 : 64,
          vertical: isMobile ? 48 : 72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // "Where It Began" heading + T-LAB logo beside it
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _SectionLabel('Origin Story', _AC.deepGreen),
              const SizedBox(width: 16),
              Image.asset(
                'assets/T-LAB.png',
                height: isMobile ? 40 : 52,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text('Where It Began',
              style: _h(isMobile ? 26 : 36, _AC.deepGreen)),
          const SizedBox(height: 28),

          // Story paragraphs
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'T-LAB started in 2015 in a room in Trilanga, Bhopal. Some shelves, '
                  'a collection of salvaged materials, and one question: what do children '
                  "do when you give them time and real things and don't tell them what to make?",
                  style: _b(isMobile ? 15 : 17, _AC.ink),
                ),
                const SizedBox(height: 16),
                Text(
                  'The first children who walked in were cautious. They looked around. '
                  'They waited. They asked what they were supposed to do. And then, gradually, '
                  'something shifted. A child picked up a piece of wire. Another started on a '
                  'clay model. A third began building a boat — which sank, which she researched, '
                  'which she rebuilt.',
                  style: _b(isMobile ? 15 : 17, _AC.ink),
                ),
                const SizedBox(height: 16),
                Text(
                  'That shift — from waiting to making — is what T-LAB exists to protect. '
                  'MiniGuru exists to make it visible.',
                  style: _b(isMobile ? 15 : 17, _AC.deepGreen,
                      w: FontWeight.w700),
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),

          // Founder card
          Container(
            constraints: const BoxConstraints(maxWidth: 800),
            decoration: BoxDecoration(
              color: _AC.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                    color: _AC.deepGreen.withOpacity(0.08),
                    blurRadius: 24,
                    offset: const Offset(0, 6))
              ],
            ),
            child: isMobile
                ? const _FounderVertical()
                : const _FounderHorizontal(),
          ),
        ],
      ),
    );
  }
}

class _FounderHorizontal extends StatelessWidget {
  const _FounderHorizontal();
  @override
  Widget build(BuildContext context) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ClipRRect(
        borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16), bottomLeft: Radius.circular(16)),
        child: Image.asset('assets/Founder_Pramod.jpg',
            width: 220, height: 280, fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            errorBuilder: (_, __, ___) => Container(
                width: 220, height: 280, color: _AC.chipBg,
                child: const Icon(Icons.person, size: 80,
                    color: Color(0xFF2E7D32)))),
      ),
      Expanded(
          child: Padding(
              padding: const EdgeInsets.all(28),
              child: const _FounderContent())),
    ]);
  }
}

class _FounderVertical extends StatelessWidget {
  const _FounderVertical();
  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ClipRRect(
        borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16), topRight: Radius.circular(16)),
        child: Image.asset('assets/Founder_Pramod.jpg',
            width: double.infinity,
            height: 240,
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            errorBuilder: (_, __, ___) => Container(
                height: 240, color: _AC.chipBg,
                child: const Center(
                    child: Icon(Icons.person, size: 80,
                        color: Color(0xFF2E7D32))))),
      ),
      Padding(
          padding: const EdgeInsets.all(24),
          child: const _FounderContent()),
    ]);
  }
}

class _FounderContent extends StatelessWidget {
  const _FounderContent();
  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Pramod Maithil', style: _h(22, _AC.deepGreen)),
      const SizedBox(height: 4),
      Text('Founder, MiniGuru & T-LAB',
          style: _b(14, _AC.muted, w: FontWeight.w600)),
      const SizedBox(height: 14),
      Text(
        'Educator by heart and entrepreneur by spirit — on a mission to reshape '
        'education with the Natural Learning Model. Over 24 years in elementary '
        'education; 10+ years building T-LAB across India. Recognised as one of '
        "India's Top 100 Educators (India Prime Awards 2022).",
        style: _b(14.5, _AC.ink),
      ),
      const SizedBox(height: 14),
      Wrap(spacing: 8, runSpacing: 8, children: [
        _LinkBadge(
          '📖 Author — School for My Child (Partridge/Penguin)',
          'https://www.amazon.in/School-My-Child-Elementary-Schools-ebook/dp/B0793R49RR',
        ),
        _LinkBadge(
          '🎤 TEDx Speaker — Watch Talk',
          'https://youtu.be/35r_ip9Fnrc?si=1RvtzWJNg-Ksl30U',
        ),
      ]),
    ]);
  }
}

class _LinkBadge extends StatelessWidget {
  final String label;
  final String url;
  const _LinkBadge(this.label, this.url);
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => _launchUrl(url),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: _AC.chipBg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _AC.deepGreen.withOpacity(0.3)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Flexible(
              child: Text(label,
                  style: _b(12, _AC.chipText, w: FontWeight.w700))),
            const SizedBox(width: 4),
            const Icon(Icons.open_in_new, size: 12, color: _AC.chipText),
          ]),
        ),
      );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — NATURAL LEARNING MODEL
// ═══════════════════════════════════════════════════════════════════════════
class _NaturalLearningSection extends StatelessWidget {
  const _NaturalLearningSection();

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final isMobile = w < 700;

    return Container(
      color: _AC.deepGreen,
      padding: EdgeInsets.symmetric(
          horizontal: isMobile ? 24 : 64,
          vertical: isMobile ? 48 : 72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel('Our Pedagogy', Colors.white.withOpacity(0.6)),
          const SizedBox(height: 8),
          Text('The Natural Learning Model',
              style: _h(isMobile ? 24 : 34, _AC.white)),
          const SizedBox(height: 6),
          Text(
            'Our pedagogical foundation — developed over 20 years of observation',
            style: _b(isMobile ? 13 : 15, _AC.white.withOpacity(0.7),
                w: FontWeight.w600),
          ),
          const SizedBox(height: 36),

          // Content: on desktop, left=text, right=NLM image+caption
          // Both columns are wrapped in IntrinsicHeight so they match
          isMobile
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _NLMText(isMobile: true),
                    const SizedBox(height: 32),
                    const _NLMSymbol(),
                  ],
                )
              : IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Left — full paragraph text
                      Expanded(
                        flex: 3,
                        child: _NLMText(isMobile: false),
                      ),
                      const SizedBox(width: 48),
                      // Right — NLM image + caption, vertically centred
                      Expanded(
                        flex: 2,
                        child: Center(child: const _NLMSymbol()),
                      ),
                    ],
                  ),
                ),
        ],
      ),
    );
  }
}

class _NLMText extends StatelessWidget {
  final bool isMobile;
  const _NLMText({required this.isMobile});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'Children learn most powerfully when five conditions are present together: '
          'freedom to explore without a predetermined outcome, real materials that give '
          "real feedback, time that follows the learner's pace, a community of other "
          'learners at different stages, and work that genuinely matters to them.',
          style: _b(isMobile ? 14 : 16, _AC.white.withOpacity(0.9)),
        ),
        const SizedBox(height: 18),
        Text(
          'The Natural Learning Model places one thing at the centre of all of these: '
          'happiness. Not comfort — but the specific state of a child who is completely '
          'absorbed in something they have chosen, for reasons entirely their own.',
          style: _b(isMobile ? 14 : 16, _AC.white.withOpacity(0.9)),
        ),
        const SizedBox(height: 18),
        Text(
          'T-LAB is built to create these conditions in a physical space. '
          'MiniGuru is built to extend them into a connected community.',
          style: _b(isMobile ? 14 : 16, _AC.white.withOpacity(0.9)),
        ),
        const SizedBox(height: 28),
        Wrap(spacing: 10, runSpacing: 10, children: [
          _NLMChip('Freedom to Explore'),
          _NLMChip('Real Materials'),
          _NLMChip("Learner's Own Pace"),
          _NLMChip('Peer Community'),
          _NLMChip('Work That Matters'),
          _NLMChip('Happiness at Centre'),
        ]),
      ],
    );
  }
}

class _NLMChip extends StatelessWidget {
  final String label;
  const _NLMChip(this.label);
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.12),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withOpacity(0.3)),
        ),
        child: Text(label, style: _b(13, _AC.white, w: FontWeight.w700)),
      );
}

class _NLMSymbol extends StatelessWidget {
  const _NLMSymbol();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 220,
          height: 220,
          decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.08),
              borderRadius: BorderRadius.circular(16)),
          clipBehavior: Clip.antiAlias,
          child: Image.asset(
            'assets/NLM.webp',
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.all_inclusive,
                      size: 64, color: Colors.white38),
                  const SizedBox(height: 8),
                  Text('Natural Learning\nModel Symbol',
                      textAlign: TextAlign.center,
                      style: _b(13, Colors.white54)),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Container(
          constraints: const BoxConstraints(maxWidth: 280),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withOpacity(0.2)),
          ),
          child: Text(
            '"Just as uniform squares placed at different angles around a single '
            'centre naturally form a perfect circle — when all conditions of '
            'learning are present and balanced, learning emerges on its own."',
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(
                fontSize: 13,
                fontStyle: FontStyle.italic,
                color: Colors.white.withOpacity(0.8),
                fontWeight: FontWeight.w500,
                height: 1.6),
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — PLATFORM FEATURES
// ═══════════════════════════════════════════════════════════════════════════
class _PlatformFeaturesSection extends StatelessWidget {
  const _PlatformFeaturesSection();

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final isMobile = w < 700;

    return Container(
      color: const Color(0xFFF5F7FF),
      padding: EdgeInsets.symmetric(
          horizontal: isMobile ? 24 : 64,
          vertical: isMobile ? 48 : 72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel('What MiniGuru Does', _AC.accent),
          const SizedBox(height: 8),
          Text('Platform Features',
              style: _h(isMobile ? 26 : 36, _AC.ink)),
          const SizedBox(height: 36),
          // Use Column/Row with wrapping — no fixed height grid
          isMobile
              ? Column(children: [
                  _FeatureCard(
                    icon: Icons.description_outlined,
                    iconColor: _AC.accent,
                    title: 'Project Sharing & Peer Learning',
                    body: 'Children document their projects — what they made, '
                        'how they made it, what failed, and what they learned — '
                        'and share with a community of other makers. Every project '
                        'in MiniGuru is a real story of making, not a polished showcase.',
                  ),
                  const SizedBox(height: 16),
                  _FeatureCard(
                    icon: Icons.edit_note_outlined,
                    iconColor: _AC.deepGreen,
                    title: 'Project Planning Tools',
                    body: 'Before making begins, children plan — sketching their '
                        'idea, listing materials, estimating their budget and spending '
                        'Goins. Planning is where ideas become commitments.',
                  ),
                  const SizedBox(height: 16),
                  _FeatureCard(
                    assetIcon: 'assets/Goine.png',
                    iconColor: _AC.amber,
                    title: 'The Goin Economy',
                    body: 'Every child earns Goins for making and sharing, and also '
                        'by peer comments. They spend Goins on materials. Through Goins, '
                        'children experience economics — budgeting, scarcity, value, and '
                        'exchange — as lived practice.',
                  ),
                  const SizedBox(height: 16),
                  _FeatureCard(
                    icon: Icons.shopping_bag_outlined,
                    iconColor: const Color(0xFF7B1FA2),
                    title: 'Materials for Your Projects',
                    body: 'The MiniGuru shop carries curated tinkering materials — '
                        'electronics components, craft supplies, and making tools — at '
                        'accessible prices, delivered to your home or school.',
                  ),
                ])
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(children: [
                        _FeatureCard(
                          icon: Icons.description_outlined,
                          iconColor: _AC.accent,
                          title: 'Project Sharing & Peer Learning',
                          body: 'Children document their projects — what they made, '
                              'how they made it, what failed, and what they learned — '
                              'and share with a community of other makers. Every project '
                              'in MiniGuru is a real story of making, not a polished showcase.',
                        ),
                        const SizedBox(height: 20),
                        _FeatureCard(
                          icon: Icons.edit_note_outlined,
                          iconColor: _AC.deepGreen,
                          title: 'Project Planning Tools',
                          body: 'Before making begins, children plan — sketching their '
                              'idea, listing materials, estimating their budget and spending '
                              'Goins. Planning is where ideas become commitments.',
                        ),
                      ]),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(children: [
                        _FeatureCard(
                          assetIcon: 'assets/Goine.png',
                          iconColor: _AC.amber,
                          title: 'The Goin Economy',
                          body: 'Every child earns Goins for making and sharing, and also '
                              'by peer comments. They spend Goins on materials. Through Goins, '
                              'children experience economics — budgeting, scarcity, value, and '
                              'exchange — as lived practice.',
                        ),
                        const SizedBox(height: 20),
                        _FeatureCard(
                          icon: Icons.shopping_bag_outlined,
                          iconColor: const Color(0xFF7B1FA2),
                          title: 'Materials for Your Projects',
                          body: 'The MiniGuru shop carries curated tinkering materials — '
                              'electronics components, craft supplies, and making tools — at '
                              'accessible prices, delivered to your home or school.',
                        ),
                      ]),
                    ),
                  ],
                ),
        ],
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  final IconData? icon;
  final String? assetIcon;
  final Color iconColor;
  final String title;
  final String body;

  const _FeatureCard({
    this.icon,
    this.assetIcon,
    required this.iconColor,
    required this.title,
    required this.body,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: _AC.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 16,
              offset: const Offset(0, 4))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(
                color: iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12)),
            child: assetIcon != null
                ? Padding(
                    padding: const EdgeInsets.all(8),
                    child: Image.asset(assetIcon!,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) =>
                            Icon(Icons.monetization_on, color: iconColor)))
                : Icon(icon, color: iconColor, size: 26),
          ),
          const SizedBox(height: 14),
          Text(title, style: _h(15, _AC.ink)),
          const SizedBox(height: 8),
          Text(body, style: _b(13, _AC.muted)),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — OFFERINGS
// ═══════════════════════════════════════════════════════════════════════════
class _OfferingsSection extends StatelessWidget {
  const _OfferingsSection();

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final isMobile = w < 700;

    return Container(
      color: _AC.paleGreen,
      padding: EdgeInsets.symmetric(
          horizontal: isMobile ? 24 : 64,
          vertical: isMobile ? 48 : 72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel('Work With Us', _AC.deepGreen),
          const SizedBox(height: 8),
          Text('Our Offerings',
              style: _h(isMobile ? 26 : 36, _AC.deepGreen)),
          const SizedBox(height: 36),
          isMobile
              ? Column(children: [
                  _OfferingCard(
                    icon: Icons.school_outlined,
                    title: 'T-LAB in Schools',
                    body: 'A self-governing tinkering community where children manage '
                        'their own space, economy, and projects under a trained facilitator. '
                        '32 such communities across India over 10 years. We can help you build yours.',
                    cta: 'Learn about T-LAB setup',
                    consultancyTab: 0,
                  ),
                  const SizedBox(height: 16),
                  _OfferingCard(
                    icon: Icons.construction_outlined,
                    title: 'Tinkering Workshops',
                    body: 'Immersive workshops — 1 to 15 days — where every participant '
                        'makes a real project from idea to sharing. 200+ workshops across India. '
                        'No kits, no instructions — real materials, real making, real learning.',
                    cta: 'See workshop options',
                    consultancyTab: 1,
                  ),
                  const SizedBox(height: 16),
                  _OfferingCard(
                    icon: Icons.home_outlined,
                    title: 'Home Tinkering Corner',
                    body: 'A personalised tinkering corner for your child at home — '
                        'designed around their specific curiosity, with the right tools '
                        'and materials for where their interests are right now.',
                    cta: 'Set up at home',
                    consultancyTab: 2,
                  ),
                ])
              : IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: _OfferingCard(
                          icon: Icons.school_outlined,
                          title: 'T-LAB in Schools',
                          body: 'A self-governing tinkering community where children manage '
                              'their own space, economy, and projects under a trained facilitator. '
                              '32 such communities across India over 10 years. We can help you build yours.',
                          cta: 'Learn about T-LAB setup',
                          consultancyTab: 0,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _OfferingCard(
                          icon: Icons.construction_outlined,
                          title: 'Tinkering Workshops',
                          body: 'Immersive workshops — 1 to 15 days — where every participant '
                              'makes a real project from idea to sharing. 200+ workshops across India. '
                              'No kits, no instructions — real materials, real making, real learning.',
                          cta: 'See workshop options',
                          consultancyTab: 1,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _OfferingCard(
                          icon: Icons.home_outlined,
                          title: 'Home Tinkering Corner',
                          body: 'A personalised tinkering corner for your child at home — '
                              'designed around their specific curiosity, with the right tools '
                              'and materials for where their interests are right now.',
                          cta: 'Set up at home',
                          consultancyTab: 2,
                        ),
                      ),
                    ],
                  ),
                ),
        ],
      ),
    );
  }
}

class _OfferingCard extends StatelessWidget {
  final IconData icon;
  final String title, body, cta;
  final int consultancyTab;

  const _OfferingCard({
    required this.icon,
    required this.title,
    required this.body,
    required this.cta,
    required this.consultancyTab,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: _AC.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: _AC.deepGreen.withOpacity(0.06),
              blurRadius: 20,
              offset: const Offset(0, 4))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52, height: 52,
            decoration: BoxDecoration(
                color: _AC.chipBg,
                borderRadius: BorderRadius.circular(14)),
            child: Icon(icon, color: _AC.deepGreen, size: 28),
          ),
          const SizedBox(height: 16),
          Text(title, style: _h(18, _AC.deepGreen)),
          const SizedBox(height: 10),
          Expanded(child: Text(body, style: _b(14, _AC.ink))),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => _goConsultancy(context, consultancyTab),
              style: OutlinedButton.styleFrom(
                foregroundColor: _AC.deepGreen,
                side: const BorderSide(color: _AC.deepGreen, width: 1.5),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(cta,
                  style: _h(13, _AC.deepGreen, w: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — T-LAB NETWORK
// ═══════════════════════════════════════════════════════════════════════════
class _TLabNetworkSection extends StatelessWidget {
  const _TLabNetworkSection();

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final isMobile = w < 700;
    final schools = [
      'Jinglebell School, Faizabad UP',
      'Sahyadri School (KFI), Pune MH',
      'TinyTods School, Faizabad UP',
      'Sunbeam School, Mugalsarai UP',
      'Aga Khan Foundation — 17 schools, Bihar',
      'Divine International School, Surat GJ',
      '+ many more T-LABs across India',
    ];

    return Container(
      color: const Color(0xFFF5F7FF),
      padding: EdgeInsets.symmetric(
          horizontal: isMobile ? 24 : 64,
          vertical: isMobile ? 48 : 72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel('Schools & Partners', _AC.accent),
          const SizedBox(height: 8),
          Text('The T-LAB Network',
              style: _h(isMobile ? 26 : 36, _AC.ink)),
          const SizedBox(height: 24),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Every school that sets up a T-LAB joins a network of schools, '
                  'facilitators, and children who are building the same culture — '
                  'differently, in their own place, at their own pace.',
                  style: _b(isMobile ? 14 : 16, _AC.ink),
                ),
                const SizedBox(height: 14),
                Text(
                  "Facilitators share observations. Children see each other's projects "
                  'on MiniGuru. Schools exchange visits. The network makes every T-LAB stronger.',
                  style: _b(isMobile ? 14 : 16, _AC.ink),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Wrap(
            spacing: 10, runSpacing: 10,
            children: schools
                .map((s) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: _AC.chipBg,
                        borderRadius: BorderRadius.circular(8),
                        border:
                            Border.all(color: _AC.deepGreen.withOpacity(0.2)),
                      ),
                      child: Text(s,
                          style: _b(13, _AC.chipText, w: FontWeight.w700)),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — AWARDS
// ═══════════════════════════════════════════════════════════════════════════
class _AwardsSection extends StatelessWidget {
  const _AwardsSection();

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final isMobile = w < 700;

    final awards = [
      _AD('🌐', 'Rex Karamveer Global Fellowship',
          'ICONGO & United Nations',
          'Global recognition for impact in education through tinkering pedagogy'),
      _AD('🏆', "India's Top 100 Educators",
          'India Prime Awards 2022',
          "Recognised among India's most impactful educators of the year"),
      _AD('⭐', 'CII-YI Award',
          'Confederation of Indian Industry — Young Indians, Bhopal',
          'Recognised for building a community-driven model of education'),
      _AD('📖', 'Azim Premji Foundation',
          'Learning Curve Magazine, Issue 4',
          'Published research: "T-LAB: Learning Through Tinkering"'),
    ];

    return Container(
      color: _AC.paleGreen,
      padding: EdgeInsets.symmetric(
          horizontal: isMobile ? 24 : 64,
          vertical: isMobile ? 48 : 72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel('Recognition', _AC.deepGreen),
          const SizedBox(height: 8),
          Text('Awards & Recognition',
              style: _h(isMobile ? 26 : 36, _AC.deepGreen)),
          const SizedBox(height: 36),

          // Awards — wrap layout, no fixed height
          isMobile
              ? Column(
                  children: awards
                      .map((a) => Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: _AwardCard(data: a)))
                      .toList())
              : Row(
                  children: [
                    Expanded(
                      child: Column(children: [
                        _AwardCard(data: awards[0]),
                        const SizedBox(height: 14),
                        _AwardCard(data: awards[1]),
                      ]),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(children: [
                        _AwardCard(data: awards[2]),
                        const SizedBox(height: 14),
                        _AwardCard(data: awards[3]),
                      ]),
                    ),
                  ],
                ),

          const SizedBox(height: 48),

          // Testimonial quote
          Container(
            constraints: const BoxConstraints(maxWidth: 700),
            padding: const EdgeInsets.only(left: 24),
            decoration: const BoxDecoration(
                border: Border(
                    left: BorderSide(color: _AC.deepGreen, width: 4))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '"T-LAB is a living testimony of what can be achieved when '
                  "grown-ups show respect and trust in the genuineness of "
                  "children's efforts.\"",
                  style: GoogleFonts.nunito(
                      fontSize: isMobile ? 15 : 18,
                      fontStyle: FontStyle.italic,
                      color: _AC.ink,
                      fontWeight: FontWeight.w600,
                      height: 1.6),
                ),
                const SizedBox(height: 10),
                Text(
                    '— Dr. Anish Mokashi, IISc Bangalore (after visiting T-LAB)',
                    style: _b(13, _AC.muted, w: FontWeight.w700)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AD {
  final String icon, org, by, detail;
  const _AD(this.icon, this.org, this.by, this.detail);
}

class _AwardCard extends StatelessWidget {
  final _AD data;
  const _AwardCard({required this.data});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _AC.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: _AC.deepGreen.withOpacity(0.06),
              blurRadius: 16,
              offset: const Offset(0, 3))
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(data.icon, style: const TextStyle(fontSize: 28)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(data.org, style: _h(14, _AC.deepGreen)),
                const SizedBox(height: 2),
                Text(data.by,
                    style: _b(12, _AC.muted, w: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(data.detail, style: _b(13, _AC.ink)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — CONTACT
// ═══════════════════════════════════════════════════════════════════════════
class _ContactSection extends StatelessWidget {
  final String? email, phone, address;
  const _ContactSection({this.email, this.phone, this.address});

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final isMobile = w < 700;
    final ce = (email   != null && email!.trim().isNotEmpty)   ? email!   : 'connect@miniguru.in';
    final cp = (phone   != null && phone!.trim().isNotEmpty)   ? phone!   : '+91 93997 56846';
    final ca = (address != null && address!.trim().isNotEmpty) ? address! : 'Ujjain, Madhya Pradesh, India';

    return Container(
      color: _AC.deepGreen,
      padding: EdgeInsets.symmetric(
          horizontal: isMobile ? 24 : 64,
          vertical: isMobile ? 48 : 72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Get in Touch',
              style: _h(isMobile ? 26 : 36, _AC.white)),
          const SizedBox(height: 14),
          Text(
            'Interested in starting a T-LAB at your school, running a workshop, '
            'or setting up a tinkering corner at home?',
            style: _b(isMobile ? 14 : 16, _AC.white.withOpacity(0.85)),
          ),
          const SizedBox(height: 28),
          isMobile
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _CItem(Icons.email_outlined, ce),
                    const SizedBox(height: 12),
                    _CItem(Icons.phone_outlined, cp),
                    const SizedBox(height: 12),
                    _CItem(Icons.language_outlined, 'miniguru.in'),
                    const SizedBox(height: 12),
                    _CItem(Icons.place_outlined, ca),
                  ])
              : Row(children: [
                  _CItem(Icons.email_outlined, ce),
                  const SizedBox(width: 36),
                  _CItem(Icons.phone_outlined, cp),
                  const SizedBox(width: 36),
                  _CItem(Icons.language_outlined, 'miniguru.in'),
                  const SizedBox(width: 36),
                  _CItem(Icons.place_outlined, ca),
                ]),
        ],
      ),
    );
  }
}

class _CItem extends StatelessWidget {
  final IconData icon;
  final String label;
  const _CItem(this.icon, this.label);
  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white70, size: 20),
          const SizedBox(width: 8),
          Text(label, style: _b(14, Colors.white, w: FontWeight.w600)),
        ],
      );
}

// ═══════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════
class _FooterSection extends StatelessWidget {
  const _FooterSection();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0F3D13),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      child: Column(children: [
        // Social buttons
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 12, runSpacing: 12,
          children: [
            _SocialBtn(
              Icons.facebook,
              'Facebook',
              'https://www.facebook.com/Prakriti.Initiatives',
              const Color(0xFF1877F2),
            ),
            _SocialBtn(
              Icons.photo_library_outlined,
              'Photo Gallery',
              'https://photos.app.goo.gl/nJDG4s6FTt5KCDCLA',
              _AC.amber,
            ),
            _SocialBtn(
              Icons.play_circle_outline,
              'YouTube',
              'https://www.youtube.com/@MiniGuru.innovation',
              const Color(0xFFFF0000),
            ),
            _SocialBtn(
              Icons.link,
              'LinkedIn',
              'https://www.linkedin.com/in/pramod-maithil-5b512897/',
              const Color(0xFF0A66C2),
            ),
          ],
        ),
        const SizedBox(height: 28),
        // Legal links
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 20, runSpacing: 12,
          children: [
            _FLink(context, 'Privacy Policy', legalTab: 0),
            _FLink(context, 'Terms & Conditions', legalTab: 1),
            _FLink(context, 'Cookie Policy', legalTab: 2),
            _FLink(context, 'Help & FAQ', legalTab: 3),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          '© 2026 MiniGuru Innovation Pvt Ltd · Prakriti Initiatives · Ujjain, Madhya Pradesh, India',
          textAlign: TextAlign.center,
          style: _b(12, Colors.white.withOpacity(0.6)),
        ),
      ]),
    );
  }

  Widget _SocialBtn(
      IconData icon, String label, String url, Color color) {
    return GestureDetector(
      onTap: () => _launchUrl(url),
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.5)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 8),
          Text(label,
              style: _b(13, Colors.white, w: FontWeight.w700)),
        ]),
      ),
    );
  }

  Widget _FLink(BuildContext context, String text,
      {required int legalTab}) {
    return GestureDetector(
      onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) => LegalScreen(initialTab: legalTab))),
      child: Text(text,
          style:
              _b(13, Colors.white.withOpacity(0.7), w: FontWeight.w600)),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED — Section label chip
// ═══════════════════════════════════════════════════════════════════════════
class _SectionLabel extends StatelessWidget {
  final String text;
  final Color color;
  const _SectionLabel(this.text, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(6)),
      child: Text(text.toUpperCase(),
          style: GoogleFonts.nunito(
              fontSize: 11,
              fontWeight: FontWeight.w900,
              color: color,
              letterSpacing: 1.5)),
    );
  }
}