import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';

/// "My Goins": balance, a welcome note about the 100 starter Goins, and the
/// list of Goins earned (newest first).
class GoinsHistoryScreen extends StatefulWidget {
  const GoinsHistoryScreen({super.key});
  @override
  State<GoinsHistoryScreen> createState() => _GoinsHistoryScreenState();
}

class _GoinsHistoryScreenState extends State<GoinsHistoryScreen> {
  bool _loading = true;
  bool _failed = false;
  int _balance = 0;
  List<dynamic> _events = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _failed = false; });
    final data = await MiniguruApi().getGoinsEvents();
    if (!mounted) return;
    if (data == null) {
      setState(() { _loading = false; _failed = true; });
      return;
    }
    setState(() {
      _loading = false;
      _balance = (data['balance'] as num?)?.toInt() ?? 0;
      _events = (data['events'] as List?) ?? [];
    });
  }

  String _label(Map e) {
    switch (e['source']) {
      case 'PROJECT_APPROVAL': return 'Project approved';
      case 'PEER_RATING': return 'Someone rated your project';
      case 'VIEW': return 'Watched a video';
      case 'COMMENT_GIVEN': return 'You commented';
      case 'COMMENT_RECEIVED': return 'Someone commented on your project';
      case 'RATING_GIVEN': return 'You rated a project';
      case 'DAILY_QUEST': return 'Daily Quest done';
      case 'TOPUP': return 'Goins top-up';
      case 'ADMIN_ADJUST': return 'Adjusted by MiniGuru';
      default: return (e['reason'] ?? 'Goins').toString();
    }
  }

  String _date(dynamic v) {
    final d = DateTime.tryParse(v?.toString() ?? '')?.toLocal();
    if (d == null) return '';
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${d.day} ${m[d.month - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FF),
      appBar: AppBar(
        title: Text('My Goins', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
        backgroundColor: const Color(0xFF0A6CFF),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0A6CFF)))
          : _failed
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text('Could not load your Goins.', style: GoogleFonts.nunito()),
                    TextButton(onPressed: _load, child: const Text('Try again')),
                  ]))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFFFFE259), Color(0xFFFFB800), Color(0xFFFF9500)]),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(children: [
                        Text('You have', style: GoogleFonts.nunito(fontWeight: FontWeight.w800, color: Colors.white)),
                        Text('$_balance Goins',
                            style: GoogleFonts.nunito(fontSize: 34, fontWeight: FontWeight.w900, color: Colors.white)),
                      ]),
                    ),
                    const SizedBox(height: 12),
                    _note('🎁', 'Welcome gift',
                        'Every new MiniGuru account starts with 100 Goins, so you can plan your first project right away.'),
                    const SizedBox(height: 8),
                    _note('🧰', 'Materials cost Goins',
                        'When you upload a project, its materials cost Goins. If you go below zero, no problem. You earn them back when your project is approved (you get 50 plus double the material cost).'),
                    const SizedBox(height: 16),
                    Text('Goins you earned', style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                    if (_events.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text('Nothing yet. Watch a video or finish a project to earn Goins!',
                            style: GoogleFonts.nunito(color: Colors.black54)),
                      )
                    else
                      ..._events.map((e) {
                        final amt = (e['amount'] as num?)?.toInt() ?? 0;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFCFE3FF)),
                          ),
                          child: Row(children: [
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(_label(e), style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                                Text(_date(e['createdAt']),
                                    style: GoogleFonts.nunito(fontSize: 11, color: Colors.black45)),
                              ]),
                            ),
                            Text('${amt >= 0 ? '+' : ''}$amt',
                                style: GoogleFonts.nunito(
                                    fontSize: 18, fontWeight: FontWeight.w900,
                                    color: amt >= 0 ? const Color(0xFF12B24A) : const Color(0xFFFF3B30))),
                          ]),
                        );
                      }),
                  ],
                ),
    );
  }

  Widget _note(String emoji, String title, String body) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFCFE3FF)),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(emoji, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
              const SizedBox(height: 2),
              Text(body, style: GoogleFonts.nunito(fontSize: 12, color: Colors.black87)),
            ]),
          ),
        ]),
      );
}
