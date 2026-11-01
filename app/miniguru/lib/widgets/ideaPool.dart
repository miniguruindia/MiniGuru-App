// Idea Pool (Nov 2026): ideas children shared for others to try, plus finished projects.
// Search by words or by ID (MG-SSK-PK-0042 for ideas/projects, MG-V-8H2M for videos).
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/repository/draftsRepository.dart';
import 'package:miniguru/repository/userDataRepository.dart';
import 'package:miniguru/screens/addDraftScreen.dart';
import 'package:miniguru/screens/unifiedVideoPlayer.dart';
import 'package:miniguru/state/sessionState.dart';

const _blue = Color(0xFF0A6CFF);
const _ink = Color(0xFF1A1A2E);
const _muted = Color(0xFF5F5F88);

class IdeaPoolTab extends StatefulWidget {
  const IdeaPoolTab({super.key});
  @override
  State<IdeaPoolTab> createState() => _IdeaPoolTabState();
}

class _IdeaPoolTabState extends State<IdeaPoolTab> with AutomaticKeepAliveClientMixin {
  final _api = MiniguruApi();
  final _qCtrl = TextEditingController();
  Timer? _deb;
  List<Map<String, dynamic>>? _items;
  bool _loading = true;
  bool _failed = false;
  String _type = 'all';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _deb?.cancel();
    _qCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _failed = false; });
    final r = await _api.fetchIdeas(q: _qCtrl.text.trim(), type: _type);
    if (!mounted) return;
    setState(() { _items = r; _loading = false; _failed = r == null; });
  }

  void _onChanged(String _) {
    _deb?.cancel();
    _deb = Timer(const Duration(milliseconds: 450), _load);
  }

  Widget _chip(String label, String t) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(label, style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 12)),
          selected: _type == t,
          onSelected: (_) { _type = t; _load(); },
        ),
      );

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 90),
      children: [
        TextField(
          controller: _qCtrl,
          onChanged: _onChanged,
          decoration: InputDecoration(
            hintText: 'Search words or ID (MG-SSK-PK-0042, MG-V-8H2M)',
            hintStyle: GoogleFonts.nunito(fontSize: 13),
            prefixIcon: const Icon(Icons.search),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
          ),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [_chip('All', 'all'), _chip('💡 Ideas', 'ideas'), _chip('✅ Finished projects', 'projects')]),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: const Color(0xFFFFF8E1), borderRadius: BorderRadius.circular(12)),
          child: Text(
            'Ideas here are shared by children. MiniGuru staff do not check them; only finished projects are reviewed. '
            'Never share phone numbers, addresses or links.',
            style: GoogleFonts.nunito(fontSize: 11.5, fontWeight: FontWeight.w700, color: const Color(0xFF6A5200)),
          ),
        ),
        const SizedBox(height: 12),
        if (_loading)
          const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator()))
        else if (_failed)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Please log in to see the Idea Pool.',
                textAlign: TextAlign.center, style: GoogleFonts.nunito(fontWeight: FontWeight.w800, color: _muted)),
          )
        else if ((_items ?? []).isEmpty)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Nothing here yet. Share an idea from your planning sheet! 💡',
                textAlign: TextAlign.center, style: GoogleFonts.nunito(fontWeight: FontWeight.w800, color: _muted)),
          )
        else
          for (final it in _items!) _card(it),
      ],
    );
  }

  Widget _card(Map<String, dynamic> it) {
    final isIdea = it['type'] == 'idea';
    final mats = (it['materials'] as List? ?? []).map((e) => e.toString()).toList();
    return GestureDetector(
      onTap: () => isIdea ? _openIdea(it) : _openProject(it),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFCFE3FF))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (!isIdea && (it['thumbnail'] ?? '').toString().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(it['thumbnail'], width: 84, height: 54, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox(width: 84, height: 54)),
              ),
            ),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                  decoration: BoxDecoration(color: isIdea ? const Color(0xFFFFF3C4) : const Color(0xFFD8F5E0), borderRadius: BorderRadius.circular(10)),
                  child: Text(isIdea ? '💡 Idea' : '✅ Finished', style: GoogleFonts.nunito(fontSize: 10.5, fontWeight: FontWeight.w900)),
                ),
              ]),
              const SizedBox(height: 4),
              Text(it['title']?.toString() ?? '', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 14, color: _ink)),
              Text('by ${it['maker'] ?? ''}  ·  ${(isIdea ? it['code'] : (it['videoCode'] ?? it['code'])) ?? ''}',
                  style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w700, color: _muted)),
              const SizedBox(height: 3),
              Text(it['description']?.toString() ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: GoogleFonts.nunito(fontSize: 12.5)),
              if (mats.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text('🧰 ${mats.join(', ')}', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.nunito(fontSize: 11.5, fontWeight: FontWeight.w700, color: _muted)),
                ),
              if (isIdea && (it['tries'] ?? 0) > 0)
                Text('${it['tries']} ${it['tries'] == 1 ? 'child' : 'children'} tried this',
                    style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w800, color: _blue)),
            ]),
          ),
        ]),
      ),
    );
  }

  void _openProject(Map<String, dynamic> it) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UnifiedVideoPlayer(
          videoId: it['videoId']?.toString() ?? '',
          projectId: it['projectId']?.toString() ?? it['id']?.toString() ?? '',
          title: it['title']?.toString() ?? '',
          description: it['description']?.toString() ?? '',
          channelTitle: it['channelTitle']?.toString() ?? '',
          ownerId: it['ownerId']?.toString() ?? '',
        ),
      ),
    );
  }

  void _openIdea(Map<String, dynamic> it) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => IdeaDetailScreen(id: it['id'].toString())));
  }
}

