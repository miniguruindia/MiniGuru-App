// app/miniguru/lib/widgets/contactVerificationCard.dart
//
// Shows email/phone verification status (Verified / Unverified badge) and
// lets the account holder verify on-demand or change either contact at any
// time. Reused by both profile.dart (child) and mentorProfileTab.dart
// (parent/school) — verification is optional and never blocking anywhere
// in MiniGuru, per the product decision behind this feature.
//
// Backend contract (contactVerificationController.ts):
//   - Unverified contact → change applies immediately, still unverified.
//   - Verified contact → change needs approval: OTP to the OLD contact
//     (email only — no SMS provider exists for phone yet), or it falls
//     back to "pending admin approval" if the old contact is unreachable.

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:convert';
import '../network/MiniguruApi.dart';

class ContactVerificationCard extends StatefulWidget {
  final String? email;
  final String? guardianEmail;
  final String? phoneNumber;
  final bool emailVerified;
  final bool phoneVerified;
  final VoidCallback onChanged;

  const ContactVerificationCard({
    super.key,
    required this.email,
    required this.guardianEmail,
    required this.phoneNumber,
    required this.emailVerified,
    required this.phoneVerified,
    required this.onChanged,
  });

  @override
  State<ContactVerificationCard> createState() => _ContactVerificationCardState();
}

class _ContactVerificationCardState extends State<ContactVerificationCard> {
  final MiniguruApi _api = MiniguruApi();
  bool _busy = false;

  String get _displayEmail => (widget.guardianEmail?.isNotEmpty ?? false) ? widget.guardianEmail! : (widget.email ?? '—');
  String get _displayPhone => widget.phoneNumber?.isNotEmpty == true ? widget.phoneNumber! : 'Not set';

  Future<void> _verifyEmail() async {
    setState(() => _busy = true);
    try {
      final res = await _api.sendVerificationOtp('email');
      final body = jsonDecode(res.body);
      if (res.statusCode != 200) {
        _snack(body['error'] ?? 'Could not send code.', isError: true);
        return;
      }
      _snack('Code sent to ${body['maskedTarget'] ?? 'your email'}.');
      final otp = await _askOtp('Enter the code we emailed you');
      if (otp == null) return;
      final confirmRes = await _api.confirmVerificationOtp(otp);
      final confirmBody = jsonDecode(confirmRes.body);
      if (confirmRes.statusCode == 200) {
        _snack('Email verified! 🎉');
        widget.onChanged();
      } else {
        _snack(confirmBody['error'] ?? 'Incorrect code.', isError: true);
      }
    } catch (e) {
      _snack('Something went wrong: $e', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changeContact(String target) async {
    final controller = TextEditingController();
    final newValue = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Change ${target == 'email' ? 'email' : 'phone number'}'),
        content: TextField(
          controller: controller,
          keyboardType: target == 'email' ? TextInputType.emailAddress : TextInputType.phone,
          decoration: InputDecoration(hintText: target == 'email' ? 'new@email.com' : '+91XXXXXXXXXX'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Continue')),
        ],
      ),
    );
    if (newValue == null || newValue.isEmpty) return;

    setState(() => _busy = true);
    try {
      final res = await _api.requestContactChange(target, newValue);
      final body = jsonDecode(res.body);
      if (res.statusCode != 200) {
        _snack(body['error'] ?? 'Could not update.', isError: true);
        return;
      }
      if (body['applied'] == true) {
        _snack(body['message'] ?? 'Updated.');
        widget.onChanged();
      } else if (body['requiresOtpConfirm'] == true) {
        _snack('Confirmation code sent to ${body['maskedTarget'] ?? 'your old email'}.');
        final otp = await _askOtp('Enter the code sent to your OLD email to confirm this change');
        if (otp == null) return;
        final confirmRes = await _api.confirmContactChangeOtp(otp);
        final confirmBody = jsonDecode(confirmRes.body);
        if (confirmRes.statusCode == 200) {
          _snack('Email changed successfully.');
          widget.onChanged();
        } else {
          _snack(confirmBody['error'] ?? 'Incorrect code.', isError: true);
        }
      } else if (body['requiresAdminApproval'] == true) {
        _showApprovalNeededDialog(body['message'] ?? 'This needs manual approval.');
      }
    } catch (e) {
      _snack('Something went wrong: $e', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _askOtp(String title) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          maxLength: 6,
          decoration: const InputDecoration(hintText: '6-digit code'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Confirm')),
        ],
      ),
    );
  }

  void _showApprovalNeededDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Needs approval'),
        content: Text(message),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))],
      ),
    );
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: isError ? Colors.red.shade400 : null),
    );
  }

  Widget _badge(bool verified) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: verified ? Colors.green.shade50 : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: verified ? Colors.green.shade200 : Colors.orange.shade200),
      ),
      child: Text(
        verified ? 'Verified' : 'Unverified',
        style: GoogleFonts.nunito(
          fontWeight: FontWeight.w900,
          fontSize: 11,
          color: verified ? Colors.green.shade700 : Colors.orange.shade700,
        ),
      ),
    );
  }

  Widget _row({
    required IconData icon,
    required String label,
    required String value,
    required bool verified,
    required VoidCallback onChange,
    VoidCallback? onVerify,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: const Color(0xFF8888AA)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 12, color: const Color(0xFF8888AA))),
                Text(value, style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 14)),
              ],
            ),
          ),
          _badge(verified),
          const SizedBox(width: 8),
          if (!verified && onVerify != null)
            TextButton(onPressed: _busy ? null : onVerify, child: const Text('Verify')),
          TextButton(onPressed: _busy ? null : onChange, child: const Text('Change')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EAF6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text('📇 Contact Verification', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 15)),
          ),
          _row(
            icon: Icons.email_outlined,
            label: 'Email',
            value: _displayEmail,
            verified: widget.emailVerified,
            onChange: () => _changeContact('email'),
            onVerify: _verifyEmail,
          ),
          Divider(color: Colors.grey.shade100),
          _row(
            icon: Icons.phone_outlined,
            label: 'Phone',
            value: _displayPhone,
            verified: widget.phoneVerified,
            onChange: () => _changeContact('phone'),
            // No onVerify for phone yet — no SMS provider wired in. Tapping
            // "Change" still works; the backend routes phone verification
            // itself to a clear 501 explaining this if ever attempted.
          ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }
}