import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class SubmitHappeningScreen extends StatefulWidget {
  const SubmitHappeningScreen({super.key});

  @override
  State<SubmitHappeningScreen> createState() => _SubmitHappeningScreenState();
}

class _SubmitHappeningScreenState extends State<SubmitHappeningScreen> {
  static const _primary = Color(0xFF5B6EF5);
  static const _bg = Color(0xFFF5F7FF);

  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _emojiCtrl = TextEditingController(text: '🏫');

  DateTime _date = DateTime.now();
  String _tag = 'NEW';
  bool _submitting = false;

  late final MiniguruApi _api;

  static const _tagOptions = ['NEW', 'UPCOMING', 'MILESTONE', 'AWARD'];

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _cityCtrl.dispose();
    _descCtrl.dispose();
    _emojiCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    final result = await _api.submitHappening({
      'title': _titleCtrl.text.trim(),
      'description': _descCtrl.text.trim(),
      'date': _date.toIso8601String(),
      'city': _cityCtrl.text.trim(),
      'tag': _tag,
      'emoji': _emojiCtrl.text.trim().isEmpty ? '🏫' : _emojiCtrl.text.trim(),
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
            const Text('🎉 '),
            Text('Submitted!', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
          ],
        ),
        content: Text(
          'Thanks! Your T-LAB Happening has been sent for admin review. '
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        title: Text('Share a T-LAB Happening',
            style: GoogleFonts.nunito(color: Colors.black87, fontWeight: FontWeight.w900, fontSize: 16)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Tell the community what\'s happening at your school or T-LAB — '
              'workshops, milestones, awards, or anything worth celebrating. '
              'An admin will review it before it goes live.',
              style: GoogleFonts.nunito(fontSize: 13, color: Colors.grey[600]),
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _titleCtrl,
              decoration: _decoration('Title', hint: 'e.g. Robotics Workshop Wraps Up'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
            ),
            const SizedBox(height: 14),
            InkWell(
              onTap: _pickDate,
              borderRadius: BorderRadius.circular(14),
              child: InputDecorator(
                decoration: _decoration('Date'),
                child: Text(
                  '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}',
                  style: GoogleFonts.nunito(fontSize: 14),
                ),
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _cityCtrl,
              decoration: _decoration('City', hint: 'e.g. Ujjain'),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _descCtrl,
              decoration: _decoration('Description', hint: 'What happened, and why it matters'),
              maxLines: 4,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Description is required' : null,
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: _tag,
              decoration: _decoration('Tag'),
              items: _tagOptions
                  .map((t) => DropdownMenuItem(value: t, child: Text(t, style: GoogleFonts.nunito())))
                  .toList(),
              onChanged: (v) => setState(() => _tag = v ?? 'NEW'),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _emojiCtrl,
              decoration: _decoration('Emoji (optional)', hint: '🏫'),
            ),
            const SizedBox(height: 28),
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