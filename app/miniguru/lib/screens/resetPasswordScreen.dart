// lib/screens/resetPasswordScreen.dart
// Completes a password reset started from the emailed link
// (https://miniguru.in/reset-password?token=...). Reuses the existing
// MiniguruApi.resetPassword(token, newPassword) method.
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/widgets/mgIcons.dart';

class ResetPasswordScreen extends StatefulWidget {
  static const String id = '/reset-password';
  // Set once the password is changed, so main.dart stops treating the (still
  // present) reset link in the browser address as a reason to show this screen.
  static bool completed = false;
  final String token;
  const ResetPasswordScreen({super.key, required this.token});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  final _api = MiniguruApi();
  bool _obscure1 = true, _obscure2 = true;
  bool _submitting = false;
  String? _error;
  bool _done = false;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final response =
          await _api.resetPassword(widget.token, _passwordController.text.trim());
      final body = jsonDecode(response.body);
      if (response.statusCode == 200) {
        ResetPasswordScreen.completed = true;
        setState(() => _done = true);
      } else {
        setState(() => _error =
            body['error'] ?? 'Could not reset password. The link may have expired.');
      }
    } catch (e) {
      setState(() => _error = 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  InputDecoration _fieldDecoration(String label, bool obscure, VoidCallback toggle) {
    OutlineInputBorder border(Color c, [double w = 1.4]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: c, width: w),
        );
    return InputDecoration(
      labelText: label,
      labelStyle: GoogleFonts.nunito(color: Colors.grey[700], fontWeight: FontWeight.w600),
      prefixIcon: const Icon(Icons.lock_rounded, color: GColors.yellow),
      suffixIcon: IconButton(
        icon: Icon(obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
            color: GColors.blue),
        onPressed: toggle,
      ),
      filled: true,
      fillColor: GColors.blueLight.withOpacity(0.5),
      enabledBorder: border(const Color(0xFFD2E3FC)),
      focusedBorder: border(GColors.blue, 2),
      errorBorder: border(GColors.red),
      focusedErrorBorder: border(GColors.red, 2),
    );
  }

  Widget _bigIcon(IconData icon, Color color) => Center(
        child: Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(color: color.withOpacity(0.16), shape: BoxShape.circle),
          child: Icon(icon, size: 50, color: color),
        ),
      );

  Widget _bigButton(String text, VoidCallback? onPressed, {bool busy = false, Color color = GColors.blue}) {
    return SizedBox(
      height: 54,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
        child: busy
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : Text(text, style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w800)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: _done ? _buildSuccess() : _buildForm(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _bigIcon(Icons.lock_rounded, GColors.yellow),
          const SizedBox(height: 20),
          Text('Set a New Password',
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                  fontSize: 26, fontWeight: FontWeight.w900, color: const Color(0xFF1A1A2E))),
          const SizedBox(height: 8),
          Text('Choose a new password for your MiniGuru account.',
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey[600])),
          const SizedBox(height: 26),
          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: GColors.redLight,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: GColors.red.withOpacity(0.4)),
              ),
              child: Row(children: [
                const Icon(Icons.error_rounded, color: GColors.red, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(_error!,
                      style: GoogleFonts.nunito(
                          fontSize: 13, fontWeight: FontWeight.w700, color: GColors.redDark)),
                ),
              ]),
            ),
            const SizedBox(height: 16),
          ],
          TextFormField(
            controller: _passwordController,
            obscureText: _obscure1,
            style: GoogleFonts.nunito(fontSize: 15, fontWeight: FontWeight.w700),
            decoration: _fieldDecoration(
                'New Password', _obscure1, () => setState(() => _obscure1 = !_obscure1)),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Please enter a new password';
              if (v.length < 6) return 'Password must be at least 6 characters';
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _confirmController,
            obscureText: _obscure2,
            style: GoogleFonts.nunito(fontSize: 15, fontWeight: FontWeight.w700),
            decoration: _fieldDecoration(
                'Confirm New Password', _obscure2, () => setState(() => _obscure2 = !_obscure2)),
            validator: (v) {
              if (v != _passwordController.text) return 'Passwords do not match';
              return null;
            },
          ),
          const SizedBox(height: 26),
          _bigButton('Reset Password', _submitting ? null : _submit, busy: _submitting),
        ],
      ),
    );
  }

  Widget _buildSuccess() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _bigIcon(Icons.check_circle_rounded, GColors.green),
        const SizedBox(height: 20),
        Text('Password Updated!',
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(
                fontSize: 26, fontWeight: FontWeight.w900, color: const Color(0xFF1A1A2E))),
        const SizedBox(height: 8),
        Text('You can now log in with your new password.',
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(fontSize: 14, color: Colors.grey[600])),
        const SizedBox(height: 26),
        _bigButton(
          'Go to Login',
          () => Navigator.of(context)
              .pushNamedAndRemoveUntil(LoginScreen.id, (route) => false),
        ),
      ],
    );
  }
}
