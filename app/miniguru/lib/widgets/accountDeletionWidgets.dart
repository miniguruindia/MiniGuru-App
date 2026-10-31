// Self-service "Delete my account" (Oct 2026).
//  - DeleteAccountTile: quiet red tile at the bottom of Profile / My Account. Opens the steps,
//    or shows the open request with a Cancel button. A child in a parent's or school's list
//    can only ASK; hidden while a parent views a child.
//  - DeletionRequestsBanner: shown to parents and schools when a child in their list asked.
// Nothing is deleted at once: after 7 days an admin reviews it.
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/state/sessionState.dart';

const _blue = Color(0xFF0A6CFF);
const _red = Color(0xFFE53935);
const _yellow = Color(0xFFFFB800);

String _dateText(dynamic iso) {
  final d = DateTime.tryParse((iso ?? '').toString())?.toLocal();
  if (d == null) return 'soon';
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${d.day} ${m[d.month - 1]}';
}

class DeleteAccountTile extends StatefulWidget {
  const DeleteAccountTile({super.key});
  @override
  State<DeleteAccountTile> createState() => _DeleteAccountTileState();
}

class _DeleteAccountTileState extends State<DeleteAccountTile> {
  final MiniguruApi _api = MiniguruApi();
  bool _loading = true;
  bool _hide = false;
  bool _mustAsk = false;
  String? _guardian;
  Map<String, dynamic>? _req;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (SessionState.isChildSession) {
      setState(() { _loading = false; _hide = true; });
      return;
    }
    final r = await _api.accountDeletionCall('GET', '/mine');
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (r['_status'] != 200 || r['canDelete'] != true) {
        _hide = true;
        return;
      }
      _hide = false;
      _mustAsk = r['mustAsk'] == true;
      _guardian = r['guardianName']?.toString();
      _req = r['request'] is Map ? Map<String, dynamic>.from(r['request'] as Map) : null;
    });
  }

  Future<void> _cancel() async {
    final id = _req?['id']?.toString();
    if (id == null) return;
    await _api.accountDeletionCall('POST', '/$id/cancel');
    _load();
  }

  Future<void> _start() async {
    final mode = ValueNotifier<String>('keep');
    final typed = TextEditingController();
    final pw = TextEditingController();
    String? error;
    bool busy = false;
    final done = await showDialog<bool>(
      context: context,
      builder: (dctx) => StatefulBuilder(builder: (ctx, setD) {
        Widget opt(String v, String title, String sub) => InkWell(
              onTap: () => setD(() => mode.value = v),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: mode.value == v ? const Color(0xFFEEF4FF) : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: mode.value == v ? _blue : const Color(0xFFDCE6FA), width: 2),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 14)),
                  Text(sub, style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[700])),
                ]),
              ),
            );
        Future<void> send() async {
          setD(() { busy = true; error = null; });
          final r = await _api.accountDeletionCall('POST', '/request',
              body: {'mode': mode.value, 'confirm': typed.text.trim(), 'password': pw.text});
          if (r['_status'] == 201) {
            if (dctx.mounted) Navigator.pop(dctx, true);
          } else {
            setD(() { busy = false; error = (r['message'] ?? 'Could not send. Please try again.').toString(); });
          }
        }
        return AlertDialog(
          title: Text(_mustAsk ? 'Ask to delete my account' : 'Delete my account',
              style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('We are sorry to see you go. What should happen to your projects?',
                  style: GoogleFonts.nunito(fontSize: 13)),
              const SizedBox(height: 10),
              opt('keep', 'Keep my projects and videos',
                  'They stay on MiniGuru under the MiniGuru name, with no link to you. Your Goins go with them.'),
              opt('remove', 'Remove everything of mine',
                  'Projects, comments, ratings and Goins records are deleted. Videos already on YouTube are not touched.'),
              Text('Students you added keep their own logins, Goins and projects.',
                  style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[700])),
              const SizedBox(height: 12),
              Text('Type DELETE and enter your password to confirm it is you.',
                  style: GoogleFonts.nunito(fontSize: 13, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              TextField(controller: typed, enabled: !busy, textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(labelText: 'Type DELETE', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: pw, enabled: !busy, obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              Text(
                  _mustAsk
                      ? 'This sends a message to ${_guardian ?? 'your parent or school'}. They decide. If they agree, there is a 7-day wait you can cancel in.'
                      : 'Nothing happens at once. After 7 days the account is reviewed and deleted. Log in before then and tap Cancel to keep it.',
                  style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[700])),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(error!, style: GoogleFonts.nunito(color: _red, fontWeight: FontWeight.w700)),
              ],
            ]),
          ),
          actions: [
            TextButton(onPressed: busy ? null : () => Navigator.pop(dctx, false), child: const Text('Go back')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: _red, foregroundColor: Colors.white),
              onPressed: busy ? null : send,
              child: Text(busy ? 'Sending...' : (_mustAsk ? 'Send request' : 'Delete my account')),
            ),
          ],
        );
      }),
    );
    if (done == true) {
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          duration: const Duration(seconds: 8),
          content: Text(_mustAsk
              ? 'Your request was sent.'
              : 'Your account will be deleted after ${_dateText(_req?['deleteAfter'])}. Log in and tap Cancel to keep it.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _hide) return const SizedBox.shrink();
    if (_req != null) {
      final waiting = _req!['status'] == 'AWAITING_GUARDIAN';
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF4E5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _yellow.withOpacity(0.6)),
        ),
        child: Row(children: [
          const Icon(Icons.hourglass_top, color: _yellow),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
                waiting
                    ? 'You asked to delete your account. Waiting for ${_guardian ?? 'your parent or school'}.'
                    : 'Your account will be deleted after ${_dateText(_req!['deleteAfter'])}.',
                style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 13)),
          ),
          TextButton(onPressed: _cancel, child: const Text('Cancel')),
        ]),
      );
    }
    return InkWell(
      onTap: _start,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFFFD0D0)),
        ),
        child: Row(children: [
          const Icon(Icons.delete_outline, color: _red),
          const SizedBox(width: 10),
          Expanded(
            child: Text(_mustAsk ? 'Ask to delete my account' : 'Delete my account',
                style: GoogleFonts.nunito(fontWeight: FontWeight.w800, color: _red)),
          ),
          const Icon(Icons.chevron_right, color: _red),
        ]),
      ),
    );
  }
}

