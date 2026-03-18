import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class AddChildScreen extends StatefulWidget {
  const AddChildScreen({super.key});

  @override
  State<AddChildScreen> createState() => _AddChildScreenState();
}

class _AddChildScreenState extends State<AddChildScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _ageCtrl = TextEditingController();
  final _gradeCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _confirmPinCtrl = TextEditingController();

  bool _obscurePin = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;
  late MiniguruApi _api;

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _ageCtrl.dispose();
    _gradeCtrl.dispose();
    _pinCtrl.dispose();
    _confirmPinCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final success = await _api.addChildProfile(
        name: _nameCtrl.text.trim(),
        age: int.parse(_ageCtrl.text.trim()),
        grade: _gradeCtrl.text.trim().isEmpty ? null : _gradeCtrl.text.trim(),
        pin: _pinCtrl.text.trim(),
      );
      if (!mounted) return;
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${_nameCtrl.text.trim()} added successfully! 🎉',
              style: const TextStyle(color: Colors.white)),
          backgroundColor: Colors.green,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
        await Future.delayed(const Duration(milliseconds: 800));
        if (mounted) Navigator.pop(context, true);
      } else {
        _snack('Failed to add child. Please try again.', Colors.red);
      }
    } catch (e) {
      if (mounted) _snack('Connection error. Please try again.', Colors.red);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _snack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(color: Colors.white)),
      backgroundColor: color,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Add Child',
            style: GoogleFonts.nunito(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: Colors.black87)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                        colors: [Color(0xFF5B6EF5), Color(0xFF8B9FF8)]),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('👶', style: TextStyle(fontSize: 36)),
                      const SizedBox(height: 10),
                      Text('Register a Learner',
                          style: GoogleFonts.nunito(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: Colors.white)),
                      const SizedBox(height: 4),
                      Text(
                          'The child will use a 4-digit PIN\nto access their account',
                          style: GoogleFonts.nunito(
                              fontSize: 13,
                              color: Colors.white.withOpacity(0.85),
                              height: 1.4)),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                _label('Child\'s Details'),
                const SizedBox(height: 12),

                _field(
                  ctrl: _nameCtrl,
                  label: 'Full Name',
                  icon: Icons.person_outline,
                  validator: (v) =>
                      (v == null || v.isEmpty) ? 'Please enter child\'s name' : null,
                ),
                const SizedBox(height: 14),

                Row(
                  children: [
                    Expanded(
                      child: _field(
                        ctrl: _ageCtrl,
                        label: 'Age',
                        icon: Icons.cake_outlined,
                        keyboardType: TextInputType.number,
                        validator: (v) {
                          if (v == null || v.isEmpty) return 'Required';
                          final age = int.tryParse(v);
                          if (age == null || age < 5 || age > 18)
                            return 'Age 5–18';
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _field(
                        ctrl: _gradeCtrl,
                        label: 'Grade (optional)',
                        icon: Icons.school_outlined,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 28),

                _label('Set a 4-digit PIN'),
                const SizedBox(height: 6),
                Text(
                  'The child will use this PIN to switch to their account',
                  style: GoogleFonts.nunito(fontSize: 13, color: Colors.grey[500]),
                ),
                const SizedBox(height: 12),

                _field(
                  ctrl: _pinCtrl,
                  label: 'PIN',
                  icon: Icons.lock_outline,
                  keyboardType: TextInputType.number,
                  obscureText: _obscurePin,
                  suffixIcon: IconButton(
                    icon: Icon(
                        _obscurePin ? Icons.visibility_off : Icons.visibility,
                        color: Colors.grey[500],
                        size: 20),
                    onPressed: () =>
                        setState(() => _obscurePin = !_obscurePin),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Please enter a PIN';
                    if (v.length != 4) return 'PIN must be exactly 4 digits';
                    if (!RegExp(r'^\d{4}$').hasMatch(v))
                      return 'PIN must be numbers only';
                    return null;
                  },
                ),
                const SizedBox(height: 14),

                _field(
                  ctrl: _confirmPinCtrl,
                  label: 'Confirm PIN',
                  icon: Icons.lock_outline,
                  keyboardType: TextInputType.number,
                  obscureText: _obscureConfirm,
                  suffixIcon: IconButton(
                    icon: Icon(
                        _obscureConfirm ? Icons.visibility_off : Icons.visibility,
                        color: Colors.grey[500],
                        size: 20),
                    onPressed: () =>
                        setState(() => _obscureConfirm = !_obscureConfirm),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Please confirm PIN';
                    if (v != _pinCtrl.text) return 'PINs do not match';
                    return null;
                  },
                ),
                const SizedBox(height: 32),

                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: pastelBlueText,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                      elevation: 2,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : Text('Add Child',
                            style: GoogleFonts.nunito(
                                fontSize: 16, fontWeight: FontWeight.w900)),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String text) {
    return Text(text,
        style: GoogleFonts.nunito(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            color: Colors.grey[500],
            letterSpacing: 1.1));
  }

  Widget _field({
    required TextEditingController ctrl,
    required String label,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
    Widget? suffixIcon,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: ctrl,
      obscureText: obscureText,
      keyboardType: keyboardType,
      validator: validator,
      style: GoogleFonts.nunito(fontSize: 14, fontWeight: FontWeight.w600),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.nunito(color: Colors.grey[600], fontSize: 13),
        prefixIcon: Icon(icon, color: Colors.grey[600], size: 20),
        suffixIcon: suffixIcon,
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey[300]!)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey[300]!)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: pastelBlueText, width: 2)),
        errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Colors.red)),
        focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Colors.red, width: 2)),
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}
