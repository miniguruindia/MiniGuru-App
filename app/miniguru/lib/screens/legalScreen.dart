// lib/screens/legalScreen.dart
// Single screen for Privacy Policy, T&C, Cookie Policy, Help & FAQ
// All content fetched from GET /cms/legal_* and GET /cms/faq
// Falls back to hardcoded defaults if backend unavailable

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class LegalScreen extends StatefulWidget {
  static const String id = '/legal';
  final int initialTab;
  const LegalScreen({super.key, this.initialTab = 0});

  @override
  State<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends State<LegalScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _api = MiniguruApi();
  bool _loading = true;

  // ── CMS content ─────────────────────────────────────────────────────
  String _privacy     = '';
  String _terms       = '';
  String _cookie      = '';
  List<Map<String, dynamic>> _faqs = [];

  static const _accent = Color(0xFF5B6EF5);
  static const _bg     = Color(0xFFF5F7FF);

  static const _tabs = [
    {'label': 'Privacy',  'icon': Icons.lock_outline},
    {'label': 'Terms',    'icon': Icons.description_outlined},
    {'label': 'Cookies',  'icon': Icons.cookie_outlined},
    {'label': 'Help',     'icon': Icons.help_outline},
  ];

  // ── Hardcoded fallbacks ─────────────────────────────────────────────
  static const _defaultPrivacy = '''
# Privacy Policy
**Last updated: March 2025 · MiniGuru India Private Limited**

## 1. Introduction
MiniGuru is built for children. Protecting their privacy is our highest responsibility. This policy explains what we collect, why, and how — in compliance with India's **Digital Personal Data Protection Act, 2023 (DPDPA)**.

## 2. What We Collect
- **Account info** — child's name, age; parent/guardian email and phone
- **Project content** — photos and videos uploaded by the child
- **Usage data** — screens visited, features used (for personalisation)
- **Profile photo** — optional, stored securely

We do **NOT** collect Aadhar numbers, precise GPS location, biometric data, or payment card details.

## 3. Parental Consent
Under DPDPA 2023, we require verifiable consent from a parent or guardian before creating an account for a child under 18. By registering, you confirm you are the child's parent/guardian.

## 4. How We Use Your Data
- To operate the MiniGuru platform
- To personalise learning recommendations
- To moderate content for child safety
- We never sell data to third parties

## 5. Your Rights
- **Access** — request a copy of your data
- **Correct** — update inaccurate information
- **Erase** — request deletion of your account and data
- **Withdraw consent** — at any time, contact privacy@miniguru.in

## 6. Data Security
All data is encrypted in transit (TLS) and at rest. Access is restricted to authorised MiniGuru staff only.

## 7. Contact
privacy@miniguru.in · +91 93997 56846
''';

  static const _defaultTerms = '''
# Terms & Conditions
**Last updated: March 2025 · MiniGuru India Private Limited**

## 1. Acceptance
By using MiniGuru you agree to these Terms. Parents and guardians agree on behalf of children under 18.

## 2. Who Can Use MiniGuru
MiniGuru is designed for children aged 8–14. An account requires a parent or guardian's consent and contact details.

## 3. Goins — Virtual Currency
- Goins are MiniGuru's virtual currency earned by completing projects, uploading videos, and community participation.
- Goins have **no real monetary value** and cannot be exchanged for cash.
- Goins can be spent in the MiniGuru shop on STEAM materials.
- Parents top up the wallet balance via Razorpay for shop purchases.

## 4. Your Content
- Children retain ownership of their project ideas.
- By submitting content you grant MiniGuru a non-exclusive licence to display it on the platform.
- All content is moderated before publication. Inappropriate content will be removed.

## 5. Payments & Refunds
- Real-money transactions are processed via Razorpay.
- Refund requests must be made within 7 days of purchase.
- Contact orders@miniguru.in for refund queries.

## 6. Prohibited Conduct
- Sharing personal contact details publicly
- Uploading content that is not your own work
- Any behaviour that makes other members feel unsafe

## 7. Governing Law
Governed by Indian law. Disputes subject to courts in Ujjain, Madhya Pradesh.

## 8. Contact
legal@miniguru.in
''';

  static const _defaultCookie = '''
# Cookie Policy
**Last updated: March 2025 · MiniGuru India Private Limited**

## 1. What Are Cookies?
Cookies are small text files stored on your device when you use a website or app. They help us remember your preferences and keep you logged in.

## 2. Cookies We Use

### Essential Cookies
These are required for the app to function. They cannot be turned off.
- **auth_token** — keeps you logged in securely
- **session_id** — tracks your current session

### Performance Cookies
These help us understand how the app is used so we can improve it.
- **analytics** — anonymous usage statistics (no personal data)

### Preference Cookies
These remember your settings.
- **theme** — your display preferences
- **last_tab** — which section you last visited

## 3. No Advertising Cookies
MiniGuru does **not** use advertising cookies. We do not track children for commercial profiling.

## 4. Your Choices
You can clear cookies at any time through your device settings. Note that clearing essential cookies will log you out.

## 5. Contact
privacy@miniguru.in
''';

  static const _defaultFaqs = [
    {
      'question': 'What is MiniGuru?',
      'answer':   'MiniGuru is a STEAM learning platform for Indian children aged 8–14. Kids explore maker domains, build real projects, share videos, and earn Goins.',
    },
    {
      'question': 'What age group is MiniGuru for?',
      'answer':   'MiniGuru is designed for children aged 8 to 14. Younger or older children may still enjoy the platform with parental guidance.',
    },
    {
      'question': 'What are Goins?',
      'answer':   'Goins are MiniGuru\'s virtual currency. Your child earns Goins by uploading project videos, getting likes and comments. Goins can be spent in the MiniGuru shop on STEAM materials.',
    },
    {
      'question': 'How does a parent top up the wallet?',
      'answer':   'Go to your child\'s Profile → Wallet → Add Money. You can add any amount via Razorpay (UPI, card, or net banking). The balance is then available for your child to spend in the shop.',
    },
    {
      'question': 'How does ordering from the shop work?',
      'answer':   'Your child browses the shop, adds items to cart, and checks out using their wallet balance. You receive a confirmation and the materials are physically dispatched to your delivery address.',
    },
    {
      'question': 'Is my child\'s data safe?',
      'answer':   'Yes. MiniGuru is DPDPA 2023 compliant. We never sell data, never show ads, and all content is moderated before publication. See our Privacy Policy for full details.',
    },
    {
      'question': 'How is content moderated?',
      'answer':   'Every project video is reviewed by a trained MiniGuru moderator before it goes live. No personal details of the child may appear in published content.',
    },
    {
      'question': 'Can I delete my child\'s account?',
      'answer':   'Yes. Email privacy@miniguru.in with your registered phone number and we will delete all data within 30 days, as required by DPDPA 2023.',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
        length: _tabs.length, vsync: this, initialIndex: widget.initialTab);
    _loadCms();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadCms() async {
    try {
      final results = await Future.wait([
        _api.getCmsContent('legal_privacy'),
        _api.getCmsContent('legal_terms'),
        _api.getCmsContent('legal_cookie'),
        _api.getCmsContent('faq'),
      ]);

      if (!mounted) return;
      setState(() {
        _privacy = _extractString(results[0], _defaultPrivacy);
        _terms   = _extractString(results[1], _defaultTerms);
        _cookie  = _extractString(results[2], _defaultCookie);

        final faqData = results[3];
        if (faqData != null && faqData['items'] is List) {
          _faqs = List<Map<String, dynamic>>.from(faqData['items']);
        } else {
          _faqs = List<Map<String, dynamic>>.from(_defaultFaqs);
        }
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _privacy = _defaultPrivacy;
          _terms   = _defaultTerms;
          _cookie  = _defaultCookie;
          _faqs    = List<Map<String, dynamic>>.from(_defaultFaqs);
          _loading = false;
        });
      }
    }
  }

  String _extractString(Map<String, dynamic>? data, String fallback) {
    if (data == null) return fallback;
    if (data['content'] is String) return data['content'] as String;
    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Color(0xFF1A1A2E), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Legal & Help',
            style: GoogleFonts.nunito(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF1A1A2E))),
        bottom: TabBar(
          controller: _tabController,
          labelStyle: GoogleFonts.nunito(
              fontSize: 12, fontWeight: FontWeight.w800),
          unselectedLabelStyle: GoogleFonts.nunito(fontSize: 12),
          labelColor: _accent,
          unselectedLabelColor: const Color(0xFF6B6B8A),
          indicatorColor: _accent,
          indicatorWeight: 3,
          tabs: _tabs.map((t) => Tab(
            icon: Icon(t['icon'] as IconData, size: 16),
            text: t['label'] as String,
          )).toList(),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _accent))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildMarkdownTab(_privacy, Icons.lock_outline, const Color(0xFF5B6EF5)),
                _buildMarkdownTab(_terms,   Icons.description_outlined, const Color(0xFF10B981)),
                _buildMarkdownTab(_cookie,  Icons.cookie_outlined, const Color(0xFFF59E0B)),
                _buildFaqTab(),
              ],
            ),
    );
  }

  // ── Markdown-style legal tab ──────────────────────────────────────────
  Widget _buildMarkdownTab(String content, IconData icon, Color color) {
    final lines = content.trim().split('\n');
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      itemCount: lines.length,
      itemBuilder: (_, i) {
        final line = lines[i].trim();
        if (line.isEmpty) return const SizedBox(height: 8);

        // H1
        if (line.startsWith('# ')) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 4, top: 8),
            child: Text(line.substring(2),
                style: GoogleFonts.nunito(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: color)),
          );
        }
        // H2
        if (line.startsWith('## ')) {
          return Padding(
            padding: const EdgeInsets.only(top: 20, bottom: 6),
            child: Row(children: [
              Container(
                width: 4, height: 18,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(line.substring(3),
                  style: GoogleFonts.nunito(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF1A1A2E))),
            ]),
          );
        }
        // H3
        if (line.startsWith('### ')) {
          return Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Text(line.substring(4),
                style: GoogleFonts.nunito(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF1A1A2E))),
          );
        }
        // Bullet
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return Padding(
            padding: const EdgeInsets.only(left: 8, bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Container(
                    width: 5, height: 5,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(_cleanBold(line.substring(2)),
                      style: GoogleFonts.nunito(
                          fontSize: 13,
                          color: const Color(0xFF444466),
                          height: 1.5)),
                ),
              ],
            ),
          );
        }
        // Bold line (starts and ends with **)
        if (line.startsWith('**') && line.endsWith('**')) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(line.replaceAll('**', ''),
                style: GoogleFonts.nunito(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF1A1A2E))),
          );
        }
        // Normal paragraph
        return Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Text(_cleanBold(line),
              style: GoogleFonts.nunito(
                  fontSize: 13,
                  color: const Color(0xFF444466),
                  height: 1.6)),
        );
      },
    );
  }

  String _cleanBold(String s) => s.replaceAll('**', '');

  // ── FAQ + Help tab ────────────────────────────────────────────────────
  Widget _buildFaqTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        // Help contact card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF5B6EF5), Color(0xFF7C8EFF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Need Help?',
                  style: GoogleFonts.nunito(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Colors.white)),
              const SizedBox(height: 4),
              Text('Our team responds within 1 business day',
                  style: GoogleFonts.nunito(
                      fontSize: 12, color: Colors.white70)),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: _helpBtn(
                  icon: Icons.email_outlined,
                  label: 'Email Us',
                  onTap: () => _launch('mailto:hello@miniguru.in'),
                )),
                const SizedBox(width: 10),
                Expanded(child: _helpBtn(
                  icon: Icons.chat_bubble_outline,
                  label: 'WhatsApp',
                  onTap: () => _launch(
                      'https://wa.me/919399756846?text=Hi%20MiniGuru%21%20I%20need%20help.'),
                )),
              ]),
            ],
          ),
        ),

        const SizedBox(height: 24),

        Text('Frequently Asked Questions',
            style: GoogleFonts.nunito(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF1A1A2E))),
        const SizedBox(height: 12),

        // FAQ accordion
        ..._faqs.asMap().entries.map((entry) {
          final i    = entry.key;
          final faq  = entry.value;
          return _FaqTile(
            question: faq['question']?.toString() ?? '',
            answer:   faq['answer']?.toString()   ?? '',
            index:    i,
          );
        }),

        const SizedBox(height: 24),

        // Still need help?
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
          ),
          child: Row(children: [
            const Text('💡', style: TextStyle(fontSize: 24)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Still need help?',
                      style: GoogleFonts.nunito(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF065F46))),
                  Text('Email hello@miniguru.in and we\'ll sort it out.',
                      style: GoogleFonts.nunito(
                          fontSize: 12, color: const Color(0xFF065F46))),
                ],
              ),
            ),
          ]),
        ),
      ],
    );
  }

  Widget _helpBtn({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.2),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white30),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, color: Colors.white, size: 16),
          const SizedBox(width: 7),
          Text(label,
              style: GoogleFonts.nunito(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: Colors.white)),
        ]),
      ),
    );
  }

  Future<void> _launch(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

// ── Expandable FAQ tile ───────────────────────────────────────────────────────
class _FaqTile extends StatefulWidget {
  final String question;
  final String answer;
  final int index;
  const _FaqTile({
    required this.question,
    required this.answer,
    required this.index,
  });

  @override
  State<_FaqTile> createState() => _FaqTileState();
}

class _FaqTileState extends State<_FaqTile>
    with SingleTickerProviderStateMixin {
  bool _open = false;
  late AnimationController _ctrl;
  late Animation<double> _rotate;

  static const _accent = Color(0xFF5B6EF5);

  @override
  void initState() {
    super.initState();
    _ctrl   = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
    _rotate = Tween<double>(begin: 0, end: 0.5).animate(
        CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _open ? _accent.withOpacity(0.4) : const Color(0xFFE8EAFF),
          width: _open ? 1.5 : 1,
        ),
        boxShadow: _open
            ? [BoxShadow(
                color: _accent.withOpacity(0.06),
                blurRadius: 8,
                offset: const Offset(0, 2))]
            : [],
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: () {
              setState(() => _open = !_open);
              _open ? _ctrl.forward() : _ctrl.reverse();
            },
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Container(
                  width: 26, height: 26,
                  decoration: BoxDecoration(
                    color: _accent.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text('Q',
                        style: GoogleFonts.nunito(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: _accent)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(widget.question,
                      style: GoogleFonts.nunito(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF1A1A2E))),
                ),
                RotationTransition(
                  turns: _rotate,
                  child: Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: _open ? _accent : const Color(0xFF6B6B8A),
                    size: 20,
                  ),
                ),
              ]),
            ),
          ),
          if (_open)
            Padding(
              padding: const EdgeInsets.fromLTRB(50, 0, 14, 14),
              child: Text(widget.answer,
                  style: GoogleFonts.nunito(
                      fontSize: 13,
                      color: const Color(0xFF444466),
                      height: 1.6)),
            ),
        ],
      ),
    );
  }
}