class DeletionRequestsBanner extends StatefulWidget {
  const DeletionRequestsBanner({super.key});
  @override
  State<DeletionRequestsBanner> createState() => _DeletionRequestsBannerState();
}

class _DeletionRequestsBannerState extends State<DeletionRequestsBanner> {
  final MiniguruApi _api = MiniguruApi();
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await _api.accountDeletionCall('GET', '/pending');
    if (!mounted) return;
    setState(() {
      _items = (r['requests'] is List)
          ? List<Map<String, dynamic>>.from((r['requests'] as List).map((e) => Map<String, dynamic>.from(e as Map)))
          : [];
    });
  }

  Future<void> _open() async {
    await showDialog(
      context: context,
      builder: (dctx) => StatefulBuilder(builder: (ctx, setD) {
        Future<void> act(Map<String, dynamic> it, String path, Map<String, dynamic>? body) async {
          final r = await _api.accountDeletionCall('POST', '/${it['id']}/$path', body: body);
          if (r['_status'] == 200) {
            setD(() => _items.removeWhere((x) => x['id'] == it['id']));
          } else if (ctx.mounted) {
            ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text((r['message'] ?? 'Could not complete that.').toString())));
            _load();
          }
        }
        return AlertDialog(
          title: Text('Deletion requests', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
          content: SizedBox(
            width: 380,
            child: _items.isEmpty
                ? const Text('No waiting requests.')
                : ListView(shrinkWrap: true, children: [
                    for (final it in _items)
                      Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(border: Border.all(color: const Color(0xFFDCE6FA)), borderRadius: BorderRadius.circular(12)),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${it['childName']} asked to delete their account',
                              style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text('If you agree there is a 7-day wait, and you or ${it['childName']} can cancel in that time.',
                              style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[700])),
                          const SizedBox(height: 8),
                          Wrap(spacing: 8, runSpacing: 4, children: [
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(backgroundColor: _red, foregroundColor: Colors.white),
                              onPressed: () => act(it, 'approve', {'mode': 'keep'}),
                              child: const Text('Delete, keep projects'),
                            ),
                            OutlinedButton(
                              onPressed: () => act(it, 'approve', {'mode': 'remove'}),
                              child: const Text('Delete, remove all'),
                            ),
                            TextButton(onPressed: () => act(it, 'decline', null), child: const Text('Not now')),
                          ]),
                        ]),
                      ),
                  ]),
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(dctx), child: const Text('Close'))],
        );
      }),
    );
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: _open,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFFEFA8),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _yellow.withOpacity(0.5)),
          ),
          child: Row(children: [
            const Icon(Icons.warning_amber_rounded, color: _yellow),
            const SizedBox(width: 10),
            Expanded(
              child: Text('${_items.length} account deletion request${_items.length == 1 ? '' : 's'} waiting. Tap to review',
                  style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
            ),
            const Icon(Icons.chevron_right),
          ]),
        ),
      ),
    );
  }
}
