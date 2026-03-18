import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/ChildProfile.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class PinEntryScreen extends StatefulWidget {
  final ChildProfile child;
  const PinEntryScreen({super.key, required this.child});

  @override
  State<PinEntryScreen> createState() => _PinEntryScreenState();
}

class _PinEntryScreenState extends State<PinEntryScreen>
    with SingleTickerProviderStateMixin {
  String _pin = '';
  bool _isLoading = false;
  bool _hasError = false;
  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;
  late MiniguruApi _api;

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    _shakeController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _shakeAnimation = Tween<double>(begin: 0, end: 1).animate(
        CurvedAnimation(parent: _shakeController, curve: Curves.elasticIn));
  }

  @override
  void dispose() {
    _shakeController.dispose();
    super.dispose();
  }

  void _onKeyTap(String digit) {
    if (_pin.length >= 4 || _isLoading) return;
    setState(() {
      _pin += digit;
      _hasError = false;
    });
    if (_pin.length == 4) _verifyPin();
  }

  void _onDelete() {
    if (_pin.isEmpty || _isLoading) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _verifyPin() async {
    setState(() => _isLoading = true);
    try {
      final valid = await _api.verifyChildPin(widget.child.id, _pin);
      if (!mounted) return;
      if (valid) {
        Navigator.pop(context, true);
      } else {
        _shakeController.forward(from: 0);
        setState(() {
          _hasError = true;
          _pin = '';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _hasError = true;
          _pin = '';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context, false),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            children: [
              const SizedBox(height: 16),

              // Avatar
              Container(
                width: 90,
                height: 90,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                      colors: [Color(0xFF5B6EF5), Color(0xFF8B9FF8)]),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    widget.child.name[0].toUpperCase(),
                    style: GoogleFonts.nunito(
                        fontSize: 38,
                        fontWeight: FontWeight.w900,
                        color: Colors.white),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Text(widget.child.name,
                  style: GoogleFonts.nunito(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: Colors.black87)),
              const SizedBox(height: 6),
              Text('Enter PIN to continue',
                  style: GoogleFonts.nunito(
                      fontSize: 14, color: Colors.grey[500])),
              const SizedBox(height: 40),

              // PIN dots with shake animation
              AnimatedBuilder(
                animation: _shakeAnimation,
                builder: (context, child) {
                  final offset =
                      _hasError ? (8 * (0.5 - _shakeAnimation.value).abs()) : 0.0;
                  return Transform.translate(
                    offset: Offset(offset * 10, 0),
                    child: child,
                  );
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(4, (i) {
                    final filled = i < _pin.length;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.symmetric(horizontal: 10),
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _hasError
                            ? Colors.red
                            : filled
                                ? pastelBlueText
                                : Colors.grey[300],
                        boxShadow: filled && !_hasError
                            ? [
                                BoxShadow(
                                    color: pastelBlueText.withOpacity(0.4),
                                    blurRadius: 8)
                              ]
                            : null,
                      ),
                    );
                  }),
                ),
              ),

              if (_hasError) ...[
                const SizedBox(height: 12),
                Text('Incorrect PIN. Try again.',
                    style: GoogleFonts.nunito(
                        fontSize: 13,
                        color: Colors.red,
                        fontWeight: FontWeight.w700)),
              ],

              const SizedBox(height: 40),

              // Number pad
              if (_isLoading)
                const CircularProgressIndicator(color: pastelBlueText)
              else
                _buildNumPad(),

              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNumPad() {
    final keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'del'],
    ];

    return Column(
      children: keys.map((row) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: row.map((key) {
              if (key.isEmpty) return const SizedBox(width: 80, height: 80);
              if (key == 'del') {
                return _numKey(
                  child: const Icon(Icons.backspace_outlined,
                      color: Colors.black54, size: 22),
                  onTap: _onDelete,
                  color: Colors.grey[100]!,
                );
              }
              return _numKey(
                child: Text(key,
                    style: GoogleFonts.nunito(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Colors.black87)),
                onTap: () => _onKeyTap(key),
                color: Colors.white,
              );
            }).toList(),
          ),
        );
      }).toList(),
    );
  }

  Widget _numKey({
    required Widget child,
    required VoidCallback onTap,
    required Color color,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
                color: Colors.black.withOpacity(0.06),
                blurRadius: 8,
                offset: const Offset(0, 3)),
          ],
        ),
        child: Center(child: child),
      ),
    );
  }
}
