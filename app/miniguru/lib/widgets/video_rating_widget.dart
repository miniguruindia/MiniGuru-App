// FILE: app/miniguru/lib/screens/widgets/video_rating_widget.dart
//
// Drop this widget into your video detail/player screen.
// Usage:
//   VideoRatingWidget(videoId: project.id, creatorName: project.user.name)
//
// Requires: http package (already in pubspec), shared_preferences for token

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../secrets.dart'; // apiBaseUrl

// ─── Criterion definition ─────────────────────────────────────────────────────
class _Criterion {
  final String key;
  final String label;
  final String emoji;
  final String hint;

  const _Criterion({
    required this.key,
    required this.label,
    required this.emoji,
    required this.hint,
  });
}

const List<_Criterion> _criteria = [
  _Criterion(key: 'sturdy',      label: 'Sturdy',      emoji: '🏗️', hint: 'Holds together well'),
  _Criterion(key: 'creative',    label: 'Creative',    emoji: '💡', hint: 'Original or unexpected idea'),
  _Criterion(key: 'functional',  label: 'Functional',  emoji: '⚙️', hint: 'Actually works'),
  _Criterion(key: 'resourceful', label: 'Resourceful', emoji: '♻️', hint: 'Smart use of materials'),
  _Criterion(key: 'documented',  label: 'Documented',  emoji: '📹', hint: 'Shows the making process'),
];

// ─── Rating data model ────────────────────────────────────────────────────────
class _RatingData {
  final Map<String, int> breakdown;   // criterion → count of raters
  final int totalRaters;
  final Map<String, bool>? myRating;  // null = not yet rated
  final int? myGoinsAwarded;
  final bool? myIsCrossSchool;

