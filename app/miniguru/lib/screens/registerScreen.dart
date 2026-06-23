import 'dart:async';
import 'dart:convert';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:miniguru/constants.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/legalScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/secrets.dart';

// ─── Account type enum ────────────────────────────────────────────────────────
enum _AccountType { child, parent, school }

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  static const String id = 'RegisterScreen';

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  // Step 1 = type picker, Step 2 = form, Step 3 = OTP (child only)
  int _step = 1;
  _AccountType? _selectedType;

  final _formKey = GlobalKey<FormState>();

  // ── Shared fields (parent / school) ────────────────────────────────────────
  final _nameCtrl         = TextEditingController();
  final _emailCtrl        = TextEditingController();
  final _passwordCtrl     = TextEditingController();
  final _confirmCtrl      = TextEditingController();
  final _ageCtrl          = TextEditingController();
  final _phoneCtrl        = TextEditingController();
  final _institutionCtrl  = TextEditingController();
  final _cityCtrl         = TextEditingController();
  final _stateCtrl        = TextEditingController();

  // ── Child-only fields ──────────────────────────────────────────────────────
  final _firstNameCtrl    = TextEditingController();
  final _lastNameCtrl     = TextEditingController();
  final _guardianEmailCtrl = TextEditingController();
  final _guardianNameCtrl  = TextEditingController();

  // ── Child OTP ──────────────────────────────────────────────────────────────
  final List<TextEditingController> _otpCtrls =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFoci =
      List.generate(6, (_) => FocusNode());

  // ── State ──────────────────────────────────────────────────────────────────
  String  _miniguruId   = '';
  bool    _checkingId   = false;
  bool    _obscurePassword = true;
  bool    _isChecked    = false;
  bool    _isLoading    = false;
  String? _otpError;
  Timer?  _debounce;

  late MiniguruApi _api;

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    _firstNameCtrl.addListener(_onNameChanged);
    _lastNameCtrl.addListener(_onNameChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _firstNameCtrl.removeListener(_onNameChanged);
    _lastNameCtrl.removeListener(_onNameChanged);
    for (final c in [
      _nameCtrl, _emailCtrl, _passwordCtrl, _confirmCtrl, _ageCtrl,
      _phoneCtrl, _institutionCtrl, _cityCtrl, _stateCtrl,
      _firstNameCtrl, _lastNameCtrl, _guardianEmailCtrl, _guardianNameCtrl,
    ]) c.dispose();
    for (final c in _otpCtrls) c.dispose();
    for (final f in _otpFoci) f.dispose();
    super.dispose();
  }

  // ─── Live MiniGuru ID generation ──────────────────────────────────────────
  void _onNameChanged() {
    _debounce?.cancel();
    final first = _firstNameCtrl.text.trim();
    final last  = _lastNameCtrl.text.trim();
    if (first.isEmpty || last.isEmpty) {
      setState(() => _miniguruId = '');
      return;
    }
    // Instant local preview
    final preview = '${first.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '')}.'
        '${last.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '')}@miniguru.in';
    setState(() => _miniguruId = preview);

    // Debounced server availability check
    _debounce = Timer(const Duration(milliseconds: 700), () => _checkIdAvailability(first, last));
  }

  Future<void> _checkIdAvailability(String first, String last) async {
    if (!mounted) return;
    setState(() => _checkingId = true);
    try {
      final res = await http.post(
        Uri.parse('$apiBaseUrl/auth/generate-id'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'firstName': first, 'lastName': last}),
      );
      if (res.statusCode == 200 && mounted) {
        final data = jsonDecode(res.body);
        setState(() => _miniguruId = data['miniguruId'] ?? _miniguruId);
      }
    } catch (_) {} // keep local preview on network error
    if (mounted) setState(() => _checkingId = false);
  }

  // ─── Parent / School submit (existing flow — unchanged) ───────────────────
  Future<void> _submitMentorOrSchool() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_isChecked) {
      _snack('Please accept the Terms & Conditions', Colors.orange);
      return;
    }
    setState(() => _isLoading = true);
    try {
      final mentorType = _selectedType == _AccountType.parent ? 'PARENT' : 'SCHOOL';
      final response = await _api.registerMentor(
        name:            _nameCtrl.text.trim(),
        email:           _emailCtrl.text.trim(),
        phoneNumber:     _phoneCtrl.text.trim(),
        password:        _passwordCtrl.text.trim(),
        mentorType:      mentorType,
        institutionName: _institutionCtrl.text.trim().isEmpty ? null : _institutionCtrl.text.trim(),
        city:            _cityCtrl.text.trim().isEmpty ? null : _cityCtrl.text.trim(),
        state:           _stateCtrl.text.trim().isEmpty ? null : _stateCtrl.text.trim(),
      );
      if (!mounted) return;
      if (response.statusCode == 201) {
        final body = jsonDecode(response.body);
        final loginEmail = body['user']?['email'] as String?;
        final typedEmail = _emailCtrl.text.trim();

        if (mentorType == 'SCHOOL' && loginEmail != null && loginEmail != typedEmail) {
          await showDialog(
            context: context,
            barrierDismissible: false,
            builder: (_) => AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              title: Text('Account Created! 🎉',
                  style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Your school login ID is:',
                      style: GoogleFonts.nunito(fontSize: 14)),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F2FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: SelectableText(loginEmail,
                        style: GoogleFonts.nunito(
                            fontWeight: FontWeight.w900, fontSize: 16)),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Save this — you will log in with this ID, not your email.',
                    style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text('Got it',
                      style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                ),
              ],
            ),
          );
        } else {
          _snack('Account created successfully!', Colors.green);
          await Future.delayed(const Duration(seconds: 1));
        }
        if (mounted) Navigator.of(context).pushNamedAndRemoveUntil(LoginScreen.id, (r) => false);
      } else {
        final body = jsonDecode(response.body);
        _snack(body['message'] ?? body['error'] ?? 'Registration failed', Colors.red);
      }
    } catch (_) {
      if (mounted) _snack('Connection error. Please try again.', Colors.red);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ─── Child Step 2 → send OTP ──────────────────────────────────────────────
  Future<void> _sendOtp({bool resend = false}) async {
    if (!resend && !_formKey.currentState!.validate()) return;
    if (!resend && !_isChecked) {
      _snack('Please accept the Terms & Conditions', Colors.orange);
      return;
    }
    if (_miniguruId.isEmpty) {
      _snack('Please enter first and last name', Colors.orange);
      return;
    }
    setState(() => _isLoading = true);
    try {
      final res = await http.post(
        Uri.parse('$apiBaseUrl/auth/send-otp'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'firstName':    _firstNameCtrl.text.trim(),
          'lastName':     _lastNameCtrl.text.trim(),
          'age':          int.tryParse(_ageCtrl.text.trim()) ?? 10,
          'guardianName': _guardianNameCtrl.text.trim(),
          'guardianEmail':_guardianEmailCtrl.text.trim(),
          'guardianPhone':_phoneCtrl.text.trim(),
          'password':     _passwordCtrl.text,
          'miniguruId':   _miniguruId,
        }),
      );
      if (!mounted) return;
      final data = jsonDecode(res.body);
      if (res.statusCode == 200) {
        if (resend) {
          _snack('New code sent to ${_guardianEmailCtrl.text.trim()}', Colors.green);
        } else {
          setState(() { _step = 3; _otpError = null; });
        }
      } else {
        _snack(data['error'] ?? 'Failed to send OTP', Colors.red);
      }
    } catch (_) {
      if (mounted) _snack('Connection error. Please try again.', Colors.red);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ─── Child Step 3 → verify OTP ────────────────────────────────────────────
  Future<void> _verifyOtp() async {
    final otp = _otpCtrls.map((c) => c.text).join();
    if (otp.length != 6) {
      setState(() => _otpError = 'Please enter the full 6-digit code');
      return;
    }
    setState(() { _isLoading = true; _otpError = null; });
    try {
      final res = await http.post(
        Uri.parse('$apiBaseUrl/auth/verify-otp'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'miniguruId': _miniguruId, 'otp': otp}),
      );
      if (!mounted) return;
      final data = jsonDecode(res.body);
      if (res.statusCode == 201) {
        _snack('🎉 Account created! Login with $_miniguruId', Colors.green);
        await Future.delayed(const Duration(seconds: 1));
        if (mounted) Navigator.of(context).pushNamedAndRemoveUntil(LoginScreen.id, (r) => false);
      } else {
        setState(() => _otpError = data['error'] ?? 'Incorrect code. Please try again.');
      }
    } catch (_) {
      if (mounted) setState(() => _otpError = 'Connection error. Please try again.');
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
            if (_step == 3) {
              setState(() => _step = 2);
            } else if (_step == 2) {
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
            child: _step == 1
                ? _buildTypePicker()
                : _step == 2
                    ? _buildForm()
                    : _buildOtpStep(),
          ),
        ),
      ),
    );
  }

  // ─── Step 1: Type Picker (UNCHANGED) ──────────────────────────────────────
  Widget _buildTypePicker() {
    return Column(
      children: [
        Hero(
          tag: 'app_logo',
          child: SizedBox(
            height: 60,
            child: Image.asset('assets/MGlogo.png', fit: BoxFit.contain,
                errorBuilder: (_, __, ___) =>
                    const Icon(Icons.rocket_launch, size: 40, color: pastelBlueText)),
          ),
        ),
        const SizedBox(height: 28),
        const SizedBox(height: 8),
        Text('MiniGuru',
            style: GoogleFonts.nunito(
                fontWeight: FontWeight.w900, fontSize: 32, color: const Color(0xFF1B5E20))),
        Text('Create Account',
            style: GoogleFonts.nunito(
                fontSize: 26, fontWeight: FontWeight.w900, color: Colors.black87)),
        const SizedBox(height: 8),
        Text('Who is joining MiniGuru?',
            style: GoogleFonts.nunito(fontSize: 15, color: Colors.grey[600])),
        const SizedBox(height: 36),
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
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: _selectedType == null ? null : () => setState(() => _step = 2),
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
                style: GoogleFonts.nunito(
                    fontSize: 14, color: pastelBlueText, fontWeight: FontWeight.w800),
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
              color: selected
                  ? pastelBlueText.withOpacity(0.15)
                  : Colors.black.withOpacity(0.04),
              blurRadius: selected ? 16 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(gradient: gradient, borderRadius: BorderRadius.circular(16)),
              child: Center(child: Text(emoji, style: const TextStyle(fontSize: 26))),
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
                      style: GoogleFonts.nunito(
                          fontSize: 12, color: Colors.grey[600], height: 1.4)),
                ],
              ),
            ),
            if (selected)
              Container(
                width: 24, height: 24,
                decoration: const BoxDecoration(color: pastelBlueText, shape: BoxShape.circle),
                child: const Icon(Icons.check, color: Colors.white, size: 16),
              )
            else
              Container(
                width: 24, height: 24,
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
    final isChild  = _selectedType == _AccountType.child;
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
                  isChild ? '🧒 Child / Individual'
                      : isSchool ? '🏫 School / T-LAB'
                      : '👨‍👩‍👧 Parent / Guardian',
                  style: GoogleFonts.nunito(
                      fontSize: 22, fontWeight: FontWeight.w900, color: Colors.black87),
                ),
                const SizedBox(height: 6),
                Text('Fill in your details below',
                    style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey[600])),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // ── CHILD FORM (new fields) ────────────────────────────────────────
          if (isChild) ...[
            // First + Last name row
            Row(
              children: [
                Expanded(
                  child: _field(
                    ctrl: _firstNameCtrl,
                    label: 'First Name',
                    icon: Icons.person_outline,
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _field(
                    ctrl: _lastNameCtrl,
                    label: 'Last Name',
                    icon: Icons.person_outline,
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // MiniGuru ID preview card
            if (_firstNameCtrl.text.trim().isNotEmpty && _lastNameCtrl.text.trim().isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8EAF6),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: pastelBlueText.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.badge_outlined, color: pastelBlueText, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('MiniGuru Login ID',
                              style: GoogleFonts.nunito(
                                  fontSize: 11, color: Colors.grey[600], fontWeight: FontWeight.w700)),
                          _checkingId
                              ? const SizedBox(
                                  height: 14,
                                  child: LinearProgressIndicator(
                                      backgroundColor: Color(0xFFD0D3F0),
                                      color: pastelBlueText),
                                )
                              : Text(
                                  _miniguruId.isNotEmpty ? _miniguruId : '…',
                                  style: GoogleFonts.nunito(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 14,
                                      color: pastelBlueText),
                                ),
                          Text('Child will use this ID to log in',
                              style: GoogleFonts.nunito(fontSize: 10, color: Colors.grey[500])),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 14),

            // Age
            _field(
              ctrl: _ageCtrl,
              label: 'Age',
              icon: Icons.cake_outlined,
              keyboardType: TextInputType.number,
              validator: (v) {
                if (v == null || v.isEmpty) return 'Please enter age';
                final age = int.tryParse(v);
                if (age == null || age < 5 || age > 18) return 'Age must be 5–18';
                return null;
              },
            ),
            const SizedBox(height: 14),

            // Guardian name
            _field(
              ctrl: _guardianNameCtrl,
              label: 'Parent / Guardian Name',
              icon: Icons.supervisor_account_outlined,
            ),
            const SizedBox(height: 14),

            // Guardian email — OTP goes here
            _field(
              ctrl: _guardianEmailCtrl,
              label: 'Guardian Email (for verification)',
              icon: Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
              helperText: 'A verification code will be sent here',
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Guardian email is required';
                if (!v.contains('@')) return 'Enter a valid email address';
                return null;
              },
            ),
            const SizedBox(height: 14),

            // Guardian phone (optional)
            _field(
              ctrl: _phoneCtrl,
              label: 'Guardian Phone (optional)',
              icon: Icons.phone_outlined,
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 14),
          ],

          // ── PARENT / SCHOOL FORM (unchanged) ──────────────────────────────
          if (!isChild) ...[
            _field(
              ctrl: _nameCtrl,
              label: isSchool ? 'Contact Person Name' : 'Full Name',
              icon: Icons.person_outline,
              validator: (v) => (v == null || v.isEmpty) ? 'Please enter your name' : null,
            ),
            const SizedBox(height: 14),
            _field(
              ctrl: _emailCtrl,
              label: 'Email',
              icon: Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
              validator: (v) {
                if (v == null || v.isEmpty) return 'Please enter your email';
                if (!v.contains('@')) return 'Please enter a valid email';
                return null;
              },
            ),
            const SizedBox(height: 14),
            _field(
              ctrl: _phoneCtrl,
              label: 'Phone Number',
              icon: Icons.phone_outlined,
              keyboardType: TextInputType.phone,
              validator: (v) {
                if (v == null || v.isEmpty) return 'Please enter your phone number';
                if (v.length < 10) return 'Please enter a valid phone number';
                return null;
              },
            ),
            const SizedBox(height: 14),
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
          ],

          // ── Password (all types) ────────────────────────────────────────────
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
              if (v == null || v.isEmpty) return 'Please enter a password';
              if (v.length < 6) return 'Password must be at least 6 characters';
              return null;
            },
          ),
          const SizedBox(height: 14),
          _field(
            ctrl: _confirmCtrl,
            label: 'Confirm Password',
            icon: Icons.lock_outline,
            obscureText: _obscurePassword,
            suffixIcon: IconButton(
              icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility,
                  color: Colors.grey[600]),
              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Please confirm your password';
              if (v != _passwordCtrl.text) return 'Passwords do not match';
              return null;
            },
          ),
          const SizedBox(height: 20),

          // Terms checkbox
          Row(
            children: [
              SizedBox(
                width: 24, height: 24,
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

          // Submit / Send OTP button
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton(
              onPressed: _isLoading
                  ? null
                  : () {
                      if (isChild) {
                        _sendOtp();
                      } else {
                        _submitMentorOrSchool();
                      }
                    },
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
                  : Text(
                      isChild ? 'Send Verification Code →' : 'Create Account',
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

  // ─── Step 3: OTP Verification (child only) ────────────────────────────────
  Widget _buildOtpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Verify Email 📧',
            style: GoogleFonts.nunito(
                fontSize: 24, fontWeight: FontWeight.w900, color: Colors.black87)),
        const SizedBox(height: 8),
        Text('Enter the 6-digit code sent to',
            style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey[600])),
        Text(_guardianEmailCtrl.text,
            style: GoogleFonts.nunito(
                fontSize: 14, fontWeight: FontWeight.w900, color: pastelBlueText)),
        const SizedBox(height: 8),

        // MiniGuru ID reminder
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFE8EAF6),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              const Icon(Icons.badge_outlined, color: pastelBlueText, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Login ID: $_miniguruId',
                  style: GoogleFonts.nunito(
                      fontSize: 12, fontWeight: FontWeight.w900, color: pastelBlueText),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // 6 OTP boxes
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (i) {
            return SizedBox(
              width: 46,
              child: TextField(
                controller: _otpCtrls[i],
                focusNode: _otpFoci[i],
                textAlign: TextAlign.center,
                keyboardType: TextInputType.number,
                maxLength: 1,
                style: GoogleFonts.nunito(
                    fontWeight: FontWeight.w900, fontSize: 24, color: Colors.black87),
                decoration: InputDecoration(
                  counterText: '',
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey[300]!)),
                  enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey[300]!)),
                  focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: pastelBlueText, width: 2)),
                ),
                onChanged: (v) {
                  if (v.isNotEmpty && i < 5) _otpFoci[i + 1].requestFocus();
                  if (v.isEmpty && i > 0) _otpFoci[i - 1].requestFocus();
                  // Auto-submit when all 6 filled
                  if (_otpCtrls.every((c) => c.text.isNotEmpty)) _verifyOtp();
                },
              ),
            );
          }),
        ),
        const SizedBox(height: 16),

        if (_otpError != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFEBEE),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(_otpError!,
                      style: GoogleFonts.nunito(color: Colors.red, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        const SizedBox(height: 24),

        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _verifyOtp,
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
                : Text('Create Account 🎉',
                    style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w900)),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: GestureDetector(
            onTap: _isLoading ? null : () => _sendOtp(resend: true),
            child: Text("Didn't receive it? Resend code",
                style: GoogleFonts.nunito(
                    color: pastelBlueText, fontWeight: FontWeight.w700, fontSize: 14)),
          ),
        ),
        const SizedBox(height: 28),

        // Save details reminder
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFE8F5E9),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF2E7D32).withOpacity(0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('📌 Save these login details!',
                  style: GoogleFonts.nunito(
                      fontWeight: FontWeight.w900, fontSize: 14, color: const Color(0xFF2E7D32))),
              const SizedBox(height: 8),
              Text('Login ID: $_miniguruId',
                  style: GoogleFonts.nunito(fontWeight: FontWeight.w700, fontSize: 13)),
              Text('Password: (the one you just set)',
                  style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[600])),
            ],
          ),
        ),
      ],
    );
  }

  // ─── Reusable text field (UNCHANGED) ──────────────────────────────────────
  Widget _field({
    required TextEditingController ctrl,
    required String label,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
    Widget? suffixIcon,
    String? Function(String?)? validator,
    String? helperText,
  }) {
    return TextFormField(
      controller: ctrl,
      obscureText: obscureText,
      keyboardType: keyboardType,
      validator: validator,
      style: GoogleFonts.nunito(fontSize: 14, fontWeight: FontWeight.w600),
      decoration: InputDecoration(
        labelText: label,
        helperText: helperText,
        helperStyle: GoogleFonts.nunito(fontSize: 11, color: Colors.grey[500]),
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
