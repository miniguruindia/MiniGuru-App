// lib/screens/notificationsScreen.dart
//
// Full "Notifications" page: one coloured row per notification (comment,
// like, message from the MiniGuru team ...), with the time and a "N new"
// pill at the top. Opened from the bell on Home and from Profile.

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/widgets/mgIcons.dart';

class NotificationsScreen extends StatefulWidget {
  static const String id = 'NotificationsScreen';
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _api = MiniguruApi();
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api.getNotifications();
      if (!mounted) return;
      setState(() {
        _items = data ?? [];
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _ago(dynamic ts) {
    if (ts == null) return '';
    try {
      final d = DateTime.parse(ts.toString()).toLocal();
      final diff = DateTime.now().difference(d);
      if (diff.inDays > 30) return '${(diff.inDays / 30).floor()}mo ago';
      if (diff.inDays > 0) return '${diff.inDays}d ago';
      if (diff.inHours > 0) return '${diff.inHours}h ago';
      if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
      return 'just now';
    } catch (_) {
      return '';
    }
  }

  // Colour + icon by notification type.
  (IconData, Color) _look(String type) {
    switch (type) {
      case 'comment':
        return (Icons.chat_bubble_rounded, GColors.blue);
      case 'like':
        return (Icons.star_rounded, GColors.yellow);
      case 'approved':
      case 'goins':
        return (Icons.check_circle_rounded, GColors.green);
      default:
        return (Icons.notifications_active_rounded, GColors.green);
    }
  }

  Widget _header() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 18),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF4285F4), Color(0xFF1A73E8)],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        const Icon(Icons.notifications_rounded, color: Color(0xFFFBBC04), size: 26),
        const SizedBox(width: 8),
        Expanded(
          child: Text('Notifications',
              style: GoogleFonts.nunito(
                  fontSize: 21, fontWeight: FontWeight.w900, color: Colors.white)),
        ),
        if (_items.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text('${_items.length} new',
                style: GoogleFonts.nunito(
                    fontSize: 12, fontWeight: FontWeight.w900, color: GColors.blue)),
          ),
      ]),
    );
  }

  Widget _row(dynamic n) {
    final m = n is Map ? n : const {};
    final (icon, color) = _look((m['type'] ?? '').toString());
    final message = (m['message'] ?? '').toString();
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.07),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        IconBadge(icon: icon, color: color),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(message,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.nunito(
                    fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF1A1A2E))),
            const SizedBox(height: 3),
            Text(_ago(m['createdAt']),
                style: GoogleFonts.nunito(
                    fontSize: 12, fontWeight: FontWeight.w600, color: Colors.black45)),
          ]),
        ),
      ]),
    );
  }

  Widget _empty() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 70),
        Center(child: IconBadge(icon: Icons.notifications_off_rounded, color: GColors.blue, size: 84)),
        const SizedBox(height: 16),
        Center(
          child: Text('No notifications yet',
              style: GoogleFonts.nunito(
                  fontSize: 17, fontWeight: FontWeight.w900, color: const Color(0xFF1A1A2E))),
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text('Comments, likes and messages from MiniGuru will show up here.',
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(fontSize: 13, color: Colors.black54)),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(children: [
          _header(),
          const SizedBox(height: 14),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: GColors.blue))
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _items.isEmpty
                        ? _empty()
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.only(bottom: 24),
                            itemCount: _items.length,
                            itemBuilder: (_, i) => _row(_items[i]),
                          ),
                  ),
          ),
        ]),
      ),
    );
  }
}
