// "views on YouTube" badge (Oct 2026). Shows the real YouTube view count of a video,
// so children see their making is being watched, without leaving the app.
//  - 10 or more views: "▶ 1.2K on YouTube"  (on your own video: "Your video: 1.2K views on YouTube")
//  - fewer: "▶ New"  (a tiny number never discourages anyone)
//  - no answer from the server: nothing is shown.
// Counts are fetched in one batch per moment and kept for 3 hours.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class YoutubeViewsCache {
  static final Map<String, int> _views = {};
  static final Map<String, DateTime> _at = {};
  static final Map<String, List<Completer<int?>>> _waiting = {};
  static Timer? _timer;
  static const _ttl = Duration(hours: 3);

  static Future<int?> get(String id) {
    final at = _at[id];
    if (at != null && DateTime.now().difference(at) < _ttl) return Future.value(_views[id]);
    final c = Completer<int?>();
    _waiting.putIfAbsent(id, () => []).add(c);
    _timer ??= Timer(const Duration(milliseconds: 120), _flush);
    return c.future;
  }

  static Future<void> _flush() async {
    _timer = null;
    final ids = _waiting.keys.take(50).toList();
    final batch = <String, List<Completer<int?>>>{for (final i in ids) i: _waiting.remove(i)!};
    if (_waiting.isNotEmpty) _timer = Timer(const Duration(milliseconds: 120), _flush);
    Map<String, int> got = {};
    try {
      got = await MiniguruApi().fetchYoutubeViews(ids);
    } catch (_) {}
    for (final e in batch.entries) {
      if (got.containsKey(e.key)) {
        _views[e.key] = got[e.key]!;
        _at[e.key] = DateTime.now();
      }
      for (final c in e.value) {
        c.complete(got[e.key]);
      }
    }
  }
}

String _short(int n) {
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(n >= 10000000 ? 0 : 1)}M';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(n >= 10000 ? 0 : 1)}K';
  return '$n';
}

class YoutubeViewsChip extends StatelessWidget {
  final String videoId;
  final bool mine;
  final bool onDark;
  const YoutubeViewsChip({super.key, required this.videoId, this.mine = false, this.onDark = false});

  @override
  Widget build(BuildContext context) {
    if (videoId.isEmpty) return const SizedBox.shrink();
    return FutureBuilder<int?>(
      future: YoutubeViewsCache.get(videoId),
      builder: (context, snap) {
        final n = snap.data;
        if (n == null) return const SizedBox.shrink();
        final isNew = n < 10;
        final text = isNew
            ? (mine ? '▶ New on YouTube' : '▶ New')
            : (mine ? '▶ Your video: ${_short(n)} views on YouTube' : '▶ ${_short(n)} on YouTube');
        return Text(text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.nunito(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: onDark ? Colors.white : const Color(0xFFE53935)));
      },
    );
  }
}
