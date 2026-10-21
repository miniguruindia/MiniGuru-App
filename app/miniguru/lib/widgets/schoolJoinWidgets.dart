// Child -> school join requests (Oct 2026).
//  - SchoolJoinCard: shown on a learner's Profile. Lets an independent child ask a
//    school to add them (school login ID), shows waiting / declined requests.
//  - SchoolJoinBanner: shown on the school's learner list when requests are waiting.
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';

const _blue = Color(0xFF0A6CFF);
const _green = Color(0xFF12B24A);
const _red = Color(0xFFFF3B30);
const _yellow = Color(0xFFFFB800);

class SchoolJoinCard extends StatefulWidget {
  const SchoolJoinCard({super.key});
  @override
  State<SchoolJoinCard> createState() => _SchoolJoinCardState();
}

class _SchoolJoinCardState extends State<SchoolJoinCard> {
  final MiniguruApi _api = MiniguruApi();
  bool _loading = true;
  bool _hide = false;
  String? _schoolName;
  List<Map<String, dynamic>> _requests = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await _api.schoolJoinCall('GET', '/mine');
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (r['_status'] != 200 || r['isMentor'] == true) {
        _hide = true;
        return;
      }
      _hide = false;
      _schoolName = (r['inSchool'] is Map) ? (r['inSchool']['name'] ?? '').toString() : null;
      _requests = (r['requests'] is List)
          ? List<Map<String, dynamic>>.from((r['requests'] as List).map((e) => Map<String, dynamic>.from(e as Map)))
          : [];
    });
  }

  Future<void> _askDialog() async {
    final ctrl = TextEditingController();
    String? error;
    String? schoolName;
    bool busy = false;
    await showDialog(
      context: context,
      builder: (dctx) => StatefulBuilder(builder: (ctx, setD) {
        Future<void> find() async {
          setD(() { busy = true; error = null; schoolName = null; });
          final r = await _api.schoolJoinCall('GET', '/school-lookup?loginId=${Uri.encodeQueryComponent(ctrl.text.trim())}');
          setD(() {
            busy = false;
            if (r['_status'] == 200) { schoolName = (r['schoolName'] ?? '').toString(); }
            else { error = (r['message'] ?? 'Could not find that school.').toString(); }
          });
        }
        Future<void> send() async {
          setD(() { busy = true; error = null; });
          final r = await _api.schoolJoinCall('POST', '/request', body: {'loginId': ctrl.text.trim()});
          if (r['_status'] == 201) {
            if (dctx.mounted) Navigator.pop(dctx);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Request sent. Your teacher will see it.')));
              _load();
            }
          } else {
            setD(() { busy = false; error = (r['message'] ?? 'Could not send the request.').toString(); });
          }
        }
        return AlertDialog(
          title: Text('Join my school', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text("Ask your teacher for the school's MiniGuru login ID (for example sunrise.ujjain@miniguru.in).",
                  style: GoogleFonts.nunito(fontSize: 13, color: Colors.grey[700])),
              const SizedBox(height: 12),
              TextField(
                controller: ctrl,
                enabled: schoolName == null && !busy,
                decoration: const InputDecoration(labelText: 'School login ID', border: OutlineInputBorder()),
                onSubmitted: (_) { if (schoolName == null && !busy) find(); },
              ),
              if (schoolName != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFC8F2D4), borderRadius: BorderRadius.circular(12)),
                  child: Text('Found: $schoolName\nSend a request to join?',
                      style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                ),
                const SizedBox(height: 8),
                Text('You keep your own account, Goins and projects.',
                    style: GoogleFonts.nunito(fontSize: 12, color: Colors.grey[700])),
              ],
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(error!, style: GoogleFonts.nunito(color: _red, fontWeight: FontWeight.w700)),
              ],
            ]),
          ),
          actions: [
            TextButton(onPressed: busy ? null : () => Navigator.pop(dctx), child: const Text('Cancel')),
            if (schoolName == null)
              ElevatedButton(onPressed: busy ? null : find, child: Text(busy ? 'Searching...' : 'Find school'))
            else
              ElevatedButton(onPressed: busy ? null : send, child: Text(busy ? 'Sending...' : 'Send request')),
          ],
        );
      }),
    );
  }

  Future<void> _cancel(String id) async {
    await _api.schoolJoinCall('POST', '/$id/cancel');
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _hide) return const SizedBox.shrink();
    final pending = _requests.where((r) => r['status'] == 'PENDING').toList();
    final declined = _requests.where((r) => r['status'] == 'DECLINED').toList();
    return Container(
      margin: const EdgeInsets.only(top: 18),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _blue.withOpacity(0.25)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.school, color: _blue),
          const SizedBox(width: 8),
          Text('My school', style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 8),
        if (_schoolName != null && _schoolName!.isNotEmpty)
          Text('You are in: $_schoolName', style: GoogleFonts.nunito(fontWeight: FontWeight.w800, color: _green))
        else ...[
          Text("Not in a school list yet. Ask your school to add you.",
              style: GoogleFonts.nunito(fontSize: 13, color: Colors.grey[700])),
          for (final r in pending)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(children: [
                const Icon(Icons.hourglass_top, size: 16, color: _yellow),
                const SizedBox(width: 6),
                Expanded(child: Text('Waiting: ${r['schoolName']}', style: GoogleFonts.nunito(fontWeight: FontWeight.w700))),
                TextButton(onPressed: () => _cancel(r['id'].toString()), child: const Text('Cancel')),
              ]),
            ),
          for (final r in declined)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('${r['schoolName']} did not accept the request.',
                  style: GoogleFonts.nunito(fontSize: 12, color: _red)),
            ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _askDialog,
            icon: const Icon(Icons.add_link),
            label: const Text('Join my school'),
          ),
        ],
      ]),
    );
  }
}

