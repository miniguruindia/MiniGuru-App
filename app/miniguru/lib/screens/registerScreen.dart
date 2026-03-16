import 'dart:convert';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:miniguru/constants.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/legalScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';

// ─── Account type enum ────────────────────────────────────────────────────────
enum _AccountType { child, parent, school }

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  static const String id = 'RegisterScreen';

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  // Step 1 = type picker, Step 2 = form
  int _step = 1;
  _AccountType? _selectedType;

  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _ageCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _institutionCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();

  bool _obscurePassword = true;
  bool _isChecked = false;
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
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _ageCtrl.dispose();
    _phoneCtrl.dispose();
    _institutionCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    super.dispose();
  }

  // ─── Submit ────────────────────────────────────────────────────────────────
  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_isChecked) {
      _snack('Please accept the Terms & Conditions', Colors.orange);
      return;
    }

    setState(() => _isLoading = true);
    try {
      late http.Response response;

      if (_selectedType == _AccountType.child) {
        response = await _api.register(
          _nameCtrl.text.trim(),
          _emailCtrl.text.trim(),
          _passwordCtrl.text.trim(),
          int.parse(_ageCtrl.text.trim()),
          _phoneCtrl.text.trim(),
        );
      } else {
        final mentorType = _selectedType == _AccountType.parent ? 'PARENT' : 'SCHOOL';
        response = await _api.registerMentor(
          name: _nameCtrl.text.trim(),
          email: _emailCtrl.text.trim(),
          phoneNumber: _phoneCtrl.text.trim(),
          password: _passwordCtrl.text.trim(),
          mentorType: mentorType,
          institutionName: _institutionCtrl.text.trim().isEmpty ? null : _institutionCtrl.text.trim(),
          city: _cityCtrl.text.trim().isEmpty ? null : _cityCtrl.text.trim(),
          state: _stateCtrl.text.trim().isEmpty ? null : _stateCtrl.text.trim(),
        );
      }

      if (!mounted) return;

      if (response.statusCode == 201) {
        _snack('Account created successfully!', Colors.green);
        await Future.delayed(const Duration(seconds: 1));
        if (mounted) {
          Navigator.of(context).pushNamedAndRemoveUntil(LoginScreen.id, (r) => false);
        }
      } else {
        final body = jsonDecode(response.body);
        final msg = body['message'] ?? body['error'] ?? 'Registration failed';
        _snack(msg, Colors.red);
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

  // ─── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () {
            if (_step == 2) {
              setState(() => _step = 1);
            } else {
              Navigator.pop(context);
            }
          },
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: _step == 1 ? _buildTypePicker() : _buildForm(),
          ),
        ),
      ),
    );
  }

  // ─── Step 1: Type Picker ───────────────────────────────────────────────────
  Widget _buildTypePicker() {
    return Column(
      children: [
        // Logo
        Hero(
          tag: 'app_logo',
          child: SizedBox(
            height: 60,
            child: Image.asset('assets/mg-logo.png', fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(Icons.rocket_launch, size: 40, color: pastelBlueText)),
          ),
        ),
        const SizedBox(height: 28),
        Text('Create Account',
            style: GoogleFonts.nunito(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.black87)),
        const SizedBox(height: 8),
        Text('Who is joining MiniGuru?',
            style: GoogleFonts.nunito(fontSize: 15, color: Colors.grey[600])),
        const SizedBox(height: 36),

        // Cards
        _typeCard(
          type: _AccountType.child,
          emoji: '🧒',
          title: 'Child / Individual',
          subtitle: 'I am a student aged 8–14\nregistering for myself',
          gradient: const LinearGradient(colors: [Color(0xFF5B6EF5), Color(0xFF8B9FF8)]),
        ),
        const SizedBox(height: 16),
        _typeCard(
          type: _AccountType.parent,
          emoji: '👨‍👩‍👧',
          title: 'Parent / Guardian',
          subtitle: 'I am registering my child\nor children',
          gradient: const LinearGradient(colors: [Color(0xFFE8A000), Color(0xFFF5C842)]),
        ),
        const SizedBox(height: 16),
        _typeCard(
          type: _AccountType.school,
          emoji: '🏫',
          title: 'School / T-LAB',
          subtitle: 'I am registering students\nfrom a school or makerspace',
          gradient: const LinearGradient(colors: [Color(0xFF2ECC71), Color(0xFF55E89D)]),
        ),
        const SizedBox(height: 32),

        // Continue button
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: _selectedType == null
                ? null
                : () => setState(() => _step = 2),
            style: ElevatedButton.styleFrom(
              backgroundColor: pastelBlueText,
              disabledBackgroundColor: Colors.grey[300],
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 2,
            ),
            child: Text('Continue',
                style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w900)),
          ),
        ),
        const SizedBox(height: 20),
        RichText(
          text: TextSpan(
            text: 'Already have an account? ',
            style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey[600]),
            children: [
              TextSpan(
                text: 'Login',
                style: GoogleFonts.nunito(fontSize: 14, color: pastelBlueText, fontWeight: FontWeight.w800),
                recognizer: TapGestureRecognizer()..onTap = () => Navigator.pop(context),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _typeCard({
    required _AccountType type,
    required String emoji,
    required String title,
    required String subtitle,
    required Gradient gradient,
  }) {
    final selected = _selectedType == type;
    return GestureDetector(
      onTap: () => setState(() => _selectedType = type),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? pastelBlueText : Colors.grey[200]!,
            width: selected ? 2.5 : 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: selected ? pastelBlueText.withOpacity(0.15) : Colors.black.withOpacity(0.04),
              blurRadius: selected ? 16 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            // Emoji circle with gradient
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: gradient,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: Text(emoji, style: const TextStyle(fontSize: 26)),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: GoogleFonts.nunito(
                          fontSize: 16, fontWeight: FontWeight.w900, color: Colors.black87)),
                  const SizedBox(height: 4),
                  Text(subtitle,
                      style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[600], height: 1.4)),
                ],
              ),
            ),
            if (selected)
              Container(
                width: 24,
                height: 24,
                decoration: const BoxDecoration(color: pastelBlueText, shape: BoxShape.circle),
                child: const Icon(Icons.check, color: Colors.white, size: 16),
              )
            else
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.grey[300]!, width: 2),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ─── Step 2: Form ──────────────────────────────────────────────────────────
  Widget _buildForm() {
    final isChild = _selectedType == _AccountType.child;
    final isSchool = _selectedType == _AccountType.school;

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Center(
            child: Column(
              children: [
                Text(
                  isChild ? '🧒 Child / Individual' : isSchool ? '🏫 School / T-LAB' : '👨‍👩‍👧 Parent / Guardian',
                  style: GoogleFonts.nunito(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.black87),
                ),
                const SizedBox(height: 6),
                Text('Fill in your details below',
                    style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey[600])),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // Common fields
          _field(ctrl: _nameCtrl, label: isSchool ? 'Contact Person Name' : 'Full Name', icon: Icons.person_outline,
              validator: (v) => (v == null || v.isEmpty) ? 'Please enter your name' : null),
          const SizedBox(height: 14),
          _field(ctrl: _emailCtrl, label: 'Email', icon: Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
              validator: (v) {
                if (v == null || v.isEmpty) return 'Please enter your email';
                if (!v.contains('@')) return 'Please enter a valid email';
                return null;
              }),
          const SizedBox(height: 14),
          _field(ctrl: _phoneCtrl, label: 'Phone Number', icon: Icons.phone_outlined,
              keyboardType: TextInputType.phone,
              validator: (v) {
                if (v == null || v.isEmpty) return 'Please enter your phone number';
                if (v.length < 10) return 'Please enter a valid phone number';
                return null;
              }),
          const SizedBox(height: 14),

          // Age — only for child
          if (isChild) ...[
            _field(ctrl: _ageCtrl, label: 'Age', icon: Icons.cake_outlined,
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Please enter your age';
                  final age = int.tryParse(v);
                  if (age == null || age < 5 || age > 18) return 'Please enter a valid age (5–18)';
                  return null;
                }),
            const SizedBox(height: 14),
          ],

          // Institution name — school only (required) / parent (optional)
          if (!isChild) ...[
            _field(
              ctrl: _institutionCtrl,
              label: isSchool ? 'Institution Name' : 'Institution Name (optional)',
              icon: Icons.business_outlined,
              validator: isSchool
                  ? (v) => (v == null || v.isEmpty) ? 'Please enter institution name' : null
                  : null,
            ),
            const SizedBox(height: 14),
            _field(ctrl: _cityCtrl, label: 'City', icon: Icons.location_city_outlined),
            const SizedBox(height: 14),
            _field(ctrl: _stateCtrl, label: 'State', icon: Icons.map_outlined),
            const SizedBox(height: 14),
          ],

          // Password
          _field(
            ctrl: _passwordCtrl,
            label: 'Password',
            icon: Icons.lock_outline,
            obscureText: _obscurePassword,
            suffixIcon: IconButton(
              icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility,
                  color: Colors.grey[600]),
              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Please enter your password';
              if (v.length < 6) return 'Password must be at least 6 characters';
              return null;
            },
          ),
          const SizedBox(height: 20),

          // Terms checkbox
          Row(
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: Checkbox(
                  value: _isChecked,
                  onChanged: (v) => setState(() => _isChecked = v ?? false),
                  activeColor: pastelBlueText,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    text: 'I agree to the ',
                    style: GoogleFonts.nunito(fontSize: 13, color: Colors.grey[700]),
                    children: [
                      TextSpan(
                        text: 'Terms & Conditions',
                        style: GoogleFonts.nunito(
                            fontSize: 13, color: pastelBlueText, fontWeight: FontWeight.w800),
                        recognizer: TapGestureRecognizer()
                          ..onTap = () => Navigator.push(context,
                              MaterialPageRoute(builder: (_) => const LegalScreen(initialTab: 1))),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Submit button
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: pastelBlueText,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 2,
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 24, height: 24,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text('Create Account',
                      style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w900)),
            ),
          ),
          const SizedBox(height: 20),
          Center(
            child: RichText(
              text: TextSpan(
                text: 'Already have an account? ',
                style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey[600]),
                children: [
                  TextSpan(
                    text: 'Login',
                    style: GoogleFonts.nunito(
                        fontSize: 14, color: pastelBlueText, fontWeight: FontWeight.w800),
                    recognizer: TapGestureRecognizer()
                      ..onTap = () => Navigator.of(context)
                          .pushNamedAndRemoveUntil(LoginScreen.id, (r) => false),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Reusable text field ───────────────────────────────────────────────────
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
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}