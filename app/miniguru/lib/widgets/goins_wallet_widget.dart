// lib/widgets/goins_wallet_widget.dart

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/models/GoinTransaction.dart';
import 'package:miniguru/repository/GoinsRepository.dart';

// ── Colours ──────────────────────────────────────────────────
const _blue  = Color(0xFF3B82F6);
const _green = Color(0xFF10B981);
const _amber = Color(0xFFF59E0B);
const _red   = Color(0xFFEF4444);
const _card  = Color(0xFF1E293B);

// ─────────────────────────────────────────────────────────────
// GoineIcon  — the gold Goine logo at any size
// Use this EVERYWHERE you previously showed a "score" number
// ─────────────────────────────────────────────────────────────
class GoineIcon extends StatelessWidget {
  final double size;
  const GoineIcon({super.key, this.size = 20});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/Goine.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
      // fallback if asset not found yet
      errorBuilder: (_, __, ___) => Text(
        'G',
        style: TextStyle(
          color: _amber,
          fontWeight: FontWeight.bold,
          fontSize: size * 0.75,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GoinsBalanceBadge
// Tiny pill badge — replaces "score" in AppBar / home feed / profile header
// Usage:  GoinsBalanceBadge(balance: _currentGoinsBalance)
// ─────────────────────────────────────────────────────────────
class GoinsBalanceBadge extends StatelessWidget {
  final int balance;
  const GoinsBalanceBadge({super.key, required this.balance});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E3A8A), Color(0xFF2563EB)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _amber.withValues(alpha: 0.2),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          GoineIcon(size: 16),
          const SizedBox(width: 5),
          Text(
            '$balance',
            style: GoogleFonts.poppins(
              color: _amber,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GoinsWalletCard
// Full card for profile screen — shows balance + history
// Usage:  GoinsWalletCard(initialBalance: user.score)
//   note: pass user.score — goins IS the score field
// ─────────────────────────────────────────────────────────────
class GoinsWalletCard extends StatefulWidget {
  final int initialBalance;
  const GoinsWalletCard({super.key, required this.initialBalance});

  @override
  State<GoinsWalletCard> createState() => _GoinsWalletCardState();
}

class _GoinsWalletCardState extends State<GoinsWalletCard> {
  final _repo = GoinsRepository();
  List<GoinTransaction> _history = [];
  int _balance = 0;
  bool _loading = true;
  bool _showHistory = false;

  @override
  void initState() {
    super.initState();
    _balance = widget.initialBalance;
    _load();
  }

  Future<void> _load() async {
    final balance = await _repo.getGoinsBalance();
    final history = await _repo.getGoinsHistory();
    if (mounted) {
      setState(() {
        _balance = balance;
        _history = history;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildMainCard(),
        if (_showHistory) _buildHistorySection(),
      ],
    );
  }

  Widget _buildMainCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A2F6A), Color(0xFF0F172A)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _amber.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: _amber.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(children: [
                  GoineIcon(size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Goine Wallet',
                    style: GoogleFonts.poppins(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w500),
                  ),
                ]),
                GestureDetector(
                  onTap: _load,
                  child: const Icon(Icons.refresh_rounded,
                      color: Colors.white38, size: 18),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // ── Big balance ──
            _loading
                ? const SizedBox(
                    height: 50,
                    child: Center(
                        child: CircularProgressIndicator(
                            color: _amber, strokeWidth: 2)))
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      GoineIcon(size: 44),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$_balance',
                            style: GoogleFonts.poppins(
                              color: _amber,
                              fontSize: 44,
                              fontWeight: FontWeight.bold,
                              height: 1,
                            ),
                          ),
                          Text(
                            'Goines',
                            style: GoogleFonts.poppins(
                                color: Colors.white38, fontSize: 13),
                          ),
                        ],
                      ),
                    ],
                  ),
            const SizedBox(height: 6),
            Text(
              'The Education Currency of MiniGuru',
              style: GoogleFonts.poppins(
                color: _amber.withValues(alpha: 0.45),
                fontSize: 10,
                letterSpacing: 0.4,
              ),
            ),
            const SizedBox(height: 16),

            // ── Earn hint ──
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _amber.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(12),
                border:
                    Border.all(color: _amber.withValues(alpha: 0.18)),
              ),
              child: Row(
                children: [
                  GoineIcon(size: 14),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Upload a project video → earn 2× your material cost back!',
                      style: GoogleFonts.poppins(
                          color: Colors.white60, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ── Toggle history ──
            GestureDetector(
              onTap: () =>
                  setState(() => _showHistory = !_showHistory),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _showHistory ? 'Hide History' : 'View History',
                    style: GoogleFonts.poppins(
                      color: _blue,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    _showHistory
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: _blue,
                    size: 16,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistorySection() {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(20),
        child: Center(
            child:
                CircularProgressIndicator(color: _amber, strokeWidth: 2)),
      );
    }
    if (_history.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: Column(children: [
            GoineIcon(size: 28),
            const SizedBox(height: 8),
            Text('No transactions yet',
                style: GoogleFonts.poppins(
                    color: Colors.white38, fontSize: 12)),
          ]),
        ),
      );
    }
    return Column(
        children:
            _history.take(10).map(_buildTransactionRow).toList());
  }

  Widget _buildTransactionRow(GoinTransaction txn) {
    final isCredit = txn.type.isCredit;
    final amountColor = isCredit ? _green : _red;
    final amountStr =
        isCredit ? '+${txn.amount}' : '-${txn.amount}';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: (isCredit ? _green : _red)
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(txn.type.emoji,
                  style: const TextStyle(fontSize: 16)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(txn.type.label,
                    style: GoogleFonts.poppins(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w500)),
                Text(
                  txn.description.isNotEmpty
                      ? txn.description
                      : _fmtDate(txn.timestamp),
                  style: GoogleFonts.poppins(
                      color: Colors.white38, fontSize: 10),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GoineIcon(size: 11),
                  const SizedBox(width: 3),
                  Text(amountStr,
                      style: GoogleFonts.poppins(
                        color: amountColor,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      )),
                ],
              ),
              Text('${txn.balanceAfter}G',
                  style: GoogleFonts.poppins(
                      color: Colors.white38, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }

  String _fmtDate(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inDays == 0) {
      return diff.inHours == 0
          ? '${diff.inMinutes}m ago'
          : '${diff.inHours}h ago';
    }
    return diff.inDays == 1
        ? 'Yesterday'
        : '${dt.day}/${dt.month}/${dt.year}';
  }
}

// ─────────────────────────────────────────────────────────────
// showGoinsAwardPopup
// Call after video upload success
// ─────────────────────────────────────────────────────────────
Future<void> showGoinsAwardPopup({
  required BuildContext context,
  required int awarded,
  required int newBalance,
  required String reason,
}) async {
  await showDialog(
    context: context,
    barrierDismissible: true,
    builder: (_) => _GoinsAwardDialog(
      awarded: awarded,
      newBalance: newBalance,
      reason: reason,
    ),
  );
}

class _GoinsAwardDialog extends StatelessWidget {
  final int awarded;
  final int newBalance;
  final String reason;
  const _GoinsAwardDialog(
      {required this.awarded,
      required this.newBalance,
      required this.reason});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(24),
          border:
              Border.all(color: _amber.withValues(alpha: 0.4)),
          boxShadow: [
            BoxShadow(
              color: _amber.withValues(alpha: 0.15),
              blurRadius: 40,
              spreadRadius: 5,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            GoineIcon(size: 80),
            const SizedBox(height: 12),
            Text('Goines Awarded! 🎉',
                style: GoogleFonts.poppins(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text(reason,
                style: GoogleFonts.poppins(
                    color: Colors.white54, fontSize: 12),
                textAlign: TextAlign.center),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 24, vertical: 14),
              decoration: BoxDecoration(
                color: _amber.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: _amber.withValues(alpha: 0.35)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GoineIcon(size: 36),
                  const SizedBox(width: 10),
                  Text('+$awarded',
                      style: GoogleFonts.poppins(
                          color: _amber,
                          fontSize: 38,
                          fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text('New balance: $newBalance Goines',
                style: GoogleFonts.poppins(
                    color: Colors.white38, fontSize: 12)),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [
                    Color(0xFF1E3A8A),
                    Color(0xFF3B82F6)
                  ]),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      GoineIcon(size: 18),
                      const SizedBox(width: 8),
                      Text('Awesome! Keep Building 🚀',
                          style: GoogleFonts.poppins(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              fontSize: 14)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}