  _RatingData({
    required this.breakdown,
    required this.totalRaters,
    this.myRating,
    this.myGoinsAwarded,
    this.myIsCrossSchool,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// VideoRatingWidget
// ═════════════════════════════════════════════════════════════════════════════
class VideoRatingWidget extends StatefulWidget {
  final String videoId;       // project id — used as videoId on backend
  final String creatorName;   // shown in "You rated [name]'s video"

  const VideoRatingWidget({
    Key? key,
    required this.videoId,
    required this.creatorName,
  }) : super(key: key);

  @override
  State<VideoRatingWidget> createState() => _VideoRatingWidgetState();
}

class _VideoRatingWidgetState extends State<VideoRatingWidget> {
  _RatingData? _data;
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  // Selected criteria for pending submission
  final Map<String, bool> _selected = {
    'sturdy':      false,
    'creative':    false,
    'functional':  false,
    'resourceful': false,
    'documented':  false,
  };

  @override
  void initState() {
    super.initState();
    _loadRatings();
  }

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('authToken');
  }

  // ── Fetch existing ratings ────────────────────────────────────────────────
  Future<void> _loadRatings() async {
    setState(() { _loading = true; _error = null; });
    try {
      final token = await _getToken();
      final res = await http.get(
        Uri.parse('$apiBaseUrl/api/videos/${widget.videoId}/ratings'),
        headers: { 'Authorization': 'Bearer $token' },
      );
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        final myR = json['myRating'];
        setState(() {
          _data = _RatingData(
            breakdown: Map<String, int>.from(
              (json['breakdown'] as Map).map((k, v) => MapEntry(k.toString(), v as int))
            ),
            totalRaters: json['totalRaters'] ?? 0,
            myRating: myR != null ? Map<String, bool>.from(
              (_criteria.map((c) => c.key)).fold<Map<String, bool>>({}, (map, key) {
                map[key] = myR[key] == true;
                return map;
              })
            ) : null,
            myGoinsAwarded: myR?['goinsAwarded'],
            myIsCrossSchool: myR?['isCrossSchool'],
          );
          // Pre-fill selected with existing rating if any
          if (myR != null) {
            for (final c in _criteria) {
              _selected[c.key] = myR[c.key] == true;
            }
          }
          _loading = false;
        });
      } else {
        setState(() { _error = 'Could not load ratings.'; _loading = false; });
      }
    } catch (e) {
      setState(() { _error = 'Network error.'; _loading = false; });
    }
  }

  // ── Submit rating ─────────────────────────────────────────────────────────
  Future<void> _submitRating() async {
    final anySelected = _selected.values.any((v) => v);
    if (!anySelected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tap at least one criterion to rate.')),
      );
      return;
    }

    setState(() { _submitting = true; _error = null; });
    try {
      final token = await _getToken();
      final res = await http.post(
        Uri.parse('$apiBaseUrl/api/videos/${widget.videoId}/rate'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(_selected),
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        final json = jsonDecode(res.body);
        final goins = json['goinsAwarded'] as int;
        final crossSchool = json['isCrossSchool'] as bool;

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(children: [
                const Text('🪙 '),
                Text(
                  '+$goins Goins awarded to ${widget.creatorName}!'
                  '${crossSchool ? ' (2× cross-school bonus)' : ''}',
                  style: GoogleFonts.nunito(fontWeight: FontWeight.w900),
                ),
              ]),
              backgroundColor: const Color(0xFF1B5E20),
              duration: const Duration(seconds: 3),
            ),
          );
        }
        // Reload to show updated breakdown
        await _loadRatings();
      } else {
        final json = jsonDecode(res.body);
        setState(() {
          _error = json['error'] ?? 'Rating failed.';
          _submitting = false;
        });
      }
    } catch (e) {
      setState(() { _error = 'Network error.'; _submitting = false; });
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    final alreadyRated = _data?.myRating != null;
    final selectedCount = _selected.values.where((v) => v).length;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EAF6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ─────────────────────────────────────────────────────
          Row(children: [
            Text('⭐ ', style: const TextStyle(fontSize: 18)),
            Text(
              'Rate this project',
              style: GoogleFonts.nunito(
                fontWeight: FontWeight.w900,
                fontSize: 16,
                color: const Color(0xFF3F51B5),
              ),
            ),
            const Spacer(),
            if (_data != null && _data!.totalRaters > 0)
              Text(
                '${_data!.totalRaters} rating${_data!.totalRaters != 1 ? 's' : ''}',
                style: GoogleFonts.nunito(
                  fontSize: 12,
                  color: const Color(0xFF8888AA),
                ),
              ),
          ]),

          // ── Already rated banner ────────────────────────────────────────
          if (alreadyRated) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(children: [
                const Text('🪙 ', style: TextStyle(fontSize: 14)),
                Expanded(
                  child: Text(
                    'You gave ${widget.creatorName} ${_data!.myGoinsAwarded} Goins'
                    '${_data!.myIsCrossSchool == true ? ' (2× cross-school)' : ''}. '
                    'Tap criteria below to update.',
                    style: GoogleFonts.nunito(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF2E7D32),
                    ),
                  ),
                ),
              ]),
            ),
          ],

          const SizedBox(height: 12),

          // ── 5 Criteria chips ────────────────────────────────────────────
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _criteria.map((c) {
              final isSelected = _selected[c.key] == true;
              final breakdownCount = _data?.breakdown[c.key] ?? 0;

              return GestureDetector(
                onTap: () {
                  setState(() {
                    _selected[c.key] = !isSelected;
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFF5B6EF5)
                        : const Color(0xFFE8EAF6),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: isSelected
                          ? const Color(0xFF5B6EF5)
                          : const Color(0xFFBDBDBD),
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(c.emoji, style: const TextStyle(fontSize: 14)),
                      const SizedBox(width: 6),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            c.label,
                            style: GoogleFonts.nunito(
                              fontWeight: FontWeight.w900,
                              fontSize: 13,
                              color: isSelected ? Colors.white : const Color(0xFF3F51B5),
                            ),
                          ),
                          if (breakdownCount > 0)
                            Text(
                              '$breakdownCount peer${breakdownCount != 1 ? 's' : ''}',
                              style: GoogleFonts.nunito(
                                fontSize: 10,
                                color: isSelected
                                    ? Colors.white.withOpacity(0.8)
                                    : const Color(0xFF8888AA),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),

          // ── Hint text ───────────────────────────────────────────────────
          if (selectedCount > 0) ...[
            const SizedBox(height: 10),
            Text(
              '${selectedCount * 10} Goins will go to ${widget.creatorName} '
              '(+ possible 2× if you\'re from a different school)',
              style: GoogleFonts.nunito(
                fontSize: 11,
                color: const Color(0xFF8888AA),
              ),
            ),
          ],

          // ── Error ───────────────────────────────────────────────────────
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: GoogleFonts.nunito(
                fontSize: 12,
                color: Colors.red,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],

          // ── Submit button ───────────────────────────────────────────────
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_submitting || selectedCount == 0) ? null : _submitRating,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF5B6EF5),
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFFE8EAF6),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              child: _submitting
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      alreadyRated
                          ? 'Update rating'
                          : selectedCount == 0
                              ? 'Tap criteria above to rate'
                              : 'Give ${selectedCount * 10} Goins to ${widget.creatorName}',
                      style: GoogleFonts.nunito(
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}