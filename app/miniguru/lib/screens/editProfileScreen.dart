import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../network/MiniguruApi.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({Key? key}) : super(key: key);
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final MiniguruApi _api;
  bool _loading = true;
  bool _saving  = false;

  final _nameCtrl        = TextEditingController();
  final _aboutCtrl       = TextEditingController();
  final _gradeCtrl       = TextEditingController();
  final _schoolCtrl      = TextEditingController();
  final _cityCtrl        = TextEditingController();
  final _parentNameCtrl  = TextEditingController();
  final _parentPhoneCtrl    = TextEditingController();
  final _guardianEmailCtrl  = TextEditingController();
  List<String> _interests = [];

  static const _allInterests = [
    'Electronics', 'Robotics', 'Coding', 'Art & Craft', 'Science',
    'Mathematics', 'Music', 'Nature', 'Cooking', 'Sports',
    'Reading', 'Photography', 'Environment', 'Space', 'Machines',
  ];
  static const _primary = Color(0xFF5B6EF5);
  static const _bg      = Color(0xFFF5F7FF);

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final data = await _api.getProfile();
      if (data != null && mounted) {
        setState(() {
          _nameCtrl.text        = data['name']        ?? '';
          _aboutCtrl.text       = data['about']        ?? '';
          _gradeCtrl.text       = data['grade']        ?? '';
          _schoolCtrl.text      = data['schoolName']   ?? '';
          _cityCtrl.text        = data['city']         ?? '';
          _parentNameCtrl.text  = data['parentName']   ?? '';
          _parentPhoneCtrl.text   = data['parentPhone']    ?? '';
          _guardianEmailCtrl.text  = data['guardianEmail']  ?? '';
          _interests = List<String>.from(data['interests'] ?? []);
          _loading = false;
        });
      } else {
        if (mounted) setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final ok = await _api.updateProfile({
        'name':        _nameCtrl.text.trim(),
        'about':       _aboutCtrl.text.trim(),
        'grade':       _gradeCtrl.text.trim(),
        'schoolName':  _schoolCtrl.text.trim(),
        'city':        _cityCtrl.text.trim(),
        'parentName':  _parentNameCtrl.text.trim(),
        'parentPhone':   _parentPhoneCtrl.text.trim(),
        'guardianEmail': _guardianEmailCtrl.text.trim(),
        'interests':   _interests,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ok ? 'Profile updated! ✅' : 'Update failed',
              style: GoogleFonts.nunito(color: Colors.white)),
          backgroundColor: ok ? const Color(0xFF10B981) : const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
        if (ok) Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Error: $e', style: GoogleFonts.nunito(color: Colors.white)),
        backgroundColor: const Color(0xFFEF4444),
        behavior: SnackBarBehavior.floating,
      ));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _primary,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text('Edit Profile',
            style: GoogleFonts.nunito(fontWeight: FontWeight.w900, color: Colors.white)),
        actions: [
          if (!_loading)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TextButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text('Save', style: GoogleFonts.nunito(
                        color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                _section('👤 About You'),
                const SizedBox(height: 12),
                _field(_nameCtrl, 'Your Name', Icons.person_outline,
                    hint: 'e.g. Riya Sharma'),
                const SizedBox(height: 12),
                _field(_aboutCtrl, 'About Me', Icons.auto_stories_outlined,
                    hint: 'I love building robots and exploring science!',
                    maxLines: 3),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _field(_gradeCtrl, 'Grade / Class',
                      Icons.school_outlined, hint: 'e.g. Grade 7')),
                  const SizedBox(width: 12),
                  Expanded(child: _field(_cityCtrl, 'City',
                      Icons.location_city_outlined, hint: 'e.g. Bhopal')),
                ]),
                const SizedBox(height: 12),
                _field(_schoolCtrl, 'School Name',
                    Icons.account_balance_outlined,
                    hint: 'e.g. Delhi Public School'),

                const SizedBox(height: 28),
                _section('👨‍👩‍👧 Parent / Guardian'),
                const SizedBox(height: 4),
                Text('This info is visible to your teacher.',
                    style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[500])),
                const SizedBox(height: 12),
                _field(_parentNameCtrl, 'Parent Name',
                    Icons.people_outline, hint: 'e.g. Suresh Sharma'),
                const SizedBox(height: 12),
                _field(_parentPhoneCtrl, 'Parent Phone',
                    Icons.phone_outlined, hint: 'e.g. 9876543210',
                    keyboardType: TextInputType.phone,
                    formatters: [FilteringTextInputFormatter.digitsOnly]),

                const SizedBox(height: 12),
                // ── Guardian email — mandatory for password recovery ──────
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF8E1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFFE082)),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      const Icon(Icons.shield_outlined,
                          color: Color(0xFFE8A000), size: 16),
                      const SizedBox(width: 6),
                      Text('Recovery Email (Important!)',
                          style: GoogleFonts.nunito(
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF8B6800),
                              fontSize: 13)),
                    ]),
                    const SizedBox(height: 4),
                    Text(
                      'If you forget your password, a reset link will be sent here. Use a parent or guardian email that is regularly checked.',
                      style: GoogleFonts.nunito(
                          fontSize: 11,
                          color: const Color(0xFF6D4C41),
                          height: 1.4),
                    ),
                    const SizedBox(height: 10),
                    _field(_guardianEmailCtrl,
                        'Parent / Guardian Email',
                        Icons.email_outlined,
                        hint: 'e.g. parent@gmail.com',
                        keyboardType: TextInputType.emailAddress),
                  ]),
                ),

                const SizedBox(height: 28),
                _section('🌟 My Interests'),
                const SizedBox(height: 4),
                Text('Tap to select what you love:',
                    style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[500])),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: _allInterests.map((interest) {
                    final sel = _interests.contains(interest);
                    return GestureDetector(
                      onTap: () => setState(() {
                        sel ? _interests.remove(interest) : _interests.add(interest);
                      }),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: sel ? _primary : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                              color: sel ? _primary : const Color(0xFFDDE1FF),
                              width: sel ? 2 : 1),
                          boxShadow: sel ? [BoxShadow(
                              color: _primary.withOpacity(0.2),
                              blurRadius: 6, offset: const Offset(0, 2))] : [],
                        ),
                        child: Text(interest,
                            style: GoogleFonts.nunito(
                                fontSize: 13, fontWeight: FontWeight.w700,
                                color: sel ? Colors.white : _primary)),
                      ),
                    );
                  }).toList(),
                ),

                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _primary,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    child: _saving
                        ? const SizedBox(width: 22, height: 22,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : Text('Save Profile',
                            style: GoogleFonts.nunito(
                                fontSize: 16, fontWeight: FontWeight.w900,
                                color: Colors.white)),
                  ),
                ),
              ]),
            ),
    );
  }

  Widget _section(String text) => Text(text,
      style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w900,
          color: Colors.black87));

  Widget _field(TextEditingController ctrl, String label, IconData icon, {
    String? hint, int maxLines = 1, TextInputType? keyboardType,
    List<TextInputFormatter>? formatters,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE8EAFF)),
        boxShadow: [BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: TextField(
        controller: ctrl, maxLines: maxLines,
        keyboardType: keyboardType, inputFormatters: formatters,
        style: GoogleFonts.nunito(fontSize: 14, fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          labelText: label, hintText: hint,
          hintStyle: GoogleFonts.nunito(color: Colors.grey[400], fontSize: 13),
          prefixIcon: Icon(icon, color: _primary, size: 20),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          labelStyle: GoogleFonts.nunito(
              color: _primary.withOpacity(0.7), fontSize: 12,
              fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  @override
  void dispose() {
    for (final c in [_nameCtrl, _aboutCtrl, _gradeCtrl, _schoolCtrl,
                     _cityCtrl, _parentNameCtrl, _parentPhoneCtrl]) c.dispose();
    super.dispose();
  }
}