class SchoolJoinBanner extends StatefulWidget {
  /// Called after a child is approved so the learner list can reload.
  final VoidCallback onChanged;
  const SchoolJoinBanner({super.key, required this.onChanged});
  @override
  State<SchoolJoinBanner> createState() => _SchoolJoinBannerState();
}

class _SchoolJoinBannerState extends State<SchoolJoinBanner> {
  final MiniguruApi _api = MiniguruApi();
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await _api.schoolJoinCall('GET', '/pending');
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
        Future<void> act(Map<String, dynamic> it, bool approve) async {
          final r = await _api.schoolJoinCall('POST', '/${it['id']}/${approve ? 'approve' : 'decline'}');
          if (r['_status'] == 200) {
            setD(() => _items.removeWhere((x) => x['id'] == it['id']));
            if (approve) {
              widget.onChanged();
              if (ctx.mounted) {
                ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                  duration: const Duration(seconds: 10),
                  content: Text('${it['childName']} added. PIN for your view: ${r['pin']} (note it down)')));
              }
            }
          } else if (ctx.mounted) {
            ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text((r['message'] ?? 'Could not complete that.').toString())));
            _load();
          }
        }
        return AlertDialog(
          title: Text('Join requests', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
          content: SizedBox(
            width: 380,
            child: _items.isEmpty
                ? const Text('No waiting requests.')
                : ListView(shrinkWrap: true, children: [
                    for (final it in _items)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('${it['childName']}', style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                        subtitle: Text('${it['loginId'] ?? ''}${it['childAge'] != null ? '  ·  age ${it['childAge']}' : ''}',
                            style: GoogleFonts.nunito(fontSize: 12)),
                        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                          IconButton(tooltip: 'Decline', icon: const Icon(Icons.close, color: _red), onPressed: () => act(it, false)),
                          IconButton(tooltip: 'Approve', icon: const Icon(Icons.check_circle, color: _green), onPressed: () => act(it, true)),
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
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
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
            const Icon(Icons.school, color: _yellow),
            const SizedBox(width: 10),
            Expanded(
              child: Text('${_items.length} child${_items.length == 1 ? '' : 'ren'} asked to join your school — tap to review',
                  style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
            ),
            const Icon(Icons.chevron_right),
          ]),
        ),
      ),
    );
  }
}
