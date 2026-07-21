import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class SubmitChallengeScreen extends StatefulWidget {
  const SubmitChallengeScreen({super.key});

  @override
  State<SubmitChallengeScreen> createState() => _SubmitChallengeScreenState();
}

class _SubmitChallengeScreenState extends State<SubmitChallengeScreen> {
  static const _primary = Color(0xFF5B6EF5);
  static const _bg = Color(0xFFF5F7FF);

  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _rewardCtrl = TextEditingController(text: '100');

  DateTime _endDate = DateTime.now().add(const Duration(days: 14));
  String _difficulty = 'Medium';
  String _audience = 'OWN_SCHOOL'; // 'OWN_SCHOOL' or 'ALL'
  bool _submitting = false;

  late final MiniguruApi _api;

  static const _difficultyOptions = ['Easy', 'Medium', 'Hard'];

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _categoryCtrl.dispose();
    _descCtrl.dispose();
    _rewardCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickEndDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _endDate,
      firstDate: DateTime.now(),
      lastDate: DateTime(2030),
    );
    if (picked != null) setState(() => _endDate = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    final result = await _api.submitChallenge({
      'title': _titleCtrl.text.trim(),
      'description': _descCtrl.text.trim(),
      'category': _categoryCtrl.text.trim(),
      'difficulty': _difficulty,
      'goinsReward': int.tryParse(_rewardCtrl.text.trim()) ?? 100,
      'endDate': _endDate.toIso8601String(),
      'audience': _audience,
    });

    if (!mounted) return;
    setState(() => _submitting = false);

    if (result['error'] != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['error'].toString())),
      );
      return;
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Text('🏆 '),
            Text('Submitted!', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
          ],
        ),
        content: Text(
          'Thanks! Your STEAM Challenge has been sent for admin review. '
          'It will appear on the Community page once approved.',
          style: GoogleFonts.nunito(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // close dialog
              Navigator.of(context).pop(true); // close screen, signal success
            },
            child: Text('OK', style: GoogleFonts.nunito(fontWeight: FontWeight.w800, color: _primary)),
          ),
        ],
      ),
    );
  }

  InputDecoration _decoration(String label, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      labelStyle: GoogleFonts.nunito(color: _primary, fontWeight: FontWeight.w700, fontSize: 13),
      hintStyle: GoogleFonts.nunito(color: Colors.grey[400], fontSize: 13),
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  Widget _audienceOption({
    required String value,
    required String title,
    required String subtitle,
    required IconData icon,
  }) {
    final selected = _audience == value;
    return GestureDetector(
      onTap: () => setState(() => _audience = value),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? _primary : Colors.transparent, width: 2),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Row(
          children: [
            Icon(icon, color: selected ? _primary : Colors.grey[400], size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 14)),
                  Text(subtitle, style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[500])),
                ],
              ),
            ),
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
              color: selected ? _primary : Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        title: Text('Submit a STEAM Challenge',
            style: GoogleFonts.nunito(color: Colors.black87, fontWeight: FontWeight.w900, fontSize: 16)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Set a challenge for children to build. An admin will review it '
              'before it appears on the Community page.',
              style: GoogleFonts.nunito(fontSize: 13, color: Colors.grey[600]),
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _titleCtrl,
              decoration: _decoration('Title', hint: 'e.g. Bridge Builder Challenge'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _categoryCtrl,
              decoration: _decoration('Category', hint: 'e.g. Mechanics, Science, Electronics'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Category is required' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _descCtrl,
              decoration: _decoration('Description', hint: 'What should children build, and the rules'),
              maxLines: 4,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Description is required' : null,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _rewardCtrl,
                    keyboardType: TextInputType.number,
                    decoration: _decoration('Goins Reward'),
                    validator: (v) => (int.tryParse(v ?? '') == null) ? 'Enter a number' : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _difficulty,
                    decoration: _decoration('Difficulty'),
                    items: _difficultyOptions
                        .map((d) => DropdownMenuItem(value: d, child: Text(d, style: GoogleFonts.nunito())))
                        .toList(),
                    onChanged: (v) => setState(() => _difficulty = v ?? 'Medium'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            InkWell(
              onTap: _pickEndDate,
              borderRadius: BorderRadius.circular(14),
              child: InputDecorator(
                decoration: _decoration('End Date'),
                child: Text(
                  '${_endDate.year}-${_endDate.month.toString().padLeft(2, '0')}-${_endDate.day.toString().padLeft(2, '0')}',
                  style: GoogleFonts.nunito(fontSize: 14),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text('Who can join?', style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 14)),
            const SizedBox(height: 10),
            _audienceOption(
              value: 'OWN_SCHOOL',
              title: 'My school\'s children only',
              subtitle: 'Only children linked under your account will see this',
              icon: Icons.school_outlined,
            ),
            _audienceOption(
              value: 'ALL',
              title: 'Open to everyone',
              subtitle: 'Every child on MiniGuru can see and join this',
              icon: Icons.public,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _submitting
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                    : Text('Submit for Review',
                        style: GoogleFonts.nunito(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}