class IdeaDetailScreen extends StatefulWidget {
  final String id;
  const IdeaDetailScreen({super.key, required this.id});
  @override
  State<IdeaDetailScreen> createState() => _IdeaDetailScreenState();
}

class _IdeaDetailScreenState extends State<IdeaDetailScreen> {
  Map<String, dynamic>? _idea;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    MiniguruApi().fetchIdea(widget.id).then((r) {
      if (mounted) setState(() { _idea = r; _loading = false; });
    });
  }

  Future<void> _try() async {
    if (_busy) return;
    setState(() => _busy = true);
    final r = await MiniguruApi().tryIdea(widget.id);
    if (!mounted) return;
    if (r == null) {
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not do that right now. Please try again.')));
      return;
    }
    final idea = Map<String, dynamic>.from(r['idea'] as Map);
    // Copy the idea into a new planning sheet (a draft). The maker is credited at the end of the description.
    final myUser = await UserRepository().getUserDataFromLocalDb();
    final mats = <String, int>{};
    for (final m in (idea['materials'] as List? ?? [])) {
      final id = m['id']?.toString() ?? '';
      if (id.isNotEmpty) mats[id] = (m['quantity'] as num?)?.toInt() ?? 1;
    }
    final credit = '\n\n💡 Inspired by ${idea['maker']}\'s idea ${idea['code']}';
    final draftId = await DraftRepository().saveDraft(
      idea['title']?.toString() ?? '',
      '${idea['description'] ?? ''}$credit',
      idea['category']?.toString() ?? '',
      materials: mats,
      childKey: SessionState.isChildSession ? SessionState.activeChildProfileId : myUser?.id,
      sketch: idea['sketch']?.toString(),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => AddDraftScreen(draftId: draftId)));
  }

  @override
  Widget build(BuildContext context) {
    final i = _idea;
    return Scaffold(
      backgroundColor: const Color(0xFFE3EEFF),
      appBar: AppBar(
        backgroundColor: _blue,
        foregroundColor: Colors.white,
        title: Text('💡 Idea', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : i == null
              ? Center(child: Text('This idea is not available.', style: GoogleFonts.nunito(fontWeight: FontWeight.w800)))
              : ListView(padding: const EdgeInsets.all(16), children: [
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(i['title']?.toString() ?? '', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 18, color: _ink)),
                      const SizedBox(height: 2),
                      Text('by ${i['maker'] ?? ''}  ·  ${i['code'] ?? ''}',
                          style: GoogleFonts.nunito(fontWeight: FontWeight.w700, color: _muted, fontSize: 12)),
                      if ((i['tries'] ?? 0) > 0)
                        Text('${i['tries']} ${i['tries'] == 1 ? 'child' : 'children'} tried this',
                            style: GoogleFonts.nunito(fontWeight: FontWeight.w800, color: _blue, fontSize: 12)),
                      if ((i['sketch'] ?? '').toString().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.memory(base64Decode(i['sketch']), fit: BoxFit.contain)),
                        const SizedBox(height: 4),
                        Text("Child's own sketch. MiniGuru has no direct say in it.", style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w700, color: _muted)),
                      ],
                      const SizedBox(height: 10),
                      Text(i['description']?.toString() ?? '', style: GoogleFonts.nunito(fontSize: 14)),
                      if ((i['materials'] as List? ?? []).isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text('🧰 Materials', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
                        for (final m in (i['materials'] as List)) Text('• ${m['name']}  ×${m['quantity'] ?? 1}', style: GoogleFonts.nunito()),
                      ],
                    ]),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton(
                    onPressed: _busy ? null : _try,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _blue,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 50),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text(_busy ? 'Please wait…' : '🚀 I\'ll try this', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 16)),
                  ),
                  const SizedBox(height: 6),
                  Text('This copies the idea into your own planning sheet. ${i['maker']} stays credited and may get a few Goins.',
                      textAlign: TextAlign.center, style: GoogleFonts.nunito(fontSize: 11.5, color: _muted, fontWeight: FontWeight.w700)),
                ]),
    );
  }
}
