// lib/widgets/makerCard.dart
//
// The small card another maker sees after tapping a name (Ladder, video page).
// Shows only what the child chose to share in "About me" plus level and Goins.
// Never school, city, age or contact details.

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';

Future<void> showMakerCard(BuildContext context, String userId) {
  if (userId.isEmpty) return Future.value();
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    constraints: const BoxConstraints(maxWidth: 520),
    builder: (_) => _MakerCardSheet(userId: userId),
  );
}

class _MakerCardSheet extends StatelessWidget {
  final String userId;
  const _MakerCardSheet({required this.userId});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: FutureBuilder<Map<String, dynamic>?>(
        future: MiniguruApi().getMakerCard(userId),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const SizedBox(
              height: 220,
              child: Center(child: CircularProgressIndicator(color: Color(0xFF5B6EF5))),
            );
          }
          final d = snap.data;
          if (d == null) {
            return SizedBox(
              height: 200,
              child: Center(
                child: Text('This maker\'s card is not available.',
                    style: GoogleFonts.nunito(color: Colors.black54)),
              ),
            );
          }
          return _body(d);
        },
      ),
    );
  }

  Widget _row(String label, String? value) {
    if (value == null || value.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label.toUpperCase(),
            style: GoogleFonts.nunito(
                fontSize: 10, letterSpacing: 0.8, fontWeight: FontWeight.w900, color: const Color(0xFF8888AA))),
        const SizedBox(height: 2),
        Text(value,
            style: GoogleFonts.nunito(
                fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF1A1A2E))),
      ]),
    );
  }

  Widget _body(Map<String, dynamic> d) {
    final name = (d['name'] ?? 'Maker').toString();
    final tagline = (d['tagline'] ?? '').toString();
    final interests = (d['interests'] is List) ? List<String>.from((d['interests'] as List).map((e) => e.toString())) : <String>[];
    final hasAny = tagline.isNotEmpty ||
        (d['about'] ?? '').toString().isNotEmpty ||
        interests.isNotEmpty ||
        (d['favouriteSubject'] ?? '').toString().isNotEmpty ||
        (d['dreamInvention'] ?? '').toString().isNotEmpty ||
        (d['whenIGrowUp'] ?? '').toString().isNotEmpty;
    return SingleChildScrollView(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF5B6EF5), Color(0xFF8B5CF6)]),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(children: [
            Text((d['levelEmoji'] ?? '🌱').toString(), style: const TextStyle(fontSize: 38)),
            const SizedBox(height: 6),
            Text(name,
                textAlign: TextAlign.center,
                style: GoogleFonts.nunito(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
            if (tagline.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text('“$tagline”',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.nunito(fontSize: 13, color: Colors.white.withOpacity(0.9))),
            ],
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 6, alignment: WrapAlignment.center, children: [
              _pill('${d['levelTitle'] ?? ''}'),
              _pill('🪙 ${d['goins'] ?? 0} Goins'),
              _pill('🎬 ${d['publishedProjects'] ?? 0} projects'),
            ]),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (!hasAny)
              Text('This maker has not added their details yet.',
                  style: GoogleFonts.nunito(fontSize: 13, color: Colors.black54)),
            _row('About', d['about']?.toString()),
            if (interests.isNotEmpty) ...[
              Text('INTERESTS',
                  style: GoogleFonts.nunito(
                      fontSize: 10, letterSpacing: 0.8, fontWeight: FontWeight.w900, color: const Color(0xFF8888AA))),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final i in interests)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF0FF),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(i,
                        style: GoogleFonts.nunito(
                            fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF3F51B5))),
                  ),
              ]),
              const SizedBox(height: 12),
            ],
            _row('Favourite subject', d['favouriteSubject']?.toString()),
            _row('Dream invention', d['dreamInvention']?.toString()),
            _row('When I grow up', d['whenIGrowUp']?.toString()),
          ]),
        ),
      ]),
    );
  }

  Widget _pill(String t) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.22),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(t,
            style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white)),
      );
}
