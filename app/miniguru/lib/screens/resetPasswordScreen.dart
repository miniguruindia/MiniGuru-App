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

class ResetPasswordScreen extends StatefulWidget {
  static const String id = '/reset-password';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
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
          const Icon(Icons.lock_reset, size: 48, color: pastelBlueText),
          const SizedBox(height: 16),
          Text('Set a New Password',
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text('Choose a new password for your MiniGuru account.',
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[600])),
          const SizedBox(height: 24),
          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red[50],
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.red[200]!),
              ),
              child: Text(_error!,
                  style: GoogleFonts.poppins(fontSize: 13, color: Colors.red[700])),
            ),
            const SizedBox(height: 16),
          ],
          TextFormField(
            controller: _passwordController,
            obscureText: _obscure1,
            style: GoogleFonts.poppins(fontSize: 14),
            decoration: InputDecoration(
              labelText: 'New Password',
              labelStyle: GoogleFonts.poppins(color: Colors.grey[600]),
              prefixIcon: Icon(Icons.lock_outline, color: Colors.grey[600]),
              suffixIcon: IconButton(
                icon: Icon(_obscure1 ? Icons.visibility_off : Icons.visibility,
                    color: Colors.grey[600]),
                onPressed: () => setState(() => _obscure1 = !_obscure1),
              ),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
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
            style: GoogleFonts.poppins(fontSize: 14),
            decoration: InputDecoration(
              labelText: 'Confirm New Password',
              labelStyle: GoogleFonts.poppins(color: Colors.grey[600]),
              prefixIcon: Icon(Icons.lock_outline, color: Colors.grey[600]),
              suffixIcon: IconButton(
                icon: Icon(_obscure2 ? Icons.visibility_off : Icons.visibility,
                    color: Colors.grey[600]),
                onPressed: () => setState(() => _obscure2 = !_obscure2),
              ),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
            validator: (v) {
              if (v != _passwordController.text) return 'Passwords do not match';
              return null;
            },
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: pastelBlueText,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text('Reset Password',
                      style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccess() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.check_circle, size: 56, color: Colors.green),
        const SizedBox(height: 16),
        Text('Password Updated!',
            style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text('You can now log in with your new password.',
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[600])),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: () => Navigator.of(context)
                .pushNamedAndRemoveUntil(LoginScreen.id, (route) => false),
            style: ElevatedButton.styleFrom(
              backgroundColor: pastelBlueText,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text('Go to Login',
                style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}
